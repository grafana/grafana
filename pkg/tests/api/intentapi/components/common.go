package components

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana/internal/components"
	"github.com/grafana/grafana/internal/cuectx"
	"github.com/grafana/grafana/pkg/infra/tracing"
	grafanaSchema "github.com/grafana/grafana/pkg/schema"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/kubectl/pkg/scheme"
)

type componentTestCfg struct {
	testCaseFactory     testCaseFactoryFunc
	objectSchemaFactory objectSchemaFactoryFunc
	storeFactory        storeFactoryFunc
}

type objectSchemaFactoryFunc = func(*testing.T, components.Store, *grafanaSchema.SchemaLoader) grafanaSchema.ObjectSchema
type testCaseFactoryFunc = func() testCaseCfg
type storeFactoryFunc = func(*sqlstore.SQLStore) components.Store

type testCaseCfg struct {
	objectName     string
	postBody       func() runtime.Object
	putBody        func(*testing.T, rest.Result) runtime.Object
	postAssertFunc func(*testing.T, runtime.Object) bool
	putAssertFunc  func(*testing.T, runtime.Object) bool
}

func runTestCase(t *testing.T, cfg componentTestCfg) {
	s, c, objSchema := setup(t, cfg)

	// TODO create testNamespace for tests
	testNamespace := "default"
	testCase := cfg.testCaseFactory()

	resource := fmt.Sprintf("%ss", objSchema.Name())

	t.Run("test creating resource object", func(t *testing.T) {
		postBody := testCase.postBody()

		// create object
		res := c.Post().
			Resource(resource).
			Namespace(testNamespace).
			Body(postBody).
			Do(context.Background())
		require.NoError(t, res.Error())

		assert.Eventually(t, func() bool {
			// make sure that the object exists in the store
			res := zeroObjectOfType(t, postBody)
			err := s.Get(context.Background(), types.NamespacedName{Name: testCase.objectName}, res)
			condition := testCase.postAssertFunc(t, res)
			t.Log("after POST:", "error: ", err, "condition:", condition)
			return err == nil && condition
		}, 10*time.Second, 250*time.Millisecond, "unexpected object state after POST")

		var getResult rest.Result
		t.Run("test getting resource object", func(t *testing.T) {
			getResult = c.Get().
				Resource(resource).
				Namespace(testNamespace).
				Name(testCase.objectName).
				Do(context.Background())
			require.NoError(t, getResult.Error())
		})

		t.Run("test updating resource object", func(t *testing.T) {
			putBody := testCase.putBody(t, getResult)
			// update object
			res := c.Put().
				Resource(resource).
				Namespace(testNamespace).
				Name(testCase.objectName).
				Body(putBody).
				Do(context.Background())
			require.NoError(t, res.Error())

			assert.Eventually(t, func() bool {
				// make sure that the object is updated in the store
				res := zeroObjectOfType(t, postBody)
				err := s.Get(context.Background(), types.NamespacedName{Name: testCase.objectName}, res)
				condition := testCase.putAssertFunc(t, res)
				t.Log("after PUT:", "error: ", err, "condition:", condition)
				return err == nil && condition
			}, 10*time.Second, 250*time.Millisecond, "unexpected object state after PUT")
		})

		t.Run("test deleting resource object", func(t *testing.T) {
			// cleanup object
			res := c.Delete().
				Resource(resource).
				Namespace(testNamespace).
				Name(testCase.objectName).
				Do(context.Background())
			require.NoError(t, res.Error())

			// make sure that the object is deleted
			assert.Eventually(t, func() bool {
				// make sure that the object is deleted from the store
				res := zeroObjectOfType(t, postBody)
				err := s.Get(context.Background(), types.NamespacedName{Name: testCase.objectName}, res)
				t.Log("after PUT", "error: ", err)
				return err != nil
			}, 10*time.Second, 10*time.Millisecond, "unexpected object state after DELETE")
		})
	})
}

// setup is a helper method that starts grafana server with intent API enabled.
// It expects the following environmental variables to be set:
//
// - GRAFANA_TEST_INTENTAPI_SERVER_LISTEN_ADDRESS: which address the Intent API will be listening on. If it's not set, then the default "127.0.0.1:8443" is used.
// - GRAFANA_TEST_INTENTAPI_SERVER_CERT_FILE_PATH: path to TLS certificate that would be used by the Intent API.
// - GRAFANA_TEST_INTENTAPI_SERVER_KEY_FILE_PATH: path to TLS key file that would be used by the Intent API.
// - GRAFANA_TEST_INTENTAPI_KUBEBRIDGE_KUBECONFIG_PATH: the kube config file which contains contexts, namespaces and auth targeting the api server.
func setup(t *testing.T, cfg componentTestCfg) (components.Store, *rest.RESTClient, grafanaSchema.ObjectSchema) {
	t.Helper()

	var startGrafanaServerOnce sync.Once

	var store *sqlstore.SQLStore

	startGrafanaServerOnce.Do(func() {
		// Setup Grafana and its Database
		_, err := tracing.InitializeTracerForTest()
		require.NoError(t, err)

		// Enable intent API
		dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
			EnableFeatureToggles: []string{"intentapi"},
			IntentAPIOpts: &testinfra.IntentAPIOpts{
				ServerListenAddress:  os.Getenv("GRAFANA_TEST_INTENTAPI_SERVER_LISTEN_ADDRESS"),
				ServerCertFilePath:   os.Getenv("GRAFANA_TEST_INTENTAPI_SERVER_CERT_FILE_PATH"),
				ServerKeyFilePath:    os.Getenv("GRAFANA_TEST_INTENTAPI_SERVER_KEY_FILE_PATH"),
				BridgeKubeconfigPath: os.Getenv("GRAFANA_TEST_INTENTAPI_KUBEBRIDGE_KUBECONFIG_PATH"),
			},
		})

		_, store = testinfra.StartGrafana(t, dir, path)
	})

	s := cfg.storeFactory(store)

	objSchema := objectSchema(t, s, cfg.objectSchemaFactory)

	cli := restClient(t, objSchema.GroupName(), objSchema.GroupVersion())
	return s, cli, objSchema
}

// restClient is a helper method that creates and returns a *rest.RESTClient
// It expects the following environmental variables to be set:
//
// - GRAFANA_TEST_INTENTAPI_KUBECONFIG_PATH: the kube config file which contains contexts, namespaces and auth targeting the grafana intent API.
func restClient(t *testing.T, groupName string, groupVersion string) *rest.RESTClient {
	t.Helper()

	intentapiConfigPath := os.Getenv("GRAFANA_TEST_INTENTAPI_KUBECONFIG_PATH")
	intentapiConfigPath = filepath.Clean(intentapiConfigPath)

	_, err := os.Stat(intentapiConfigPath)
	require.NoError(t, err)

	restCfg, err := clientcmd.BuildConfigFromFlags("", intentapiConfigPath)
	require.NoError(t, err)

	restCfg.NegotiatedSerializer = scheme.Codecs.WithoutConversion()
	restCfg.APIPath = "/apis"
	restCfg.GroupVersion = &schema.GroupVersion{
		Group:   groupName,
		Version: groupVersion,
	}

	cli, err := rest.RESTClientFor(restCfg)
	require.NoError(t, err)

	return cli
}

// objectSchema is a helper function that returns the grafanaSchema.ObjectSchema of a resource
func objectSchema(t *testing.T, s components.Store, objectSchemaFactory objectSchemaFactoryFunc) grafanaSchema.ObjectSchema {
	t.Helper()

	goSchemaLoader := grafanaSchema.ProvideGoSchemaLoader()
	library := cuectx.ProvideThemaLibrary()
	themaSchemaLoader := grafanaSchema.ProvideThemaSchemaLoader(library)
	schemaLoader := grafanaSchema.ProvideSchemaLoader(goSchemaLoader, themaSchemaLoader)
	return objectSchemaFactory(t, s, schemaLoader)
}

// zeroObjectOfType is a helper function that creates an empty object of the type of the input
// and returns it as a runtime.Object
func zeroObjectOfType(t *testing.T, input interface{}) runtime.Object {
	t.Helper()

	val := reflect.ValueOf(input).Elem()
	cpy := reflect.New(val.Type())
	res, ok := cpy.Interface().(runtime.Object)
	require.True(t, ok)
	return res
}
