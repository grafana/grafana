// Package pluginroute builds an HTTP handler for a single app plugin's API group.
package pluginroute

import (
	"context"
	"fmt"
	"maps"
	"net/http"
	"slices"
	"strings"
	"sync"

	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apimachinery/pkg/util/validation"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/authorization/union"
	discoveryendpoint "k8s.io/apiserver/pkg/endpoints/discovery/aggregated"
	"k8s.io/apiserver/pkg/registry/generic"
	genericapiserver "k8s.io/apiserver/pkg/server"
	serverstorage "k8s.io/apiserver/pkg/server/storage"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	clientrest "k8s.io/client-go/rest"
	"k8s.io/kube-openapi/pkg/common"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry/apis/appplugin"
	secret "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	apiserverauthenticator "github.com/grafana/grafana/pkg/services/apiserver/auth/authenticator"
	apiserverauthorizer "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// StorageProvider gets the plugin's own scheme and codecs, since another
// plugin's scheme cannot encode this plugin's manifest kinds.
type StorageProvider func(*runtime.Scheme, serializer.CodecFactory, []schema.GroupVersion) (generic.RESTOptionsGetter, error)

type Options struct {
	PluginInfo       plugins.Info
	Storage          StorageProvider
	PluginClient     appplugin.PluginClient
	ClientV3         appclientv3.Client
	ContextProvider  appplugin.PluginContextWrapper
	Decrypter        decrypt.DecryptService
	AccessChecker    appplugin.PluginAccessChecker
	HybridAPIEnabled bool
	KeysAPIEnabled   bool
	Search           resourcepb.ResourceIndexClient
	Store            resourcepb.ResourceStoreClient
	Runner           appplugin.AppPluginRunnerOptions
	Tracer           tracing.Tracer
	Features         featuremgmt.FeatureToggles
	BuildVersion     string
	MetricsRegister  prometheus.Registerer

	// Legacy settings use the same migration policy as the embedded API server.
	DualWrite      dualwrite.Service
	StorageOpts    *options.StorageOptions
	BuilderMetrics *builder.BuilderMetrics
}

type Handler struct {
	http.Handler
	destroy func()
	once    sync.Once
}

// Destroy releases storage after the caller has stopped serving and drained requests.
func (h *Handler) Destroy() {
	h.once.Do(h.destroy)
}

func APIGroup(m *app.ManifestData) metav1.APIGroup {
	g := metav1.APIGroup{Name: m.Group}
	for _, v := range m.Versions {
		if !v.Served {
			continue
		}
		gv := metav1.GroupVersionForDiscovery{GroupVersion: fmt.Sprintf("%s/%s", g.Name, v.Name), Version: v.Name}
		g.Versions = append(g.Versions, gv)
		if v.Name == m.PreferredVersion {
			g.PreferredVersion = gv
		}
	}

	// When the preferred version is not specified, pick the last non-alpha version
	if g.PreferredVersion.Version == "" && len(g.Versions) > 0 {
		for _, v := range slices.Backward(g.Versions) {
			if !strings.Contains(v.Version, "alpha") {
				g.PreferredVersion = v
				break
			}
		}
		if g.PreferredVersion.Version == "" {
			g.PreferredVersion = g.Versions[len(g.Versions)-1]
		}
	}
	if i := slices.Index(g.Versions, g.PreferredVersion); i > 0 {
		g.Versions = append([]metav1.GroupVersionForDiscovery{g.PreferredVersion}, slices.Delete(g.Versions, i, i+1)...)
	}
	return g
}

// NewHandler installs resources, admission, custom routes and OpenAPI without
// starting a listener or background hooks. The caller must authenticate requests
// and put an identity.Requester in their context before invoking the handler.
func NewHandler(pluginID string, manifest *app.ManifestData, opts Options) (*Handler, error) {
	b, err := NewAPI(pluginID, manifest, opts)
	if err != nil {
		return nil, err
	}
	if opts.Storage == nil {
		return nil, fmt.Errorf("plugin %q: a storage provider is required", pluginID)
	}
	gvs := b.GetGroupVersions()
	if len(gvs) == 0 {
		return nil, fmt.Errorf("plugin %q has no served versions", pluginID)
	}
	group := gvs[0].Group
	scheme := builder.ProvideScheme()
	if err := b.InstallSchema(scheme); err != nil {
		return nil, fmt.Errorf("%s: install schema: %w", group, err)
	}
	codecs := builder.ProvideCodecFactory(scheme)
	getter, err := opts.Storage(scheme, codecs, gvs)
	if err != nil {
		return nil, fmt.Errorf("%s: storage: %w", group, err)
	}
	if getter == nil {
		return nil, fmt.Errorf("%s: storage provider returned no REST options getter", group)
	}
	reg := opts.MetricsRegister
	if reg == nil {
		reg = prometheus.NewRegistry()
	}
	resources := serverstorage.NewResourceConfig()
	resources.EnableVersions(gvs...)
	builders := []builder.APIGroupBuilder{b}
	config := genericapiserver.NewRecommendedConfig(codecs)
	// Complete otherwise derives an address from a listener and exits without one.
	config.ExternalAddress = "localhost:3000"
	config.LoopbackClientConfig = &clientrest.Config{Host: config.ExternalAddress}
	config.EffectiveVersion = builder.GetEffectiveVersion(0, opts.BuildVersion, "", "")
	config.RESTOptionsGetter = getter
	config.AggregatedDiscoveryGroupManager = discoveryendpoint.NewResourceManager("apis")
	config.Authorization.Authorizer, err = union.New(
		union.NamedAuthorizer{AuthorizerName: "impersonation", Authorizer: apiserverauthorizer.NewImpersonationAuthorizer()},
		union.NamedAuthorizer{AuthorizerName: "namespace", Authorizer: apiserverauthorizer.NewNamespaceAuthorizer()},
		union.NamedAuthorizer{AuthorizerName: "plugin", Authorizer: b.GetAuthorizer()},
	)
	if err != nil {
		return nil, fmt.Errorf("%s: authorization: %w", group, err)
	}
	config.Authentication.Authenticator = apiserverauthenticator.NewAuthenticator()
	if err := builder.SetupConfig(scheme, config, builders, opts.BuildVersion,
		builder.GetDefaultBuildHandlerChainFunc, gvs,
		[]common.GetOpenAPIDefinitions{appsdkapiserver.GetCommonOpenAPIDefinitions}, reg, resources); err != nil {
		return nil, fmt.Errorf("%s: setup config: %w", group, err)
	}
	server, err := config.Complete().New(group, genericapiserver.NewEmptyDelegate())
	if err != nil {
		return nil, fmt.Errorf("%s: new server: %w", group, err)
	}
	installed := false
	defer func() {
		if !installed {
			server.Destroy()
		}
	}()

	storageOpts := &options.StorageOptions{}
	if opts.StorageOpts != nil {
		*storageOpts = *opts.StorageOpts
	}
	// Installing settings adds a per-plugin default; do not mutate shared config.
	storageOpts.UnifiedStorageConfig = maps.Clone(storageOpts.UnifiedStorageConfig)
	if storageOpts.UnifiedStorageConfig == nil {
		storageOpts.UnifiedStorageConfig = map[string]setting.UnifiedStorageConfig{}
	}
	var dualWriteBuilder grafanarest.DualWriteBuilder
	if opts.DualWrite != nil && opts.Runner.LegacyStore != nil {
		dualWriteBuilder = builder.NewDualWriteBuilder(scheme, storageOpts, opts.DualWrite, opts.BuilderMetrics)
	}
	info := genericapiserver.NewDefaultAPIGroupInfo(group, scheme, metav1.ParameterCodec, codecs)
	if err := b.UpdateAPIGroupInfo(&info, builder.APIGroupOptions{
		Scheme: scheme, OptsGetter: getter, MetricsRegister: reg,
		StorageOpts:      storageOpts,
		DualWriteBuilder: dualWriteBuilder,
	}); err != nil {
		return nil, fmt.Errorf("%s: build group: %w", group, err)
	}
	info.NegotiatedSerializer = grafanarest.DefaultNoProtobufNegotiatedSerializer(codecs)
	if err := server.InstallAPIGroup(&info); err != nil {
		return nil, fmt.Errorf("%s: install group: %w", group, err)
	}
	if err := builder.AugmentWebServicesWithCustomRoutes(server.Handler.GoRestfulContainer, builders, reg, resources); err != nil {
		return nil, fmt.Errorf("%s: install custom routes: %w", group, err)
	}
	// OpenAPI is installed by PrepareRun, even though this server is never Run.
	server.PrepareRun()
	installed = true
	return &Handler{Handler: server.Handler, destroy: server.Destroy}, nil
}

// PluginAPI supplies the schema and storage installation for a routed plugin.
type PluginAPI interface {
	builder.APIGroupBuilder
	builder.APIGroupVersionsProvider
	GetAuthorizer() authorizer.Authorizer
}

// NewAPI builds the API for one plugin manifest.
// It is also used by offline OpenAPI generation so discovery matches the router.
func NewAPI(pluginID string, manifest *app.ManifestData, opts Options) (PluginAPI, error) {
	if manifest == nil {
		return nil, fmt.Errorf("missing manifest")
	}

	if manifest.IsEmpty() {
		return nil, fmt.Errorf("plugin %q has an empty app manifest", pluginID)
	}
	group := manifest.Group
	if !strings.HasSuffix(group, ".ext.grafana.app") || len(validation.IsDNS1123Subdomain(group)) > 0 {
		return nil, fmt.Errorf("plugin %q: invalid manifest group %q: must be a DNS name ending in .ext.grafana.app", pluginID, group)
	}

	if opts.AccessChecker == nil {
		opts.AccessChecker = func(context.Context, identity.Requester, string) (authorizer.Decision, string, error) {
			return authorizer.DecisionDeny, "no plugin access checker is configured", nil
		}
	}
	if opts.Tracer == nil {
		opts.Tracer = tracing.NewNoopTracerService()
	}
	if opts.Features == nil {
		opts.Features = featuremgmt.WithFeatures()
	}
	return &manifestBuilder{
		group:         manifest.Group,
		manifest:      manifest,
		pluginID:      pluginID,
		clientV3:      opts.ClientV3,
		decrypter:     newSecureValueLookup(opts.Decrypter),
		accessChecker: opts.AccessChecker,
		search:        opts.Search,
		store:         opts.Store,
		tracer:        opts.Tracer,
		opts:          opts,
		kindPolicies:  kindPolicies(manifest),
	}, nil
}

func UnifiedStorage(client resource.ResourceClient, secrets secret.InlineSecureValueSupport, configProvider apistore.RestConfigProvider) StorageProvider {
	return func(_ *runtime.Scheme, codecs serializer.CodecFactory, gvs []schema.GroupVersion) (generic.RESTOptionsGetter, error) {
		if client == nil {
			return nil, fmt.Errorf("a unified storage client is required")
		}
		return apistore.NewRESTOptionsGetterForClient(client, secrets,
			storagebackend.Config{Codec: codecs.LegacyCodec(gvs...)}, configProvider, nil), nil
	}
}
