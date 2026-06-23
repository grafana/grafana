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

	"github.com/grafana/grafana/pkg/plugins"
	pluginregistry "github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
)

// AppInstallers is a named type for Wire injection of plugin-manifest-sourced app installers.
type AppInstallers []appsdkapiserver.AppInstaller

// appSDKManifestFile is the statically-named file, read from the root of an app plugin's
// bundle, that holds the plugin's app-sdk manifest (an AppManifest custom resource).
const appSDKManifestFile = "app-sdk-manifest.json"

func ProvideAppInstallers(
	features featuremgmt.FeatureToggles,
	registry pluginregistry.Service,
	client plugins.Client,
	pluginCtx *plugincontext.Provider,
) (AppInstallers, error) {
	//nolint:staticcheck // not yet migrated to OpenFeature
	if !features.IsEnabledGlobally(featuremgmt.FlagPluginsAppSDKManifest) {
		return nil, nil
	}

	ctx := context.Background()
	var installers []appsdkapiserver.AppInstaller
	for _, p := range registry.Plugins(ctx) {
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
		installer, err := newInstallerFromManifest(p.ID, manifest, client, pluginCtx)
		if err != nil {
			return nil, fmt.Errorf("creating app installer for plugin %s: %w", p.ID, err)
		}
		installers = append(installers, installer)
	}
	return installers, nil
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
	return &pluginManifestInstaller{AppInstaller: inner}, nil
}

// pluginManifestInstaller wraps a defaultInstaller and adds the AuthorizerProvider
// interface required by Grafana's appinstaller pipeline.
type pluginManifestInstaller struct {
	appsdkapiserver.AppInstaller
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

func (i *pluginManifestInstaller) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(_ context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			if !attr.IsResourceRequest() {
				return authorizer.DecisionNoOpinion, "", nil
			}
			return authorizer.DecisionAllow, "", nil
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
