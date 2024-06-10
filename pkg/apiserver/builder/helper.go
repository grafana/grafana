package builder

import (
	"fmt"
	"net/http"
	goruntime "runtime"
	"runtime/debug"
	"strconv"
	"strings"
	"time"

	"golang.org/x/mod/semver"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apimachinery/pkg/version"
	openapinamer "k8s.io/apiserver/pkg/endpoints/openapi"
	"k8s.io/apiserver/pkg/registry/generic"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/util/openapi"
	k8sscheme "k8s.io/client-go/kubernetes/scheme"
	"k8s.io/kube-openapi/pkg/common"

	"github.com/grafana/grafana/pkg/apiserver/endpoints/filters"
)

func SetupConfig(
	scheme *runtime.Scheme,
	serverConfig *genericapiserver.RecommendedConfig,
	builders []APIGroupBuilder,
	buildTimestamp int64,
	buildVersion string,
	buildCommit string,
	buildBranch string,
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

		handler := genericapiserver.DefaultBuildHandlerChain(requestHandler, c)
		handler = filters.WithAcceptHeader(handler)

		return handler
	}

	k8sVersion, err := getK8sApiserverVersion()
	if err != nil {
		return err
	}
	before, after, _ := strings.Cut(buildVersion, ".")
	serverConfig.Version = &version.Info{
		Major:        before,
		Minor:        after,
		GoVersion:    goruntime.Version(),
		Platform:     fmt.Sprintf("%s/%s", goruntime.GOOS, goruntime.GOARCH),
		Compiler:     goruntime.Compiler,
		GitTreeState: buildBranch,
		GitCommit:    buildCommit,
		BuildDate:    time.Unix(buildTimestamp, 0).UTC().Format(time.DateTime),
		GitVersion:   k8sVersion,
	}
	return nil
}

func InstallAPIs(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory,
	server *genericapiserver.GenericAPIServer,
	optsGetter generic.RESTOptionsGetter,
	builders []APIGroupBuilder,
	dualWrite bool,
) error {
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

// find the k8s version according to build info
func getK8sApiserverVersion() (string, error) {
	bi, ok := debug.ReadBuildInfo()
	if !ok {
		return "", fmt.Errorf("debug.ReadBuildInfo() failed")
	}

	if len(bi.Deps) == 0 {
		return "v?.?", nil // this is normal while debugging
	}

	for _, dep := range bi.Deps {
		if dep.Path == "k8s.io/apiserver" {
			if !semver.IsValid(dep.Version) {
				return "", fmt.Errorf("invalid semantic version for k8s.io/apiserver")
			}
			// v0 => v1
			majorVersion := strings.TrimPrefix(semver.Major(dep.Version), "v")
			majorInt, err := strconv.Atoi(majorVersion)
			if err != nil {
				return "", fmt.Errorf("could not convert majorVersion to int. majorVersion: %s", majorVersion)
			}
			newMajor := fmt.Sprintf("v%d", majorInt+1)
			return strings.Replace(dep.Version, semver.Major(dep.Version), newMajor, 1), nil
		}
	}

	return "", fmt.Errorf("could not find k8s.io/apiserver in build info")
}
