package aggregator_test

import (
	"sort"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	openapinamer "k8s.io/apiserver/pkg/endpoints/openapi"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes/fake"
	clientrest "k8s.io/client-go/rest"
	utilversion "k8s.io/component-base/version"
	"k8s.io/kube-aggregator/pkg/apiserver"
	aggregatorscheme "k8s.io/kube-aggregator/pkg/apiserver/scheme"
	aggregatoropenapi "k8s.io/kube-aggregator/pkg/generated/openapi"

	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

// TestAggregatorPostStartHooks tests that the kube-aggregator server has the expected default post start hooks enabled.
func TestAggregatorPostStartHooks(t *testing.T) {
	cfg := apiserver.Config{
		GenericConfig: genericapiserver.NewRecommendedConfig(aggregatorscheme.Codecs),
		ExtraConfig:   apiserver.ExtraConfig{},
	}

	cfg.GenericConfig.ExternalAddress = "127.0.0.1:6443"
	cfg.GenericConfig.EffectiveVersion = utilversion.DefaultBuildEffectiveVersion()
	cfg.GenericConfig.LoopbackClientConfig = &clientrest.Config{}
	cfg.GenericConfig.MergedResourceConfig = apiserver.DefaultAPIResourceConfigSource()

	// Add OpenAPI config, which depends on builders
	namer := openapinamer.NewDefinitionNamer(aggregatorscheme.Scheme)
	cfg.GenericConfig.OpenAPIV3Config = genericapiserver.DefaultOpenAPIV3Config(aggregatoropenapi.GetOpenAPIDefinitions, namer)
	cfg.GenericConfig.OpenAPIV3Config.Info.Title = "Kubernetes"
	cfg.GenericConfig.OpenAPIConfig = genericapiserver.DefaultOpenAPIConfig(aggregatoropenapi.GetOpenAPIDefinitions, namer)
	cfg.GenericConfig.OpenAPIConfig.Info.Title = "Kubernetes"
	cfg.GenericConfig.SkipOpenAPIInstallation = true
	cfg.GenericConfig.SharedInformerFactory = informers.NewSharedInformerFactory(fake.NewSimpleClientset(), 10*time.Minute)

	// override the RESTOptionsGetter to use the in memory storage options
	restOptionsGetter, err := apistore.NewRESTOptionsGetterMemory(*storagebackend.NewDefaultConfig("memory", nil))
	require.NoError(t, err)
	cfg.GenericConfig.RESTOptionsGetter = restOptionsGetter

	complete := cfg.Complete()

	server, err := complete.NewWithDelegate(genericapiserver.NewEmptyDelegate())
	require.NoError(t, err)

	actual := make([]string, 0, len(server.GenericAPIServer.PostStartHooks()))
	for k := range server.GenericAPIServer.PostStartHooks() {
		actual = append(actual, k)
	}
	sort.Strings(actual)
	expected := []string{
		"apiservice-discovery-controller",
		"generic-apiserver-start-informers",
		"max-in-flight-filter",
		"storage-object-count-tracker-hook",
		"start-kube-aggregator-informers",
		"apiservice-status-local-available-controller",
		"apiservice-status-remote-available-controller",
		"apiservice-registration-controller",
	}
	sort.Strings(expected)
	require.Equal(t, expected, actual)
}
