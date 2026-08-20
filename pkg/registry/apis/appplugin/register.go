package appplugin

import (
	"context"
	"fmt"
	"slices"
	"strings"

	"github.com/open-feature/go-sdk/openfeature"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/pluginschema"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

var (
	_ builder.APIGroupBuilder          = (*AppPluginAPIBuilder)(nil)
	_ builder.APIGroupVersionsProvider = (*AppPluginAPIBuilder)(nil)
)

// PluginClient is a subset of the plugins.Client interface with only the
// functions supported by the app plugins
type PluginClient interface {
	backend.CheckHealthHandler
	backend.CallResourceHandler
}

// PluginContext requires adding system settings (feature flags, etc) to the datasource config
type PluginContextWrapper interface {
	// Get the plugin context for an app plugin request
	PluginContextForApp(ctx context.Context, pluginID string, appSettings *backend.AppInstanceSettings) (context.Context, backend.PluginContext, error)
}

type AppPluginRunnerOptions struct {
	RegisterProxy bool

	DataProxyLogging         bool // from cfg
	SendUserHeader           bool // from cfg
	PluginsAppsSkipVerifyTLS bool // from cfg

	// When this exists, dual write settings will be used
	LegacyStore grafanarest.Storage

	// Direct access to legacy access control (required for proxy)
	AccessControl ac.AccessControl
}

// AppPluginAPIBuilder builds an apiserver for a single app plugin.
type AppPluginAPIBuilder struct {
	manifest        *app.ManifestData
	pluginJSON      plugins.JSONData
	client          PluginClient // will only ever be called with the same plugin id!
	contextProvider PluginContextWrapper
	schemas         map[string]*pluginschema.PluginSchema
	decrypter       decrypt.DecryptService // Used with unified storage
	accessChecker   PluginAccessChecker
	features        featuremgmt.FeatureToggles
	tracer          tracing.Tracer

	// optional configuration
	opts AppPluginRunnerOptions

	// Populated in UpdateAPIGroupInfo
	getter rest.Getter
}

func NewAppPluginAPIBuilder(
	plugin definition.PluginDefinition,
	client PluginClient, // will only ever be called with the same plugin id!
	contextProvider PluginContextWrapper,
	decrypter decrypt.DecryptService, // when not reading legacy
	accessChecker PluginAccessChecker,
	opts AppPluginRunnerOptions, // can change without updating wire :)
	tracer tracing.Tracer, // needed for proxy
	features featuremgmt.FeatureToggles, // needed for proxy
) (*AppPluginAPIBuilder, error) {
	return &AppPluginAPIBuilder{
		pluginJSON:      plugin.JSONData,
		client:          client,
		contextProvider: contextProvider,
		schemas:         plugin.Schemas,
		decrypter:       decrypter,
		accessChecker:   accessChecker,
		opts:            opts,
		features:        features,
		tracer:          tracer,
	}, nil
}

// Called in ST Grafana to register
func RegisterAPIService(
	apiRegistrar builder.APIRegistrar,
	pluginClient plugins.Client, // access to everything
	contextProvider PluginContextWrapper,
	pluginSources sources.Registry,
	pluginSettings pluginsettings.Service,
	accessControl ac.AccessControl,
	decrypter decrypt.DecryptService,
	tracer tracing.Tracer, // needed for proxy
	features featuremgmt.FeatureToggles, // needed for proxy
	cfg *setting.Cfg,
) (*AppPluginAPIBuilder, error) {
	ctx := context.Background()
	getflag := func(f string) bool {
		return openfeature.NewDefaultClient().Boolean(ctx, f, false, openfeature.TransactionContext(ctx))
	}
	if !getflag(featuremgmt.FlagApppluginsRegisterAPIServer) {
		return nil, nil
	}

	// Find all local plugins
	pluginDefs, err := definition.LoadPluginDefinition(ctx, pluginSources, definition.Options{
		Filter: func(jsonData plugins.JSONData) bool {
			if jsonData.Type == plugins.TypeApp {
				// TODO? should we fail more loudly
				if !strings.Contains(jsonData.ID, "-") || strings.Contains(jsonData.ID, ".") || jsonData.ID == "v1" {
					logging.FromContext(ctx).Warn("invalid app plugin id: %s", jsonData.ID)
					return false
				}
				return true
			}
			return false
		},
		Schemas:     true,
		AppManifest: getflag(featuremgmt.FlagApppluginsLoadAppManifest),
	})

	if err != nil {
		return nil, fmt.Errorf("error getting list of app plugins: %w", err)
	}

	var last *AppPluginAPIBuilder
	for _, plugin := range pluginDefs {
		b, err := NewAppPluginAPIBuilder(plugin,
			pluginClient, // scoped to a single plugin!
			contextProvider,
			decrypter,
			NewPluginAccessChecker(accessControl),
			AppPluginRunnerOptions{
				RegisterProxy: getflag(featuremgmt.FlagApppluginsHandleProxyRequests),
				LegacyStore:   NewLegacySettingsStore(plugin.JSONData.ID, pluginSettings),
				AccessControl: accessControl,

				DataProxyLogging:         cfg.DataProxyLogging,
				SendUserHeader:           cfg.SendUserHeader,
				PluginsAppsSkipVerifyTLS: cfg.PluginsAppsSkipVerifyTLS,
			},
			tracer,
			features,
		)
		if err != nil {
			return nil, err
		}

		// HACK... make it work for pyroscope
		if plugin.JSONData.ID == "grafana-pyroscope-app" {
			copy := exampleManifestData
			plugin.Manifest = &copy
		}

		// TODO -- update the constructor with the manifest
		// needed to support MT, but also requires a parallel enterprise PR
		if plugin.Manifest != nil {
			// The served API group is always the plugin id -- schema registration
			// and OpenAPI naming read the group from the manifest, so they would
			// diverge from the storage+samples if a manifest declared its own group.
			manifest := *plugin.Manifest
			manifest.Group = plugin.JSONData.ID
			b.manifest = &manifest

			fmt.Printf("MANIFEST %+v\n", plugin.Manifest)
		}

		apiRegistrar.RegisterAPI(b)
		last = b
	}
	return last, nil
}

// GetGroupVersions returns the served versions, preferred version first.
// The settings kind is registered in every version so it is always reachable.
func (b *AppPluginAPIBuilder) GetGroupVersions() []schema.GroupVersion {
	fallback := []schema.GroupVersion{{
		Group:   b.pluginJSON.ID,
		Version: apppluginV0.VERSION,
	}}
	if b.manifest == nil || len(b.manifest.Versions) == 0 {
		return fallback
	}

	gvs := make([]schema.GroupVersion, 0, len(b.manifest.Versions))
	for _, v := range b.manifest.Versions {
		gv := schema.GroupVersion{
			Group:   b.pluginJSON.ID,
			Version: v.Name,
		}
		if b.manifest.PreferredVersion == v.Name {
			gvs = slices.Insert(gvs, 0, gv)
		} else {
			gvs = append(gvs, gv)
		}
	}
	return gvs
}

func (b *AppPluginAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gvs := b.GetGroupVersions()
	for _, gv := range gvs {
		if err := apppluginV0.AddKnownTypes(scheme, gv); err != nil {
			return err
		}
	}

	if b.manifest != nil {
		registered := map[schema.GroupVersionKind]bool{}
		addKind := func(gvk schema.GroupVersionKind) {
			if registered[gvk] {
				return
			}
			registered[gvk] = true
			scheme.AddKnownTypeWithName(gvk, &unstructured.Unstructured{})
			scheme.AddKnownTypeWithName(gvk.GroupVersion().WithKind(gvk.Kind+"List"), &unstructured.UnstructuredList{})
		}

		// Server-side apply converts objects to the internal ("__internal")
		// hub version when tracking managed fields, so every kind must be
		// registered there as well or apply fails with "no kind registered
		// for the internal version".
		internalGV := schema.GroupVersion{Group: b.manifest.Group, Version: runtime.APIVersionInternal}
		for _, version := range b.manifest.Versions {
			gv := schema.GroupVersion{Group: b.manifest.Group, Version: version.Name}
			for _, r := range version.Kinds {
				addKind(gv.WithKind(r.Kind))
				addKind(internalGV.WithKind(r.Kind))
			}
		}

		// ??? How do CRDs register conversions.
		// Given that the type is always the same, how and where to we convert ???
	}

	return scheme.SetVersionPriority(gvs...)
}

func (b *AppPluginAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	registerSubresourceMetrics(opts.MetricsRegister)

	settingsRI := apppluginV0.SettingsResourceInfo.WithGroupAndShortName(
		b.pluginJSON.ID, b.pluginJSON.ID,
	)

	if opts.StorageOptsRegister == nil {
		return fmt.Errorf("apps require storage opts")
	}
	opts.StorageOptsRegister(settingsRI.GroupResource(), apistore.StorageOptions{
		EnableFolderSupport: false,
		Scheme:              opts.Scheme,
	})

	b.applyDefaultStorageConfig(opts, settingsRI)

	// The settings store is version-independent -- build it once and share the
	// same instance across every version's storage map, k8s style.
	var settingsStorage rest.Storage
	unified, err := grafanaregistry.NewRegistryStore(opts.Scheme, settingsRI, opts.OptsGetter)
	if err != nil {
		return err
	}
	settingsStorage = unified
	if b.opts.LegacyStore != nil && opts.DualWriteBuilder != nil {
		settingsStorage, err = opts.DualWriteBuilder(settingsRI.GroupResource(), b.opts.LegacyStore, unified)
		if err != nil {
			return err
		}
	}
	b.getter = settingsStorage.(rest.Getter)

	defs := loadOpenAPIDefinition(func(name string) spec.Ref {
		return spec.MustCreateRef(name)
	}, b.manifest)

	for _, gv := range b.GetGroupVersions() {
		storage := map[string]rest.Storage{}
		storage[settingsRI.StoragePath()] = settingsStorage

		provider := func(ctx context.Context) (context.Context, backend.PluginContext, error) {
			return b.getPluginContext(ctx, gv.Version)
		}

		storage[settingsRI.StoragePath("health")] = &subHealthREST{
			client:          b.client,
			contextProvider: provider,
		}
		storage[settingsRI.StoragePath("resources")] = &subResourceREST{
			pluginID:        b.pluginJSON.ID,
			client:          b.client,
			contextProvider: provider,
		}
		if len(b.pluginJSON.Routes) > 0 && b.opts.RegisterProxy {
			storage[settingsRI.StoragePath("proxy")] = newProxy(b)
		}

		// Configure storage for manifest defined kinds
		if b.manifest != nil {
			for _, v := range b.manifest.Versions {
				if v.Name != gv.Version {
					continue
				}

				for _, kind := range v.Kinds {
					store, err := newKindStore(gv.WithKind(kind.Kind), kind, &opts, defs)
					if err != nil {
						return err
					}

					resource := store.DefaultQualifiedResource.Resource
					storage[resource] = store

					if store.hasStatus {
						storage[resource+"/status"] = grafanaregistry.NewRegistryStatusStore(opts.Scheme, store.Store)
					}
				}
			}
		}

		apiGroupInfo.VersionedResourcesStorageMap[gv.Version] = storage
	}
	return nil
}

// appPluginSettingsWildcard is a config key that applies to all app plugin settings
// resources when no plugin-specific override exists. Configure it as:
//
//	[unified_storage.app.*-app]
//	dualWriterMode = 1 // or 5
const appPluginSettingsWildcard = "app.*-app"

// applyDefaultStorageConfig injects a wildcard unified storage config entry for this
// plugin's settings resource if no plugin-specific config exists. This allows operators
// to set a single DualWriter mode for all app plugins at once.
func (b *AppPluginAPIBuilder) applyDefaultStorageConfig(opts builder.APIGroupOptions, ri utils.ResourceInfo) {
	if opts.StorageOpts == nil {
		return
	}
	key := ri.GroupResource().String()
	if _, exists := opts.StorageOpts.UnifiedStorageConfig[key]; exists {
		return
	}
	fallback, hasFallback := opts.StorageOpts.UnifiedStorageConfig[appPluginSettingsWildcard]
	if !hasFallback {
		return
	}
	opts.StorageOpts.UnifiedStorageConfig[key] = setting.UnifiedStorageConfig{
		DualWriterMode: fallback.DualWriterMode,
	}
}

func (b *AppPluginAPIBuilder) AllowedV0Alpha1Resources() []string {
	return []string{builder.AllResourcesAllowed}
}
