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
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/generic"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/util/openapi"
	k8sscheme "k8s.io/client-go/kubernetes/scheme"
	k8stracing "k8s.io/component-base/tracing"
	utilversion "k8s.io/component-base/version"
	"k8s.io/klog/v2"
	"k8s.io/kube-openapi/pkg/common"

	"github.com/grafana/grafana/pkg/apiserver/endpoints/filters"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

type BuildHandlerChainFunc = func(delegateHandler http.Handler, c *genericapiserver.Config) http.Handler

// PathRewriters is a temporary hack to make rest.Connecter work with resource level routes (TODO)
var PathRewriters = []filters.PathRewriter{
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
	{
		Pattern: regexp.MustCompile(`(/apis/iam.grafana.app/v0alpha1/namespaces/.*/display$)`),
		ReplaceFunc: func(matches []string) string {
			return matches[1] + "/name" // connector requires a name
		},
	},
	{
		Pattern: regexp.MustCompile(`(/apis/.*/v0alpha1/namespaces/.*/queryconvert$)`),
		ReplaceFunc: func(matches []string) string {
			return matches[1] + "/name" // connector requires a name
		},
	},
}

func getDefaultBuildHandlerChainFunc(builders []APIGroupBuilder) BuildHandlerChainFunc {
	return func(delegateHandler http.Handler, c *genericapiserver.Config) http.Handler {
		requestHandler, err := GetCustomRoutesHandler(
			delegateHandler,
			c.LoopbackClientConfig,
			builders)
		if err != nil {
			panic(fmt.Sprintf("could not build the request handler for specified API builders: %s", err.Error()))
		}

		// Needs to run last in request chain to function as expected, hence we register it first.
		handler := filters.WithTracingHTTPLoggingAttributes(requestHandler)

		// filters.WithRequester needs to be after the K8s chain because it depends on the K8s user in context
		handler = filters.WithRequester(handler)

		// Call DefaultBuildHandlerChain on the main entrypoint http.Handler
		// See https://github.com/kubernetes/apiserver/blob/v0.28.0/pkg/server/config.go#L906
		// DefaultBuildHandlerChain provides many things, notably CORS, HSTS, cache-control, authz and latency tracking
		handler = genericapiserver.DefaultBuildHandlerChain(handler, c)

		handler = filters.WithAcceptHeader(handler)
		handler = filters.WithPathRewriters(handler, PathRewriters)
		handler = k8stracing.WithTracing(handler, c.TracerProvider, "KubernetesAPI")
		handler = filters.WithExtractJaegerTrace(handler)
		// Configure filters.WithPanicRecovery to not crash on panic
		utilruntime.ReallyCrash = false

		return handler
	}
}

func SetupConfig(
	scheme *runtime.Scheme,
	serverConfig *genericapiserver.RecommendedConfig,
	builders []APIGroupBuilder,
	buildTimestamp int64,
	buildVersion string,
	buildCommit string,
	buildBranch string,
	buildHandlerChainFunc func(delegateHandler http.Handler, c *genericapiserver.Config) http.Handler,
) error {
	serverConfig.AdmissionControl = NewAdmissionFromBuilders(builders)
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
	serverConfig.BuildHandlerChainFunc = getDefaultBuildHandlerChainFunc(builders)

	if buildHandlerChainFunc != nil {
		serverConfig.BuildHandlerChainFunc = buildHandlerChainFunc
	}

	serverConfig.EffectiveVersion = utilversion.DefaultKubeEffectiveVersion()

	if err := AddPostStartHooks(serverConfig, builders); err != nil {
		return err
	}

	return nil
}

type ServerLockService interface {
	LockExecuteAndRelease(ctx context.Context, actionName string, maxInterval time.Duration, fn func(ctx context.Context)) error
}

func getRequestInfo(gr schema.GroupResource, namespaceMapper request.NamespaceMapper) *k8srequest.RequestInfo {
	return &k8srequest.RequestInfo{
		APIGroup:  gr.Group,
		Resource:  gr.Resource,
		Name:      "",
		Namespace: namespaceMapper(int64(1)),
	}
}

func InstallAPIs(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory,
	server *genericapiserver.GenericAPIServer,
	optsGetter generic.RESTOptionsGetter,
	builders []APIGroupBuilder,
	storageOpts *options.StorageOptions,
	reg prometheus.Registerer,
	namespaceMapper request.NamespaceMapper,
	kvStore grafanarest.NamespacedKVStore,
	serverLock ServerLockService,
	optsregister apistore.StorageOptionsRegister,
) error {
	// dual writing is only enabled when the storage type is not legacy.
	// this is needed to support setting a default RESTOptionsGetter for new APIs that don't
	// support the legacy storage type.
	var dualWrite grafanarest.DualWriteBuilder

	// nolint:staticcheck
	if storageOpts.StorageType != options.StorageTypeLegacy {
		dualWrite = func(gr schema.GroupResource, legacy grafanarest.LegacyStorage, storage grafanarest.Storage) (grafanarest.Storage, error) {
			key := gr.String() // ${resource}.{group} eg playlists.playlist.grafana.app

			// Get the option from custom.ini/command line
			// when missing this will default to mode zero (legacy only)
			var mode = grafanarest.DualWriterMode(0)

			var (
				dualWriterPeriodicDataSyncJobEnabled bool
				dataSyncerInterval                   = time.Hour
				dataSyncerRecordsLimit               = 1000
			)

			resourceConfig, resourceExists := storageOpts.UnifiedStorageConfig[key]
			if resourceExists {
				mode = resourceConfig.DualWriterMode
				dualWriterPeriodicDataSyncJobEnabled = resourceConfig.DualWriterPeriodicDataSyncJobEnabled
				dataSyncerInterval = resourceConfig.DataSyncerInterval
				dataSyncerRecordsLimit = resourceConfig.DataSyncerRecordsLimit
			}

			// Force using storage only -- regardless of internal synchronization state
			if mode == grafanarest.Mode5 {
				return storage, nil
			}

			// TODO: inherited context from main Grafana process
			ctx := context.Background()

			// Moving from one version to the next can only happen after the previous step has
			// successfully synchronized.
			requestInfo := getRequestInfo(gr, namespaceMapper)

			syncerCfg := &grafanarest.SyncerConfig{
				Kind:                   key,
				RequestInfo:            requestInfo,
				Mode:                   mode,
				LegacyStorage:          legacy,
				Storage:                storage,
				ServerLockService:      serverLock,
				DataSyncerInterval:     dataSyncerInterval,
				DataSyncerRecordsLimit: dataSyncerRecordsLimit,
				Reg:                    reg,
			}

			// This also sets the currentMode on the syncer config.
			currentMode, err := grafanarest.SetDualWritingMode(ctx, kvStore, syncerCfg)
			if err != nil {
				return nil, err
			}
			switch currentMode {
			case grafanarest.Mode0:
				return legacy, nil
			case grafanarest.Mode4, grafanarest.Mode5:
				return storage, nil
			default:
			}
			if dualWriterPeriodicDataSyncJobEnabled {
				// The mode might have changed in SetDualWritingMode, so apply current mode first.
				syncerCfg.Mode = currentMode
				if err := grafanarest.StartPeriodicDataSyncer(ctx, syncerCfg); err != nil {
					return nil, err
				}
			}

			// when unable to use
			if currentMode != mode {
				klog.Warningf("Requested DualWrite mode: %d, but using %d for %+v", mode, currentMode, gr)
			}
			return grafanarest.NewDualWriter(currentMode, legacy, storage, reg, key), nil
		}
	}

	// NOTE: we build a map structure by version only for the purposes of InstallAPIGroup
	// in other places, working with a flat []APIGroupBuilder list is much nicer
	buildersGroupMap := make(map[string][]APIGroupBuilder, 0)
	for _, b := range builders {
		group := b.GetGroupVersion().Group
		if _, ok := buildersGroupMap[group]; !ok {
			buildersGroupMap[group] = make([]APIGroupBuilder, 0)
		}
		buildersGroupMap[group] = append(buildersGroupMap[group], b)
	}

	for group, buildersForGroup := range buildersGroupMap {
		g := genericapiserver.NewDefaultAPIGroupInfo(group, scheme, metav1.ParameterCodec, codecs)
		for _, b := range buildersForGroup {
			if err := b.UpdateAPIGroupInfo(&g, APIGroupOptions{
				Scheme:           scheme,
				OptsGetter:       optsGetter,
				DualWriteBuilder: dualWrite,
				MetricsRegister:  reg,
				StorageOptions:   optsregister,
			}); err != nil {
				return err
			}
			if len(g.PrioritizedVersions) < 1 {
				continue
			}
		}

		err := server.InstallAPIGroup(&g)
		if err != nil {
			return err
		}
	}

	return nil
}

// AddPostStartHooks adds post start hooks to a generic API server config
func AddPostStartHooks(
	config *genericapiserver.RecommendedConfig,
	builders []APIGroupBuilder,
) error {
	for _, b := range builders {
		hookProvider, ok := b.(APIGroupPostStartHookProvider)
		if !ok {
			continue
		}
		hooks, err := hookProvider.GetPostStartHooks()
		if err != nil {
			return err
		}
		for name, hook := range hooks {
			if err := config.AddPostStartHook(name, hook); err != nil {
				return err
			}
		}
	}
	return nil
}
