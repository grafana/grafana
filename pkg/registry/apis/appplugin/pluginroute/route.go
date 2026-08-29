// Package pluginroute serves one app plugin's API group in process, as a
// router.Backend.
//
// This is the router's plugin mode (RouteBackendSpecMode "plugin"): unlike
// forward mode, which reverse proxies a group to an API server that already
// exists, there is no server to proxy to here. The group is assembled from the
// plugin's app manifest -- kinds, custom routes, admission -- into a
// GenericAPIServer whose handler the router serves directly.
package pluginroute

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"

	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/authentication/authenticator"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	discoveryendpoint "k8s.io/apiserver/pkg/endpoints/discovery/aggregated"
	"k8s.io/apiserver/pkg/registry/generic"
	genericapiserver "k8s.io/apiserver/pkg/server"
	serverstorage "k8s.io/apiserver/pkg/server/storage"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	clientrest "k8s.io/client-go/rest"
	"k8s.io/kube-openapi/pkg/common"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/registry/apis/appplugin"
	secret "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/router"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	apiserverauthenticator "github.com/grafana/grafana/pkg/services/apiserver/auth/authenticator"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Options carries everything the served group needs that the plugin definition
// does not: the fingerprint of the config it was built from, and the
// collaborators its request paths reach.
type Options struct {
	// ResourceVersion fingerprints the config this backend was built from. The
	// router compares it to decide whether a group needs rebuilding, and keys
	// its discovery and OpenAPI caches on it, so it must change whenever the
	// plugin definition or the route config does.
	ResourceVersion string

	// BuildVersion stamps the OpenAPI info version, as on any Grafana server.
	BuildVersion string

	// Storage builds where this group's manifest kinds and plugin settings are
	// stored. Required: without it the resource handlers cannot be installed.
	Storage StorageProvider

	// ClientV3 is the plugin's protocol v3 client, reached for custom routes,
	// admission and conversion. Required: a manifest kind that declares
	// admission is refused a nil client.
	ClientV3 v3.ClientV3

	// PluginClient serves the settings subresources (health, resources) and, if
	// enabled, the proxy. Optional; those subresources fail without it.
	PluginClient appplugin.PluginClient

	// ContextProvider builds the backend.PluginContext those subresources send.
	ContextProvider appplugin.PluginContextWrapper

	// Decrypter reads secure values out of unified storage. Optional.
	Decrypter decrypt.DecryptService

	// AccessControl decides whether a caller may reach this plugin at all. A nil
	// value denies every request, so supply one unless Authorizer replaces the
	// group's authorizer outright.
	AccessControl ac.AccessControl

	// Authorizer replaces the group's own authorizer, which checks plugin app
	// access and then the kind's scope. Optional -- prefer leaving it unset.
	Authorizer authorizer.Authorizer

	// Authenticators resolve the caller from the request itself. They are tried
	// after the identity already on the request context, which is where a
	// Grafana requester normally comes from -- see Load on why a caller
	// terminating its own authentication has to put it there rather than rely
	// on one of these. A request nothing authenticates is answered 401.
	Authenticators []authenticator.Request

	// Search is the index behind each kind's /search and /trash routes. The
	// routes are not served without it.
	Search resourcepb.ResourceIndexClient

	// SearchAPIEnabled and TrashAPIEnabled mirror the apiserver settings of the
	// same name: whether the generic search endpoints are served at all.
	SearchAPIEnabled bool
	TrashAPIEnabled  bool

	// RegisterProxy mirrors the appplugins.handleProxyRequests toggle, which
	// adds the plugin proxy subresource.
	RegisterProxy bool

	// Tracer and Features are needed by the proxy subresource.
	Tracer   tracing.Tracer
	Features featuremgmt.FeatureToggles

	// MetricsRegister collects the group's subresource and handler chain
	// metrics. One registry can be shared by every group in the process --
	// see handlerChainRegisterer for what that takes.
	MetricsRegister prometheus.Registerer

	// ExternalAddress is the host the server reports as its own, in the
	// loopback client config and in OpenAPI. It is never dialed: nothing here
	// calls back into itself.
	ExternalAddress string
}

// Backend serves one app plugin's API group. It implements router.Backend.
type Backend struct {
	group    string
	manifest app.ManifestData
	builder  *appplugin.AppPluginAPIBuilder
	opts     Options

	// destroy releases the storage the last Load installed. Storage outlives
	// the handler, so it cannot be dropped with it -- see Destroy.
	destroy func()
}

var _ router.Backend = (*Backend)(nil)

// New builds the backend for one app plugin. It does not stand the group up;
// Load does that.
//
// The plugin must carry a manifest: it is what says which versions and kinds
// the group has, and the router advertises the group from it. A plugin without
// one still serves its settings API in Grafana itself, but there is nothing
// there for the router to route.
func New(plugin definition.PluginDefinition, opts Options) (*Backend, error) {
	if plugin.Manifest == nil || plugin.Manifest.IsEmpty() {
		return nil, fmt.Errorf("plugin %q has no app manifest", plugin.JSONData.ID)
	}
	if opts.Storage == nil {
		return nil, fmt.Errorf("plugin %q: a StorageProvider is required to serve its kinds", plugin.JSONData.ID)
	}
	if opts.ResourceVersion == "" {
		return nil, fmt.Errorf("plugin %q: a resource version is required", plugin.JSONData.ID)
	}

	b, err := appplugin.NewAppPluginAPIBuilder(
		plugin,
		opts.PluginClient,
		opts.ClientV3,
		opts.ContextProvider,
		opts.Decrypter,
		accessChecker(opts.AccessControl),
		opts.Search,
		appplugin.AppPluginRunnerOptions{
			RegisterProxy:    opts.RegisterProxy,
			AccessControl:    opts.AccessControl,
			SearchAPIEnabled: opts.SearchAPIEnabled,
			TrashAPIEnabled:  opts.TrashAPIEnabled,

			// Legacy settings storage is a single-tenant Grafana concern: it
			// reads the plugin_setting table through the SQL store this process
			// does not have. The router serves settings from unified storage.
			LegacyStore: nil,
		},
		tracerOrNoop(opts.Tracer),
		featuresOrEmpty(opts.Features),
	)
	if err != nil {
		return nil, err
	}

	gvs := b.GetGroupVersions()
	if len(gvs) == 0 {
		return nil, fmt.Errorf("plugin %q serves no versions", plugin.JSONData.ID)
	}

	return &Backend{
		group:    gvs[0].Group,
		manifest: servedManifest(*plugin.Manifest, gvs),
		builder:  b,
		opts:     opts,
	}, nil
}

// Group is the API group this backend owns, every version of it.
func (b *Backend) Group() string { return b.group }

// RV fingerprints the config this backend was built from.
func (b *Backend) RV() string { return b.opts.ResourceVersion }

// Manifest describes the group to the router, which synthesizes /apis and the
// /openapi/v3 index from it. It is the plugin's manifest normalized to what is
// actually served -- see servedManifest.
func (b *Backend) Manifest() app.ManifestData { return b.manifest }

// Load assembles the group into a GenericAPIServer and returns its handler.
//
// The server is built but never run: the router owns the listener, and this
// handler is mounted under it. PrepareRun is still called, because that is what
// installs the /openapi/v3 endpoints the router proxies to this backend.
//
// The handler expects the caller to have resolved the caller's identity into
// the request context (identity.WithRequester) before the request reaches it,
// the way Grafana's own HTTP middleware does ahead of its API server. It has to
// happen outside this handler, not in one of Options.Authenticators: the group
// is authorized inside the Kubernetes handler chain, which runs before the
// filter that maps a Kubernetes user onto a Grafana requester, so an identity
// that only arrives with authentication is not there yet when the group's
// authorizer looks for it.
func (b *Backend) Load(ctx context.Context) (http.Handler, error) {
	gvs := b.builder.GetGroupVersions()

	scheme := builder.ProvideScheme()
	if err := b.builder.InstallSchema(scheme); err != nil {
		return nil, fmt.Errorf("%s: install schema: %w", b.group, err)
	}
	codecs := builder.ProvideCodecFactory(scheme)

	optsGetter, err := b.opts.Storage(scheme, codecs, gvs)
	if err != nil {
		return nil, fmt.Errorf("%s: storage: %w", b.group, err)
	}

	apiResourceConfig := serverstorage.NewResourceConfig()
	apiResourceConfig.EnableVersions(gvs...)

	serverConfig := genericapiserver.NewRecommendedConfig(codecs)
	// Complete() derives the external address from the secure serving port,
	// which this server does not have, and exits the process without one.
	serverConfig.ExternalAddress = b.externalAddress()
	serverConfig.LoopbackClientConfig = &clientrest.Config{Host: serverConfig.ExternalAddress}
	serverConfig.EffectiveVersion = builder.GetEffectiveVersion(0, b.opts.BuildVersion, "", "")
	serverConfig.RESTOptionsGetter = optsGetter
	// Aggregated discovery is a per-server document, and this server holds one
	// group. The router synthesizes the discovery across groups itself, so this
	// manager only ever describes this one -- but SetupConfig registers the
	// group's version priorities on it, so it has to exist.
	serverConfig.AggregatedDiscoveryGroupManager = discoveryendpoint.NewResourceManager("apis")
	serverConfig.Authorization.Authorizer = b.authorizer()
	// The requester on the request context first, then anything the caller
	// added -- the same union a Grafana server authenticates with.
	serverConfig.Authentication.Authenticator = apiserverauthenticator.NewAuthenticator(b.opts.Authenticators...)

	reg := b.opts.MetricsRegister
	if reg == nil {
		reg = prometheus.NewRegistry()
	}

	if err := builder.SetupConfig(
		scheme,
		serverConfig,
		[]builder.APIGroupBuilder{b.builder},
		b.opts.BuildVersion,
		replacingHandlerChainFunc(),
		gvs,
		// Replaces some of the shared meta definitions; a Grafana server always
		// installs these, so a group served here has to have them too or its
		// spec describes different types than the same plugin does in Grafana.
		[]common.GetOpenAPIDefinitions{appsdkapiserver.GetCommonOpenAPIDefinitions},
		reg,
		apiResourceConfig,
	); err != nil {
		return nil, fmt.Errorf("%s: setup config: %w", b.group, err)
	}

	server, err := serverConfig.Complete().New(b.group, genericapiserver.NewEmptyDelegate())
	if err != nil {
		return nil, fmt.Errorf("%s: new server: %w", b.group, err)
	}

	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(b.group, scheme, metav1.ParameterCodec, codecs)
	if err := b.builder.UpdateAPIGroupInfo(&apiGroupInfo, builder.APIGroupOptions{
		Scheme:              scheme,
		OptsGetter:          serverConfig.RESTOptionsGetter,
		MetricsRegister:     reg,
		StorageOptsRegister: storageOptsRegister(serverConfig.RESTOptionsGetter),
	}); err != nil {
		server.Destroy()
		return nil, fmt.Errorf("%s: build group: %w", b.group, err)
	}
	// After NewDefaultAPIGroupInfo, which sets the codecs back: protobuf is not
	// negotiable for these kinds, which are served unstructured.
	apiGroupInfo.NegotiatedSerializer = grafanarest.DefaultNoProtobufNegotiatedSerializer(codecs)

	if err := server.InstallAPIGroup(&apiGroupInfo); err != nil {
		server.Destroy()
		return nil, fmt.Errorf("%s: install group: %w", b.group, err)
	}

	// Installs the OpenAPI v3 endpoints -- which the router proxies to this
	// backend -- and the health endpoints, on the handler. It starts nothing;
	// Run does that, and is never called here. Post start hooks are not run
	// either: nothing this group registers one, and a hook's goroutines would
	// outlive the handler, since the router replaces a group's handler whenever
	// its config changes with no way to tell a hook to stop.
	server.PrepareRun()

	b.destroy = server.Destroy
	return server.Handler, nil
}

// Destroy releases the storage the last Load installed.
//
// The router does not call this yet: it has no teardown seam, and closing a
// group's storage while requests are still in flight would cut them (see the
// draining note in pkg/router/AGENTS.md). Until it does, a rebuilt group leaks
// its predecessor's storage, so callers that rebuild backends themselves should
// call this on the one they are replacing, once it is no longer serving.
func (b *Backend) Destroy() {
	if b.destroy != nil {
		b.destroy()
		b.destroy = nil
	}
}

// authorizer is the group's own authorizer -- plugin app access, then the
// kind's scope -- unless the caller replaced it.
func (b *Backend) authorizer() authorizer.Authorizer {
	if b.opts.Authorizer != nil {
		return b.opts.Authorizer
	}
	return b.builder.GetAuthorizer()
}

// accessChecker decides whether a caller may reach this plugin at all.
//
// With no access control to ask, it refuses. The alternative is not "allow":
// the checker is called on every request to the group, and a nil ac.AccessControl
// would be dereferenced there rather than answered.
func accessChecker(accessControl ac.AccessControl) appplugin.PluginAccessChecker {
	if accessControl == nil {
		return func(context.Context, identity.Requester, string) (authorizer.Decision, string, error) {
			return authorizer.DecisionDeny, "no access control is configured", nil
		}
	}
	return appplugin.NewPluginAccessChecker(accessControl)
}

func (b *Backend) externalAddress() string {
	if b.opts.ExternalAddress != "" {
		return b.opts.ExternalAddress
	}
	return "localhost:3000"
}

// replacingHandlerChainFunc builds the Grafana handler chain over a registerer
// that tolerates re-registration.
//
// It has to happen here rather than on the registerer passed to SetupConfig,
// because SetupConfig labels that registerer per server before handing it to
// the chain, and the wrapper it labels with reports an already-registered
// collector unwrapped -- so unregistering it underneath the wrapper never finds
// what the registry actually holds. Wrapping the labelled registerer is the
// only level where the collector matches.
func replacingHandlerChainFunc() builder.BuildHandlerChainFuncFromBuilders {
	return func(builders []builder.APIGroupBuilder, reg prometheus.Registerer) builder.BuildHandlerChainFunc {
		if reg != nil {
			reg = replacingRegisterer{reg}
		}
		return builder.GetDefaultBuildHandlerChainFunc(builders, reg)
	}
}

// replacingRegisterer registers a collector over any collector already
// registered under the same name and labels, rather than failing.
//
// The handler chain builds its own collectors, under a fixed name, and
// registers them with promauto -- which panics rather than returns when the
// registry refuses one. Two things in this package's life do exactly that: a
// second group loading onto the registry the first one shares, and a group
// being rebuilt when its config changes. Neither may take the router's process
// down, and both are the same registration.
//
// What it costs: the chain collector belongs to whichever group loaded last,
// and an earlier chain's observations go to a collector the registry no longer
// holds. Today that is only the watch establishment histogram, and the router
// proxies no watch requests at all (see pkg/router/AGENTS.md, "Scope"), so
// nothing observes it. Revisit this if the chain ever registers a collector
// that records ordinary requests -- it would need a per-group label that does
// not collide with the group label the collector already carries.
type replacingRegisterer struct {
	prometheus.Registerer
}

func (r replacingRegisterer) Register(c prometheus.Collector) error {
	err := r.Registerer.Register(c)
	var existing prometheus.AlreadyRegisteredError
	if errors.As(err, &existing) {
		r.Unregister(existing.ExistingCollector)
		return r.Registerer.Register(c)
	}
	return err
}

func (r replacingRegisterer) MustRegister(collectors ...prometheus.Collector) {
	for _, c := range collectors {
		if err := r.Register(c); err != nil {
			panic(err)
		}
	}
}

// StorageProvider builds the storage a group's resources are served from, for
// the scheme that group was installed into.
//
// It is a function rather than a ready RESTOptionsGetter because each group
// gets its own scheme, and a getter carries the codec its stored objects are
// encoded with. A codec built from one group's scheme cannot encode another
// group's kinds -- the scheme it converts through has never heard of them -- so
// one getter cannot be shared across the groups a process serves, the way it is
// in a Grafana server, where every group shares one scheme.
type StorageProvider func(scheme *runtime.Scheme, codecs serializer.CodecFactory, gvs []schema.GroupVersion) (generic.RESTOptionsGetter, error)

// UnifiedStorage serves every group from one unified storage client, each with
// the codec for its own scheme.
func UnifiedStorage(client resource.ResourceClient, secrets secret.InlineSecureValueSupport) StorageProvider {
	return func(_ *runtime.Scheme, codecs serializer.CodecFactory, gvs []schema.GroupVersion) (generic.RESTOptionsGetter, error) {
		if client == nil {
			return nil, fmt.Errorf("a unified storage client is required")
		}
		return apistore.NewRESTOptionsGetterForClient(client, secrets,
			storagebackend.Config{Codec: codecs.LegacyCodec(gvs...)}, nil, nil), nil
	}
}

// storageOptsRegister records each resource's storage options on the getter
// that will serve it. Unlike a Grafana server, this one has exactly one getter
// and no wildcard config to fall back on, so a getter that cannot take options
// simply gets none -- the resources still install, with the defaults.
func storageOptsRegister(getter generic.RESTOptionsGetter) apistore.StorageOptionsRegister {
	if register, ok := getter.(interface {
		RegisterOptions(schema.GroupResource, apistore.StorageOptions)
	}); ok {
		return register.RegisterOptions
	}
	return func(schema.GroupResource, apistore.StorageOptions) {}
}

// servedManifest normalizes a plugin's manifest to what the group actually
// serves, because that is what the router advertises it as.
//
// Two things differ from the manifest as written. The group is the group the
// plugin is served under, which falls back to the plugin id when the manifest
// declares none -- otherwise the router would advertise a group with no name.
// And the settings version is added when the manifest does not mention it,
// because every app plugin serves its settings API whether or not the manifest
// knows about it; leaving it out would keep it out of /apis and out of the
// OpenAPI index, while the group still served it.
func servedManifest(manifest app.ManifestData, gvs []schema.GroupVersion) app.ManifestData {
	out := manifest
	out.Group = gvs[0].Group
	out.PreferredVersion = gvs[0].Version

	out.Versions = make([]app.ManifestVersion, 0, len(gvs))
	for _, gv := range gvs {
		idx := slices.IndexFunc(manifest.Versions, func(v app.ManifestVersion) bool {
			return v.Name == gv.Version
		})
		if idx < 0 {
			out.Versions = append(out.Versions, app.ManifestVersion{Name: gv.Version, Served: true})
			continue
		}
		version := manifest.Versions[idx]
		version.Served = true
		out.Versions = append(out.Versions, version)
	}
	return out
}

func tracerOrNoop(tracer tracing.Tracer) tracing.Tracer {
	if tracer == nil {
		return tracing.NewNoopTracerService()
	}
	return tracer
}

func featuresOrEmpty(features featuremgmt.FeatureToggles) featuremgmt.FeatureToggles {
	if features == nil {
		return featuremgmt.WithFeatures()
	}
	return features
}
