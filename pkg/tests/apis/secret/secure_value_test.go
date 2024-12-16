package secret

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

var gvr = schema.GroupVersionResource{
	Group:    "secret.grafana.app",
	Version:  "v0alpha1",
	Resource: "securevalues",
}

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationSecureValue(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false, // required for experimental APIs
		EnableFeatureToggles: []string{
			// Required to start the example service
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
			featuremgmt.FlagSecretsManagementAppPlatform,
		},
	})

	t.Run("Check discovery client", func(t *testing.T) {
		disco := helper.NewDiscoveryClient()

		resources, err := disco.ServerResourcesForGroupVersion("secret.grafana.app/v0alpha1")
		require.NoError(t, err)

		v1Disco, err := json.MarshalIndent(resources, "", "  ")
		require.NoError(t, err)

		var apiResourceList map[string]any
		require.NoError(t, json.Unmarshal(v1Disco, &apiResourceList))

		groupVersion, ok := apiResourceList["groupVersion"].(string)
		require.True(t, ok)
		require.Equal(t, "secret.grafana.app/v0alpha1", groupVersion)

		apiResources, ok := apiResourceList["resources"].([]any)
		require.True(t, ok)
		require.Len(t, apiResources, 2) // securevalue + keeper + (subresources...)
	})

	t.Run("creating a secure value returns it without any of the value or ref", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		client := helper.GetResourceClient(apis.ResourceClientArgs{
			// #TODO: figure out permissions topic
			User: helper.Org1.Admin,
			GVR:  gvr,
		})

		testDataSecureValueXyz := helper.LoadYAMLOrJSONFile("testdata/secure-value-xyz.yaml")

		raw, err := client.Resource.Create(ctx, testDataSecureValueXyz, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, raw)

		secureValue := new(secretv0alpha1.SecureValue)
		err = runtime.DefaultUnstructuredConverter.FromUnstructured(raw.Object, secureValue)
		require.NoError(t, err)
		require.NotNil(t, secureValue)

		require.Empty(t, secureValue.Spec.Value)
		require.Empty(t, secureValue.Spec.Ref)
		require.NotEmpty(t, secureValue.Spec.Title)
		require.NotEmpty(t, secureValue.Spec.Keeper)
		require.NotEmpty(t, secureValue.Spec.Audiences)

		t.Run("and creating another secure value with the same name in the same namespace returns an error", func(t *testing.T) {
			raw, err := client.Resource.Create(ctx, testDataSecureValueXyz, metav1.CreateOptions{})
			require.Error(t, err)
			require.Nil(t, raw)
		})

		t.Run("and reading the secure value returns it same as if when it was created", func(t *testing.T) {
			raw, err := client.Resource.Get(ctx, secureValue.Name, metav1.GetOptions{})
			require.NoError(t, err)
			require.NotNil(t, raw)

			anotherSecureValue := new(secretv0alpha1.SecureValue)
			err = runtime.DefaultUnstructuredConverter.FromUnstructured(raw.Object, anotherSecureValue)
			require.NoError(t, err)
			require.NotNil(t, anotherSecureValue)

			require.EqualValues(t, secureValue, anotherSecureValue)
		})
	})

	t.Run("reading a secure value that does not exist returns a 404", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		client := helper.GetResourceClient(apis.ResourceClientArgs{
			// #TODO: figure out permissions topic
			User: helper.Org1.Admin,
			GVR:  gvr,
		})

		raw, err := client.Resource.Get(
			ctx,
			"some-secure-value-that-does-not-exist",
			metav1.GetOptions{},
		)
		require.Error(t, err)
		require.Nil(t, raw)

		var statusErr *apierrors.StatusError
		require.True(t, errors.As(err, &statusErr))
		require.Equal(t, http.StatusNotFound, int(statusErr.Status().Code))
	})
}
