package builder

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"strings"
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
	"k8s.io/klog/v2"
	"k8s.io/kube-openapi/pkg/common"

	"github.com/grafana/grafana/pkg/apiserver/endpoints/filters"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

type BuildHandlerChainFuncFromBuilders = func([]APIGroupBuilder) BuildHandlerChainFunc
type BuildHandlerChainFunc = func(delegateHandler http.Handler, c *genericapiserver.Config) http.Handler

func ProvideDefaultBuildHandlerChainFuncFromBuilders() BuildHandlerChainFuncFromBuilders {
	return GetDefaultBuildHandlerChainFunc
}

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
		Pattern: regexp.MustCompile(`(/apis/query.grafana.app/v0alpha1/namespaces/.*/sqlschema$)`),
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

func GetDefaultBuildHandlerChainFunc(builders []APIGroupBuilder) BuildHandlerChainFunc {
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
	buildHandlerChainFuncFromBuilders BuildHandlerChainFuncFromBuilders,
	gvs []schema.GroupVersion,
	additionalOpenAPIDefGetters []common.GetOpenAPIDefinitions,
) error {
	serverConfig.AdmissionControl = NewAdmissionFromBuilders(builders)
	defsGetter := GetOpenAPIDefinitions(builders, additionalOpenAPIDefGetters...)
	serverConfig.OpenAPIConfig = genericapiserver.DefaultOpenAPIConfig(
		openapi.GetOpenAPIDefinitionsWithoutDisabledFeatures(defsGetter),
		openapinamer.NewDefinitionNamer(scheme, k8sscheme.Scheme))

	serverConfig.OpenAPIV3Config = genericapiserver.DefaultOpenAPIV3Config(
		openapi.GetOpenAPIDefinitionsWithoutDisabledFeatures(defsGetter),
		openapinamer.NewDefinitionNamer(scheme, k8sscheme.Scheme))

	// Add the custom routes to service discovery
	serverConfig.OpenAPIV3Config.PostProcessSpec = getOpenAPIPostProcessor(buildVersion, builders, gvs)
	serverConfig.OpenAPIV3Config.GetOperationIDAndTagsFromRoute = func(r common.Route) (string, []string, error) {
		meta := r.Metadata()
		kind := ""
		action := ""
		sub := ""

		tags := []string{}
		prop, ok := meta["x-kubernetes-group-version-kind"]
		if ok {
			gvk, ok := prop.(metav1.GroupVersionKind)
			if ok && gvk.Kind != "" {
				kind = gvk.Kind
				tags = append(tags, gvk.Kind)
			}
		}
		prop, ok = meta["x-kubernetes-action"]
		if ok {
			action = fmt.Sprintf("%v", prop)
		}

		isNew := false
		if _, err := os.Stat("test.csv"); errors.Is(err, os.ErrNotExist) {
			isNew = true
		}

		if action == "connect" {
			idx := strings.LastIndex(r.Path(), "/{name}/")
			if idx > 0 {
				sub = r.Path()[(idx + len("/{name}/")):]
			}
		}

		operationAlt := r.OperationName()
		if action != "" {
			if action == "connect" {
				idx := strings.Index(r.OperationName(), "Namespaced")
				if idx > 0 {
					operationAlt = strings.ToLower(r.Method()) +
						r.OperationName()[idx:]
				}
			}
		}

		operationAlt = strings.ReplaceAll(operationAlt, "Namespaced", "")
		if strings.HasPrefix(operationAlt, "post") {
			operationAlt = "create" + operationAlt[len("post"):]
		} else if strings.HasPrefix(operationAlt, "read") {
			operationAlt = "get" + operationAlt[len("read"):]
		} else if strings.HasPrefix(operationAlt, "patch") {
			operationAlt = "update" + operationAlt[len("patch"):]
		} else if strings.HasPrefix(operationAlt, "put") {
			operationAlt = "replace" + operationAlt[len("put"):]
		}

		// Audit our options here
		if false {
			// Safe to ignore G304 -- this will be removed before merging to main, and just helps audit the conversion
			// nolint:gosec
			f, err := os.OpenFile("test.csv", os.O_WRONLY|os.O_CREATE|os.O_APPEND, 0644)
			if err != nil {
				fmt.Printf("ERROR: %s\n", err)
			} else {
				metastr, _ := json.Marshal(meta)

				prop, ok = meta["x-kubernetes-group-version-kind"]
				if ok {
					gvk, ok := prop.(metav1.GroupVersionKind)
					if ok {
						kind = gvk.Kind
					}
				}

				w := csv.NewWriter(f)
				if isNew {
					_ = w.Write([]string{
						"#Path",
						"Method",
						"action",
						"kind",
						"sub",
						"OperationName",
						"OperationNameAlt",
						"Description",
						"metadata",
					})
				}
				_ = w.Write([]string{
					r.Path(),
					r.Method(),
					action,
					kind,
					sub,
					r.OperationName(),
					operationAlt,
					r.Description(),
					string(metastr),
				})
				w.Flush()
			}
		}
		return operationAlt, tags, nil
	}

	// Set the swagger build versions
	serverConfig.OpenAPIConfig.Info.Title = "Grafana API Server"
	serverConfig.OpenAPIConfig.Info.Version = buildVersion
	serverConfig.OpenAPIV3Config.Info.Title = "Grafana API Server"
	serverConfig.OpenAPIV3Config.Info.Version = buildVersion

	serverConfig.SkipOpenAPIInstallation = false
	serverConfig.BuildHandlerChainFunc = buildHandlerChainFuncFromBuilders(builders)

	serverConfig.EffectiveVersion = getEffectiveVersion(buildTimestamp, buildVersion, buildCommit, buildBranch)
	// set priority for aggregated discovery
	for i, b := range builders {
		gvs := GetGroupVersions(b)
		if len(gvs) == 0 {
			return fmt.Errorf("builder did not return any API group versions: %T", b)
		}
		pvs := scheme.PrioritizedVersionsForGroup(gvs[0].Group)
		for j, gv := range pvs {
			serverConfig.AggregatedDiscoveryGroupManager.SetGroupVersionPriority(metav1.GroupVersion(gv), 15000+i, len(pvs)-j)
		}
	}

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
	dualWriteService dualwrite.Service,
	optsregister apistore.StorageOptionsRegister,
	features featuremgmt.FeatureToggles,
	dualWriterMetrics *grafanarest.DualWriterMetrics,
	builderMetrics *BuilderMetrics,
) error {
	// dual writing is only enabled when the storage type is not legacy.
	// this is needed to support setting a default RESTOptionsGetter for new APIs that don't
	// support the legacy storage type.
	var dualWrite grafanarest.DualWriteBuilder

	// nolint:staticcheck
	if storageOpts.StorageType != options.StorageTypeLegacy {
		dualWrite = func(gr schema.GroupResource, legacy grafanarest.Storage, storage grafanarest.Storage) (grafanarest.Storage, error) {
			// Dashboards + Folders may be managed (depends on feature toggles and database state)
			if dualWriteService != nil && dualWriteService.ShouldManage(gr) {
				return dualWriteService.NewStorage(gr, legacy, storage) // eventually this can replace this whole function
			}

			key := gr.String() // ${resource}.{group} eg playlists.playlist.grafana.app

			// Get the option from custom.ini/command line
			// when missing this will default to mode zero (legacy only)
			var mode = grafanarest.DualWriterMode(0)

			var (
				dualWriterPeriodicDataSyncJobEnabled bool
				dualWriterMigrationDataSyncDisabled  bool
				dataSyncerInterval                   = time.Hour
				dataSyncerRecordsLimit               = 1000
			)

			resourceConfig, resourceExists := storageOpts.UnifiedStorageConfig[key]
			if resourceExists {
				mode = resourceConfig.DualWriterMode
				dualWriterPeriodicDataSyncJobEnabled = resourceConfig.DualWriterPeriodicDataSyncJobEnabled
				dualWriterMigrationDataSyncDisabled = resourceConfig.DualWriterMigrationDataSyncDisabled
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
				SkipDataSync:           dualWriterMigrationDataSyncDisabled,
				LegacyStorage:          legacy,
				Storage:                storage,
				ServerLockService:      serverLock,
				DataSyncerInterval:     dataSyncerInterval,
				DataSyncerRecordsLimit: dataSyncerRecordsLimit,
			}

			// This also sets the currentMode on the syncer config.
			currentMode, err := grafanarest.SetDualWritingMode(ctx, kvStore, syncerCfg, dualWriterMetrics)
			if err != nil {
				return nil, err
			}

			builderMetrics.RecordDualWriterModes(gr.Resource, gr.Group, mode, currentMode)

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
				if err := grafanarest.StartPeriodicDataSyncer(ctx, syncerCfg, dualWriterMetrics); err != nil {
					return nil, err
				}
			}

			// when unable to use
			if currentMode != mode {
				klog.Warningf("Requested DualWrite mode: %d, but using %d for %+v", mode, currentMode, gr)
			}
			return dualwrite.NewDualWriter(gr, currentMode, legacy, storage)
		}
	}

	// NOTE: we build a map structure by version only for the purposes of InstallAPIGroup
	// in other places, working with a flat []APIGroupBuilder list is much nicer
	buildersGroupMap := make(map[string][]APIGroupBuilder, 0)
	for _, b := range builders {
		group, err := getGroup(b)
		if err != nil {
			return err
		}
		if _, ok := buildersGroupMap[group]; !ok {
			buildersGroupMap[group] = make([]APIGroupBuilder, 0)
		}
		buildersGroupMap[group] = append(buildersGroupMap[group], b)
	}

	for group, buildersForGroup := range buildersGroupMap {
		g := genericapiserver.NewDefaultAPIGroupInfo(group, scheme, metav1.ParameterCodec, codecs)
		for _, b := range buildersForGroup {
			if err := b.UpdateAPIGroupInfo(&g, APIGroupOptions{
				Scheme:              scheme,
				OptsGetter:          optsGetter,
				DualWriteBuilder:    dualWrite,
				MetricsRegister:     reg,
				StorageOptsRegister: optsregister,
				StorageOpts:         storageOpts,
			}); err != nil {
				return err
			}
			if len(g.PrioritizedVersions) < 1 {
				continue
			}

			// if grafanaAPIServerWithExperimentalAPIs is not enabled, remove v0alpha1 resources unless explicitly allowed
			if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
				if resources, ok := g.VersionedResourcesStorageMap["v0alpha1"]; ok {
					for name := range resources {
						if !allowRegisteringResourceByInfo(b.AllowedV0Alpha1Resources(), name) {
							delete(resources, name)
						}
					}
					if len(resources) == 0 {
						delete(g.VersionedResourcesStorageMap, "v0alpha1")
					}
				}
			}
		}

		// skip installing the group if there are no resources left after filtering
		if len(g.VersionedResourcesStorageMap) == 0 {
			continue
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

func allowRegisteringResourceByInfo(allowedResources []string, name string) bool {
	// trim any subresources from the name
	name = strings.Split(name, "/")[0]

	for _, allowedResource := range allowedResources {
		if allowedResource == name || allowedResource == AllResourcesAllowed {
			return true
		}
	}

	return false
}
