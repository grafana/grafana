package pluginmanifest

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"

	"github.com/grafana/grafana-app-sdk/app"
	appmanifest "github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	k8sruntime "k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/validation/spec"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	pluginregistry "github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	grafanaauthorizer "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
)

// appSDKManifestFile is the statically-named file, read from the root of an app plugin's
// bundle, that holds the plugin's app-sdk manifest (an AppManifest custom resource).
const appSDKManifestFile = "app-sdk-manifest.json"

// Builder constructs app installers from the manifests of app plugins in the plugin registry.
//
// It is invoked by the API server at start time (rather than eagerly at Wire-injection time)
// because the set of served API groups is built once and is immutable thereafter: the registry
// must be fully populated with loaded plugins before the installers are derived. See the module
// dependency ordering that makes the API server start after the plugin store.
type Builder struct {
	features      featuremgmt.FeatureToggles
	registry      pluginregistry.Service
	client        plugins.Client
	pluginCtx     *plugincontext.Provider
	accessControl accesscontrol.Service
	accessClient  authlib.AccessClient
}

func ProvideBuilder(
	features featuremgmt.FeatureToggles,
	registry pluginregistry.Service,
	client plugins.Client,
	pluginCtx *plugincontext.Provider,
	accessControl accesscontrol.Service,
	accessClient authlib.AccessClient,
) *Builder {
	b := &Builder{
		features:      features,
		registry:      registry,
		client:        client,
		pluginCtx:     pluginCtx,
		accessControl: accessControl,
		accessClient:  accessClient,
	}

	// Roles have to be declared before accesscontrol registers its fixed roles, otherwise they
	// are never folded into the basic roles and nothing grants the actions the authorizer
	// checks. Which point that is depends on how plugins are loaded:
	//
	//   - default: plugins load eagerly in the plugin store's Wire provider, so the registry is
	//     already populated here and this is the last chance before Server.Init registers the
	//     fixed roles.
	//   - FlagPluginStoreServiceLoading: plugins load when the store service starts, so nothing
	//     is available yet. There the fixed-roles loader is ordered after the API server (see
	//     the background service dependency graph), so BuildInstallers declares them in time.
	//
	// Declaring in both places is safe: the second pass re-declares identical registrations.
	b.declareRolesForLoadedPlugins(context.Background())
	return b
}

// BuildInstallers derives an app installer for every app plugin in the registry that ships an
// app-sdk manifest. It returns nil when the feature is disabled. It is safe to call after the
// plugin registry has been populated (i.e. at API server start).
func (b *Builder) BuildInstallers(ctx context.Context) ([]appsdkapiserver.AppInstaller, error) {
	//nolint:staticcheck // not yet migrated to OpenFeature
	if !b.features.IsEnabledGlobally(featuremgmt.FlagPluginsAppSDKManifest) {
		return nil, nil
	}

	var installers []appsdkapiserver.AppInstaller
	for _, p := range b.registry.Plugins(ctx) {
		if p.Type != plugins.TypeApp {
			continue
		}
		manifest, ok, err := readAppSDKManifest(p.FS)
		if err != nil {
			return nil, fmt.Errorf("reading app-sdk manifest for plugin %s: %w", p.ID, err)
		}
		if !ok {
			continue
		}
		// Declares roles for plugins that were not yet loaded when the builder was constructed
		// (the service-loading path). Re-declaring an already-declared role is harmless.
		if err := b.declareRoles(p.ID, manifest); err != nil {
			return nil, fmt.Errorf("declaring roles for plugin %s: %w", p.ID, err)
		}
		installer, err := newInstallerFromManifest(p.ID, manifest, b.client, b.pluginCtx, b.authorizer())
		if err != nil {
			return nil, fmt.Errorf("creating app installer for plugin %s: %w", p.ID, err)
		}
		installers = append(installers, installer)
	}
	return installers, nil
}

// declareRolesForLoadedPlugins declares roles for every app plugin already present in the
// registry that ships a manifest. It is a no-op when the feature is disabled or when no plugin
// has loaded yet.
//
// Failures are logged and skipped rather than returned: a single malformed plugin must not stop
// the server from starting. BuildInstallers reads the same manifests later and reports the error
// there, where it can be surfaced without taking the process down at construction time.
func (b *Builder) declareRolesForLoadedPlugins(ctx context.Context) {
	//nolint:staticcheck // not yet migrated to OpenFeature
	if !b.features.IsEnabledGlobally(featuremgmt.FlagPluginsAppSDKManifest) {
		return
	}
	logger := log.New("pluginmanifest.roles")
	for _, p := range b.registry.Plugins(ctx) {
		if p.Type != plugins.TypeApp {
			continue
		}
		manifest, ok, err := readAppSDKManifest(p.FS)
		if err != nil {
			logger.Warn("Skipping role declaration for plugin with unreadable app-sdk manifest",
				"pluginId", p.ID, "error", err)
			continue
		}
		if !ok {
			continue
		}
		if err := b.declareRoles(p.ID, manifest); err != nil {
			logger.Warn("Failed to declare roles from plugin app-sdk manifest",
				"pluginId", p.ID, "error", err)
		}
	}
}

// declareRoles registers the manifest's roles with Grafana's access control service. Manifests
// that declare no roles are left alone: their kinds then fall back to the basic org-role checks
// applied by the shared Grafana authorizer chain.
func (b *Builder) declareRoles(pluginID string, manifest app.Manifest) error {
	if b.accessControl == nil {
		return nil
	}
	regs, err := rolesFromManifest(pluginID, manifest.ManifestData)
	if err != nil {
		return err
	}
	if len(regs) == 0 {
		return nil
	}
	return b.accessControl.DeclareFixedRoles(regs...)
}

// authorizer returns the authorizer applied to every manifest app's API group. It defers to
// Grafana RBAC so the roles declared from the manifest are what actually gate access. When no
// access client is available (unit tests, stripped-down builds) it returns nil, which leaves the
// group to the shared authorizer chain rather than silently allowing everything.
func (b *Builder) authorizer() authorizer.Authorizer {
	if b.accessClient == nil {
		return nil
	}
	return grafanaauthorizer.NewResourceAuthorizer(b.accessClient)
}

// readAppSDKManifest reads and parses the app-sdk-manifest.json file from the plugin bundle.
// The manifest is optional: ok is false (with a nil error) when the file is absent.
func readAppSDKManifest(pluginFS plugins.FS) (app.Manifest, bool, error) {
	f, err := pluginFS.Open(appSDKManifestFile)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return app.Manifest{}, false, nil
		}
		return app.Manifest{}, false, fmt.Errorf("opening %s: %w", appSDKManifestFile, err)
	}
	defer f.Close() //nolint:errcheck

	var cr appmanifest.AppManifest
	if err := json.NewDecoder(f).Decode(&cr); err != nil {
		return app.Manifest{}, false, fmt.Errorf("decoding AppManifest CR: %w", err)
	}

	data, err := cr.Spec.ToManifestData()
	if err != nil {
		return app.Manifest{}, false, fmt.Errorf("converting AppManifestSpec to ManifestData: %w", err)
	}

	return app.NewEmbeddedManifest(data), true, nil
}

func newInstallerFromManifest(
	pluginID string,
	manifest app.Manifest,
	client plugins.Client,
	pluginCtx *plugincontext.Provider,
	auth authorizer.Authorizer,
) (appsdkapiserver.AppInstaller, error) {
	// The app proxies admission (Validate/Mutate) to the plugin's backend; all other App methods
	// are no-ops. For manifests with no admission capabilities the proxy's admission methods are
	// never invoked by the SDK, so this is a no-op for those plugins.
	newApp := func(_ app.Config) (app.App, error) {
		return newPluginBackendApp(pluginID, client, pluginCtx), nil
	}
	provider := simple.NewAppProvider(manifest, nil, newApp)
	appConfig := app.Config{}
	if manifest.ManifestData != nil {
		appConfig.ManifestData = *manifest.ManifestData
	}
	resolver := newManifestGoTypeResolver(manifest)
	inner, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, resolver)
	if err != nil {
		return nil, err
	}
	return &pluginManifestInstaller{AppInstaller: inner, authorizer: auth}, nil
}

// pluginManifestInstaller wraps a defaultInstaller and adds the AuthorizerProvider
// interface required by Grafana's appinstaller pipeline.
type pluginManifestInstaller struct {
	appsdkapiserver.AppInstaller
	authorizer authorizer.Authorizer
}

func (i *pluginManifestInstaller) GetOpenAPIDefinitions(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
	defs := i.AppInstaller.GetOpenAPIDefinitions(ref)
	// manifestObject and manifestList back every manifest kind in the scheme. The k8s
	// OpenAPI builder resolves Go types by reflect path, so we must provide definitions for
	// them even though the real per-kind schemas are generated from the manifest by
	// AsKubeOpenAPI. Keys are the raw Go reflect paths (what the builder's definitions map
	// is keyed by), derived to stay correct if the types are renamed or moved.
	//
	// The definitions carry x-kubernetes-group-version-kind extensions for every served
	// GVK. The apiserver's managedFields/structured-merge-diff type converter indexes
	// models by that extension; without it, a create/apply fails with
	// "no corresponding type for <gvk>" because the converter can't find a schema for the
	// object's GVK.
	objectGVKs, listGVKs := i.servedGroupVersionKinds()
	defs[goReflectPath(&manifestObject{})] = genericObjectDefinition(objectGVKs)
	defs[goReflectPath(&manifestList{})] = genericObjectDefinition(listGVKs)
	// When a kind declares custom routes the SDK references EmptyObject via its
	// OpenAPIModelName(), but registers the definition under a different (mismatched)
	// key, so the OpenAPI builder fails to resolve it. Register the definition under
	// the name the builder actually looks up.
	const emptyObjectKey = "com.github.grafana-app-sdk.k8s.apiserver.EmptyObject"
	if _, ok := defs[emptyObjectKey]; !ok {
		defs[emptyObjectKey] = common.OpenAPIDefinition{
			Schema: spec.Schema{
				SchemaProps: spec.SchemaProps{
					Description: "EmptyObject defines a model for a missing object type",
					Type:        []string{"object"},
				},
			},
		}
	}
	return defs
}

// servedGroupVersionKinds returns the GVKs the installer serves, split into object kinds
// and their corresponding list kinds (<Kind>List), read from the manifest data.
func (i *pluginManifestInstaller) servedGroupVersionKinds() (objectGVKs, listGVKs []map[string]interface{}) {
	md := i.ManifestData()
	if md == nil {
		return nil, nil
	}
	for _, v := range md.Versions {
		for _, k := range v.Kinds {
			objectGVKs = append(objectGVKs, map[string]interface{}{
				"group": md.Group, "version": v.Name, "kind": k.Kind,
			})
			listGVKs = append(listGVKs, map[string]interface{}{
				"group": md.Group, "version": v.Name, "kind": k.Kind + "List",
			})
		}
	}
	return objectGVKs, listGVKs
}

// genericObjectDefinition builds the OpenAPI definition for the generic manifest object/list
// type, tagging it with the x-kubernetes-group-version-kind extension for every served GVK
// so structured-merge-diff can resolve a type for the object during managedFields handling.
func genericObjectDefinition(gvks []map[string]interface{}) common.OpenAPIDefinition {
	gvkList := make([]interface{}, 0, len(gvks))
	for _, gvk := range gvks {
		gvkList = append(gvkList, gvk)
	}
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			VendorExtensible: spec.VendorExtensible{
				Extensions: spec.Extensions{
					"x-kubernetes-group-version-kind": gvkList,
				},
			},
			SchemaProps: spec.SchemaProps{
				Description: "Generic representation of a plugin-manifest Kubernetes resource",
				Type:        []string{"object"},
			},
		},
	}
}

// GetAuthorizer returns the RBAC-backed authorizer for this app's kinds, so access is decided by
// the roles declared in the plugin's manifest.
//
// When no authorizer is configured this returns DecisionNoOpinion rather than DecisionAllow: the
// request then falls through to the rest of Grafana's authorizer chain (which ends in the org-role
// authorizer) instead of bypassing authorization entirely.
func (i *pluginManifestInstaller) GetAuthorizer() authorizer.Authorizer {
	if i.authorizer != nil {
		return i.authorizer
	}
	return authorizer.AuthorizerFunc(
		func(_ context.Context, _ authorizer.Attributes) (authorizer.Decision, string, error) {
			return authorizer.DecisionNoOpinion, "", nil
		},
	)
}

type manifestGoTypeResolver struct {
	kinds map[string]resource.Kind
}

func newManifestGoTypeResolver(manifest app.Manifest) *manifestGoTypeResolver {
	kinds := make(map[string]resource.Kind)
	if manifest.ManifestData == nil {
		return &manifestGoTypeResolver{kinds: kinds}
	}
	md := *manifest.ManifestData
	for _, v := range md.Versions {
		for _, mk := range v.Kinds {
			scope := resource.NamespacedScope
			if mk.Scope == "Cluster" {
				scope = resource.ClusterScope
			}
			kinds[mk.Kind+"/"+v.Name] = resource.Kind{
				Schema: resource.NewSimpleSchema(
					md.Group, v.Name,
					&manifestObject{}, &manifestList{},
					resource.WithKind(mk.Kind),
					resource.WithPlural(mk.Plural),
					resource.WithScope(scope),
				),
				Codecs: map[resource.KindEncoding]resource.Codec{
					resource.KindEncodingJSON: resource.NewJSONCodec(),
				},
			}
		}
	}
	return &manifestGoTypeResolver{kinds: kinds}
}

func (r *manifestGoTypeResolver) KindToGoType(kind, version string) (resource.Kind, bool) {
	k, ok := r.kinds[kind+"/"+version]
	return k, ok
}

func (r *manifestGoTypeResolver) CustomRouteReturnGoType(_, _, _, _ string) (any, bool) {
	return nil, false
}

func (r *manifestGoTypeResolver) CustomRouteQueryGoType(_, _, _, _ string) (k8sruntime.Object, bool) {
	return nil, false
}

func (r *manifestGoTypeResolver) CustomRouteRequestBodyGoType(_, _, _, _ string) (any, bool) {
	return nil, false
}
