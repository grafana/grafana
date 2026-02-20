package builder

import (
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"strings"

	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	openapinamer "k8s.io/apiserver/pkg/endpoints/openapi"
	"k8s.io/apiserver/pkg/registry/generic"
	genericapiserver "k8s.io/apiserver/pkg/server"
	serverstorage "k8s.io/apiserver/pkg/server/storage"
	"k8s.io/apiserver/pkg/util/openapi"
	k8sscheme "k8s.io/client-go/kubernetes/scheme"
	k8stracing "k8s.io/component-base/tracing"
	"k8s.io/klog/v2"
	"k8s.io/kube-openapi/pkg/common"

	"github.com/grafana/grafana/pkg/apiserver/auditing"
	"github.com/grafana/grafana/pkg/apiserver/endpoints/filters"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

type BuildHandlerChainFuncFromBuilders = func([]APIGroupBuilder, prometheus.Registerer) BuildHandlerChainFunc
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
	{ // Migrate query.grafana.app to datasource.grafana.app
		Pattern: regexp.MustCompile(`/apis/query.grafana.app/v0alpha1(.*$)`),
		ReplaceFunc: func(matches []string) string {
			result := "/apis/datasource.grafana.app/v0alpha1" + matches[1]
			if strings.HasSuffix(matches[1], "/query") {
				result += "/name" // same as the rewrite pattern below
			}
			if strings.HasSuffix(matches[1], "/sqlschemas") && !strings.Contains(matches[1], "/query/") {
				result = strings.Replace(result, "/sqlschemas", "/query/sqlschemas", 1)
			}
			return result
		},
	},
	{
		Pattern: regexp.MustCompile(`(/apis/datasource.grafana.app/v0alpha1/namespaces/.*/query$)`),
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

func GetDefaultBuildHandlerChainFunc(builders []APIGroupBuilder, reg prometheus.Registerer) BuildHandlerChainFunc {
	return func(delegateHandler http.Handler, c *genericapiserver.Config) http.Handler {
		handler := filters.WithTracingHTTPLoggingAttributes(delegateHandler)

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

// SetupConfig sets up the server config for the API server
// specify isAggregator=true, if the chain is being constructed for kube-aggregator
func SetupConfig(
	scheme *runtime.Scheme,
	serverConfig *genericapiserver.RecommendedConfig,
	builders []APIGroupBuilder,
	buildVersion string,
	buildHandlerChainFuncFromBuilders BuildHandlerChainFuncFromBuilders,
	gvs []schema.GroupVersion,
	additionalOpenAPIDefGetters []common.GetOpenAPIDefinitions,
	reg prometheus.Registerer,
	apiResourceConfig *serverstorage.ResourceConfig,
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
	serverConfig.OpenAPIV3Config.PostProcessSpec = getOpenAPIPostProcessor(buildVersion, builders, gvs, apiResourceConfig)
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
	serverConfig.BuildHandlerChainFunc = buildHandlerChainFuncFromBuilders(builders, reg)

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

func InstallAPIs(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory,
	server *genericapiserver.GenericAPIServer,
	optsGetter generic.RESTOptionsGetter,
	builders []APIGroupBuilder,
	storageOpts *options.StorageOptions,
	reg prometheus.Registerer,
	dualWriteService dualwrite.Service,
	optsregister apistore.StorageOptionsRegister,
	features featuremgmt.FeatureToggles,
	builderMetrics *BuilderMetrics,
	apiResourceConfig *serverstorage.ResourceConfig,
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

			resourceConfig, resourceExists := storageOpts.UnifiedStorageConfig[key]
			if resourceExists {
				mode = resourceConfig.DualWriterMode
			}

			builderMetrics.RecordDualWriterModes(gr.Resource, gr.Group, mode)

			switch mode {
			case grafanarest.Mode0:
				return legacy, nil
			case grafanarest.Mode4, grafanarest.Mode5:
				return storage, nil
			default:
				return dualwrite.NewStaticStorage(gr, mode, legacy, storage)
			}
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
			if err := installAPIGroupsForBuilder(&g, group, b, apiResourceConfig, scheme, optsGetter, dualWrite, reg, optsregister, storageOpts, features); err != nil {
				return err
			}
		}

		// skip installing the group if there are no resources left after filtering
		if len(g.VersionedResourcesStorageMap) == 0 {
			continue
		}

		// overrride the negotiated serializer to exclude protobuf, after the NewDefaultAPIGroupInfo, since it otherwise replaces the codecs
		g.NegotiatedSerializer = grafanarest.DefaultNoProtobufNegotiatedSerializer(codecs)

		if err := server.InstallAPIGroup(&g); err != nil {
			return err
		}
	}
	return nil
}

func installAPIGroupsForBuilder(g *genericapiserver.APIGroupInfo, group string, b APIGroupBuilder, apiResourceConfig *serverstorage.ResourceConfig, scheme *runtime.Scheme,
	optsGetter generic.RESTOptionsGetter, dualWrite grafanarest.DualWriteBuilder, reg prometheus.Registerer, optsregister apistore.StorageOptionsRegister,
	storageOpts *options.StorageOptions, features featuremgmt.FeatureToggles) error {
	if err := b.UpdateAPIGroupInfo(g, APIGroupOptions{
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
		return nil
	}

	// filter out api groups that are disabled in APIEnablementOptions
	for version := range g.VersionedResourcesStorageMap {
		gvr := schema.GroupVersionResource{
			Group:   group,
			Version: version,
		}
		if apiResourceConfig != nil && !apiResourceConfig.ResourceEnabled(gvr) {
			klog.InfoS("Skipping storage for disabled resource", "gvr", gvr.String())
			delete(g.VersionedResourcesStorageMap, version)
		}
	}

	// if grafanaAPIServerWithExperimentalAPIs is not enabled, remove v0alpha1 resources unless explicitly allowed
	//nolint:staticcheck // not yet migrated to OpenFeature
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

func EvaluatorPolicyRuleFromBuilders(builders []APIGroupBuilder) auditing.PolicyRuleEvaluators {
	policyRuleEvaluators := make(auditing.PolicyRuleEvaluators, 0)

	for _, b := range builders {
		auditor, ok := b.(APIGroupAuditor)
		if !ok {
			continue
		}

		policyRuleEvaluator := auditor.GetPolicyRuleEvaluator()
		if policyRuleEvaluator == nil {
			continue
		}

		for _, gv := range GetGroupVersions(b) {
			if gv.Empty() {
				continue
			}

			policyRuleEvaluators[gv] = policyRuleEvaluator
		}
	}

	return policyRuleEvaluators
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
