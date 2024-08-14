package builder

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	openapinamer "k8s.io/apiserver/pkg/endpoints/openapi"
	"k8s.io/apiserver/pkg/registry/generic"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/util/openapi"
	utilversion "k8s.io/apiserver/pkg/util/version"
	k8sscheme "k8s.io/client-go/kubernetes/scheme"
	k8stracing "k8s.io/component-base/tracing"
	"k8s.io/kube-openapi/pkg/common"

	"github.com/grafana/grafana/pkg/web"

	"github.com/grafana/grafana/pkg/apiserver/endpoints/filters"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
)

// TODO: this is a temporary hack to make rest.Connecter work with resource level routes
var pathRewriters = []filters.PathRewriter{
	{
		Pattern: regexp.MustCompile(`(/apis/scope.grafana.app/v0alpha1/namespaces/.*/)find/(.*)$`),
		ReplaceFunc: func(matches []string) string {
			return matches[1] + matches[2] + "/name" // connector requires a name
		},
	},
	{
		Pattern: regexp.MustCompile(`(/apis/query.grafana.app/v0alpha1/namespaces/.*/query$)`),
		ReplaceFunc: func(matches []string) string {
			return matches[1] + "/name" // connector requires a name
		},
	},
}

func SetupConfig(
	scheme *runtime.Scheme,
	serverConfig *genericapiserver.RecommendedConfig,
	builders []APIGroupBuilder,
	buildTimestamp int64,
	buildVersion string,
	buildCommit string,
	buildBranch string,
	optionalMiddlewares ...web.Middleware,
) error {
	defsGetter := GetOpenAPIDefinitions(builders)
	serverConfig.OpenAPIConfig = genericapiserver.DefaultOpenAPIConfig(
		openapi.GetOpenAPIDefinitionsWithoutDisabledFeatures(defsGetter),
		openapinamer.NewDefinitionNamer(scheme, k8sscheme.Scheme))

	serverConfig.OpenAPIV3Config = genericapiserver.DefaultOpenAPIV3Config(
		openapi.GetOpenAPIDefinitionsWithoutDisabledFeatures(defsGetter),
		openapinamer.NewDefinitionNamer(scheme, k8sscheme.Scheme))

	// Add the custom routes to service discovery
	serverConfig.OpenAPIV3Config.PostProcessSpec = getOpenAPIPostProcessor(buildVersion, builders)
	serverConfig.OpenAPIV3Config.GetOperationIDAndTagsFromRoute = func(r common.Route) (string, []string, error) {
		tags := []string{}
		prop, ok := r.Metadata()["x-kubernetes-group-version-kind"]
		if ok {
			gvk, ok := prop.(metav1.GroupVersionKind)
			if ok && gvk.Kind != "" {
				tags = append(tags, gvk.Kind)
			}
		}
		return r.OperationName(), tags, nil
	}

	// Set the swagger build versions
	serverConfig.OpenAPIConfig.Info.Version = buildVersion
	serverConfig.OpenAPIV3Config.Info.Version = buildVersion

	serverConfig.SkipOpenAPIInstallation = false
	serverConfig.BuildHandlerChainFunc = func(delegateHandler http.Handler, c *genericapiserver.Config) http.Handler {
		// Call DefaultBuildHandlerChain on the main entrypoint http.Handler
		// See https://github.com/kubernetes/apiserver/blob/v0.28.0/pkg/server/config.go#L906
		// DefaultBuildHandlerChain provides many things, notably CORS, HSTS, cache-control, authz and latency tracking
		requestHandler, err := getAPIHandler(
			delegateHandler,
			c.LoopbackClientConfig,
			builders)
		if err != nil {
			panic(fmt.Sprintf("could not build handler chain func: %s", err.Error()))
		}

		// Needs to run last in request chain to function as expected, hence we register it first.
		handler := filters.WithTracingHTTPLoggingAttributes(requestHandler)
		// filters.WithRequester needs to be after the K8s chain because it depends on the K8s user in context
		handler = filters.WithRequester(handler)
		handler = genericapiserver.DefaultBuildHandlerChain(handler, c)

		// If optional middlewares include auth function, they need to happen before DefaultBuildHandlerChain
		if len(optionalMiddlewares) > 0 {
			for _, m := range optionalMiddlewares {
				handler = m(handler)
			}
		}

		handler = filters.WithAcceptHeader(handler)
		handler = filters.WithPathRewriters(handler, pathRewriters)
		handler = k8stracing.WithTracing(handler, serverConfig.TracerProvider, "KubernetesAPI")
		// Configure filters.WithPanicRecovery to not crash on panic
		utilruntime.ReallyCrash = false

		return handler
	}

	serverConfig.EffectiveVersion = utilversion.DefaultKubeEffectiveVersion()

	return nil
}

type ServerLockService interface {
	LockExecuteAndRelease(ctx context.Context, actionName string, maxInterval time.Duration, fn func(ctx context.Context)) error
}

func InstallAPIs(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory,
	server *genericapiserver.GenericAPIServer,
	optsGetter generic.RESTOptionsGetter,
	builders []APIGroupBuilder,
	storageOpts *options.StorageOptions,
	reg prometheus.Registerer,
	kvStore grafanarest.NamespacedKVStore,
	serverLock ServerLockService,
) error {
	// dual writing is only enabled when the storage type is not legacy.
	// this is needed to support setting a default RESTOptionsGetter for new APIs that don't
	// support the legacy storage type.
	var dualWrite grafanarest.DualWriteBuilder
	if storageOpts.StorageType != options.StorageTypeLegacy {
		dualWrite = func(gr schema.GroupResource, legacy grafanarest.LegacyStorage, storage grafanarest.Storage) (grafanarest.Storage, error) {
			key := gr.String() // ${resource}.{group} eg playlists.playlist.grafana.app

			// Get the option from custom.ini/command line
			// when missing this will default to mode zero (legacy only)
			mode := storageOpts.DualWriterDesiredModes[key]

			// Moving from one version to the next can only happen after the previous step has
			// successfully synchronized.
			currentMode, err := grafanarest.SetDualWritingMode(context.Background(), kvStore, legacy, storage, key, mode, reg)
			if err != nil {
				return nil, err
			}
			switch currentMode {
			case grafanarest.Mode0:
				return legacy, nil
			case grafanarest.Mode4:
				return storage, nil
			default:
			}
			return grafanarest.NewDualWriter(currentMode, legacy, storage, reg, key), nil
		}
	}

	for _, b := range builders {
		g, err := b.GetAPIGroupInfo(scheme, codecs, optsGetter, dualWrite)
		if err != nil {
			return err
		}
		if g == nil || len(g.PrioritizedVersions) < 1 {
			continue
		}
		err = server.InstallAPIGroup(g)
		if err != nil {
			return err
		}
	}
	return nil
}
