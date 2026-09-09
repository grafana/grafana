// Package pluginopenapi renders the OpenAPI v3 spec an app plugin's API server
// serves, without starting Grafana.
//
// The spec is built from the same builder, scheme, and post-processors the
// running server uses. Runtime dependencies such as storage, plugin clients,
// and access control are stubbed, so rendering does not connect to a database
// or plugin backend.
package pluginopenapi

import (
	"fmt"
	"slices"
	"strings"

	restful "github.com/emicklei/go-restful/v3"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	discoveryendpoint "k8s.io/apiserver/pkg/endpoints/discovery/aggregated"
	genericapiserver "k8s.io/apiserver/pkg/server"
	serverstorage "k8s.io/apiserver/pkg/server/storage"
	clientrest "k8s.io/client-go/rest"
	"k8s.io/kube-openapi/pkg/builder3"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/common/restfuladapter"
	"k8s.io/kube-openapi/pkg/spec3"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/registry/apis/appplugin"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

// Options are the parts of a running server's configuration that are visible in
// the generated spec.
type Options struct {
	// BuildVersion stamps the spec info version, the same way the server does.
	BuildVersion string

	// RegisterProxy mirrors the appplugins.handleProxyRequests feature toggle,
	// which adds the plugin proxy subresource.
	RegisterProxy bool
}

// Versions returns the versions the plugin serves, preferred version first.
// Every version is renderable, including the settings version a manifest never
// mentions.
func Versions(plugin definition.PluginDefinition, opts Options) ([]string, error) {
	b, err := newBuilder(plugin, opts)
	if err != nil {
		return nil, err
	}
	return servedVersions(b.GetGroupVersions()), nil
}

// newBuilder uses offline substitutes for dependencies that are required to
// register routes but are only called while serving requests.
func newBuilder(plugin definition.PluginDefinition, opts Options) (*appplugin.AppPluginAPIBuilder, error) {
	if plugin.JSONData.ID == "" {
		return nil, fmt.Errorf("plugin is missing an id")
	}
	return appplugin.NewAppPluginAPIBuilder(
		plugin,
		nil, // only used when serving health and resource subresource requests
		offlineClientV3{},
		nil, // plugin context is only needed to call the backend
		nil, // no decrypter: reading secrets is a request time concern
		appplugin.NewPluginAccessChecker(nil),
		offlineSearchClient{},
		appplugin.AppPluginRunnerOptions{
			RegisterProxy: opts.RegisterProxy,
			// Generated specs always enable search and trash route registration.
			// searchroutes still applies its per-kind eligibility rules.
			SearchAPIEnabled: true,
			TrashAPIEnabled:  true,
		},
		tracing.NewNoopTracerService(),
		featuremgmt.WithFeatures(),
	)
}

// Build returns the OpenAPI v3 spec for one app plugin group version.
func Build(plugin definition.PluginDefinition, version string, opts Options) (*spec3.OpenAPI, error) {
	b, err := newBuilder(plugin, opts)
	if err != nil {
		return nil, err
	}

	// All served versions share the plugin's API group. A manifest can override
	// the default group derived from the plugin ID.
	gvs := b.GetGroupVersions()
	group := gvs[0].Group
	if version == "" {
		version = gvs[0].Version
	}
	gv := schema.GroupVersion{Group: group, Version: version}
	if !slices.Contains(gvs, gv) {
		return nil, fmt.Errorf("plugin %s does not serve version %q (available: %s)",
			plugin.JSONData.ID, version, strings.Join(servedVersions(gvs), ", "))
	}

	scheme := builder.ProvideScheme()
	if err := b.InstallSchema(scheme); err != nil {
		return nil, err
	}
	codecs := builder.ProvideCodecFactory(scheme)

	builders := []builder.APIGroupBuilder{b}
	apiResourceConfig := serverstorage.NewResourceConfig()
	apiResourceConfig.EnableVersions(gvs...)

	serverConfig := genericapiserver.NewRecommendedConfig(codecs)
	// Complete() derives the external address from the secure serving port,
	// which this server does not have, and would exit the process without one.
	serverConfig.ExternalAddress = "localhost:3000"
	serverConfig.LoopbackClientConfig = &clientrest.Config{Host: serverConfig.ExternalAddress}
	serverConfig.EffectiveVersion = builder.GetEffectiveVersion(0, opts.BuildVersion, "", "")
	serverConfig.RESTOptionsGetter = appinstaller.NewNoopRESTOptionsGetter()
	serverConfig.AggregatedDiscoveryGroupManager = discoveryendpoint.NewResourceManager("apis")

	if err := builder.SetupConfig(
		scheme,
		serverConfig,
		builders,
		opts.BuildVersion,
		builder.ProvideDefaultBuildHandlerChainFuncFromBuilders(),
		gvs,
		// The server adds these through appinstaller.BuildOpenAPIDefGetter. They
		// replace shared metadata definitions used by app plugin schemas.
		[]common.GetOpenAPIDefinitions{appsdkapiserver.GetCommonOpenAPIDefinitions},
		prometheus.NewRegistry(),
		apiResourceConfig,
	); err != nil {
		return nil, err
	}

	server, err := serverConfig.Complete().New("plugin-openapi", genericapiserver.NewEmptyDelegate())
	if err != nil {
		return nil, err
	}

	// The paths in the spec come from the installed resource handlers, so the
	// group has to be installed even though no request is ever served.
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(group, scheme, metav1.ParameterCodec, codecs)
	if err := b.UpdateAPIGroupInfo(&apiGroupInfo, builder.APIGroupOptions{
		Scheme:              scheme,
		OptsGetter:          serverConfig.RESTOptionsGetter,
		MetricsRegister:     prometheus.NewRegistry(),
		StorageOptsRegister: func(schema.GroupResource, apistore.StorageOptions) {},
	}); err != nil {
		return nil, err
	}
	apiGroupInfo.NegotiatedSerializer = grafanarest.DefaultNoProtobufNegotiatedSerializer(codecs)
	if err := server.InstallAPIGroup(&apiGroupInfo); err != nil {
		return nil, err
	}

	return buildSpec(server, serverConfig, gv)
}

// buildSpec renders one group version using the registered web services, as the
// server's /openapi/v3 endpoint does.
func buildSpec(
	server *genericapiserver.GenericAPIServer,
	serverConfig *genericapiserver.RecommendedConfig,
	gv schema.GroupVersion,
) (*spec3.OpenAPI, error) {
	root := "/apis/" + gv.String()
	var services []*restful.WebService
	for _, ws := range server.Handler.GoRestfulContainer.RegisteredWebServices() {
		if ws.RootPath() == root {
			services = append(services, ws)
		}
	}
	if len(services) == 0 {
		return nil, fmt.Errorf("no resources are served under %s", root)
	}

	return builder3.BuildOpenAPISpecFromRoutes(
		restfuladapter.AdaptWebServices(services), serverConfig.OpenAPIV3Config)
}

func servedVersions(gvs []schema.GroupVersion) []string {
	out := make([]string, 0, len(gvs))
	for _, gv := range gvs {
		out = append(out, gv.Version)
	}
	return out
}
