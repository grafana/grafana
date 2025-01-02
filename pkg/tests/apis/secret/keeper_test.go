package secret

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"testing"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

var gvrKeepers = schema.GroupVersionResource{
	Group:    "secret.grafana.app",
	Version:  "v0alpha1",
	Resource: "keepers",
}

func TestIntegrationKeeper(t *testing.T) {
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

	t.Run("reading a keeper that does not exist returns a 404", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		client := helper.GetResourceClient(apis.ResourceClientArgs{
			// #TODO: figure out permissions topic
			User: helper.Org1.Admin,
			GVR:  gvrKeepers,
		})

		raw, err := client.Resource.Get(ctx, "some-keeper-that-does-not-exist", metav1.GetOptions{})
		require.Error(t, err)
		require.Nil(t, raw)

		var statusErr *apierrors.StatusError
		require.True(t, errors.As(err, &statusErr))
		require.Equal(t, http.StatusNotFound, int(statusErr.Status().Code))
	})

	t.Run("deleting a keeper that does not exist does not return an error", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		client := helper.GetResourceClient(apis.ResourceClientArgs{
			// #TODO: figure out permissions topic
			User: helper.Org1.Admin,
			GVR:  gvrKeepers,
		})

		err := client.Resource.Delete(ctx, "some-keeper-that-does-not-exist", metav1.DeleteOptions{})
		require.NoError(t, err)
	})

	t.Run("creating a keeper without a name generates one", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		client := helper.GetResourceClient(apis.ResourceClientArgs{
			// #TODO: figure out permissions topic
			User: helper.Org1.Admin,
			GVR:  gvrKeepers,
		})

		testDataKeeper := helper.LoadYAMLOrJSONFile("testdata/keeper-gcp-generate.yaml")

		raw, err := client.Resource.Create(ctx, testDataKeeper, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, raw)

		t.Cleanup(func() {
			require.NoError(t, client.Resource.Delete(ctx, raw.GetName(), metav1.DeleteOptions{}))
		})

		keeper := new(secretv0alpha1.Keeper)
		err = runtime.DefaultUnstructuredConverter.FromUnstructured(raw.Object, keeper)
		require.NoError(t, err)
		require.NotNil(t, keeper)

		require.NotEmpty(t, keeper.Name)
	})

	t.Run("creating a keeper returns it", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		client := helper.GetResourceClient(apis.ResourceClientArgs{
			// #TODO: figure out permissions topic
			User: helper.Org1.Admin,
			GVR:  gvrKeepers,
		})

		testDataKeeperAwsXyz := helper.LoadYAMLOrJSONFile("testdata/keeper-aws-xyz.yaml")

		raw, err := client.Resource.Create(ctx, testDataKeeperAwsXyz, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, raw)

		t.Cleanup(func() {
			require.NoError(t, client.Resource.Delete(ctx, raw.GetName(), metav1.DeleteOptions{}))
		})

		keeper := new(secretv0alpha1.Keeper)
		err = runtime.DefaultUnstructuredConverter.FromUnstructured(raw.Object, keeper)
		require.NoError(t, err)
		require.NotNil(t, keeper)

		require.NotEmpty(t, keeper.Spec.Title)
		require.NotEmpty(t, keeper.Spec.AWS)
		require.Empty(t, keeper.Spec.Azure)

		t.Run("and creating another keeper with the same name in the same namespace returns an error", func(t *testing.T) {
			raw, err := client.Resource.Create(ctx, testDataKeeperAwsXyz, metav1.CreateOptions{})
			require.Error(t, err)
			require.Nil(t, raw)
		})

		t.Run("and reading th keeper returns it same as if when it was created", func(t *testing.T) {
			raw, err := client.Resource.Get(ctx, keeper.Name, metav1.GetOptions{})
			require.NoError(t, err)
			require.NotNil(t, raw)

			anotherKeeper := new(secretv0alpha1.Keeper)
			err = runtime.DefaultUnstructuredConverter.FromUnstructured(raw.Object, anotherKeeper)
			require.NoError(t, err)
			require.NotNil(t, anotherKeeper)

			require.EqualValues(t, keeper, anotherKeeper)
		})

		t.Run("and listing keepers returns the created keeper", func(t *testing.T) {
			rawList, err := client.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.NotNil(t, rawList)
			require.GreaterOrEqual(t, len(rawList.Items), 1)
			require.Equal(t, keeper.Name, rawList.Items[0].GetName())
		})

		t.Run("and updating the keeper replaces the spec fields and returns them", func(t *testing.T) {
			newRaw := testDataKeeperAwsXyz.DeepCopy()
			newRaw.Object["spec"].(map[string]any)["title"] = "New title"
			newRaw.Object["metadata"].(map[string]any)["annotations"] = map[string]any{"newAnnotation": "newValue"}

			updatedRaw, err := client.Resource.Update(ctx, newRaw, metav1.UpdateOptions{})
			require.NoError(t, err)
			require.NotNil(t, updatedRaw)

			updatedKeeper := new(secretv0alpha1.Keeper)
			err = runtime.DefaultUnstructuredConverter.FromUnstructured(updatedRaw.Object, updatedKeeper)
			require.NoError(t, err)
			require.NotNil(t, updatedKeeper)

			require.NotEqualValues(t, updatedKeeper.Spec, keeper.Spec)
		})
	})

	t.Run("creating an invalid keeper fails validation and returns an error", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		client := helper.GetResourceClient(apis.ResourceClientArgs{
			// #TODO: figure out permissions topic
			User: helper.Org1.Admin,
			GVR:  gvrKeepers,
		})

		testDataKeeper := helper.LoadYAMLOrJSONFile("testdata/keeper-aws-xyz.yaml")
		testDataKeeper.Object["spec"].(map[string]any)["title"] = ""

		raw, err := client.Resource.Create(ctx, testDataKeeper, metav1.CreateOptions{})
		require.Error(t, err)
		require.Nil(t, raw)

		var statusErr *apierrors.StatusError
		require.True(t, errors.As(err, &statusErr))
	})

	t.Run("creating a keeper with a provider then changing the provider does not return an error", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		client := helper.GetResourceClient(apis.ResourceClientArgs{
			// #TODO: figure out permissions topic
			User: helper.Org1.Admin,
			GVR:  gvrKeepers,
		})

		testDataKeeperAWS := helper.LoadYAMLOrJSONFile("testdata/keeper-aws-xyz.yaml")

		rawAWS, err := client.Resource.Create(ctx, testDataKeeperAWS, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, rawAWS)

		t.Cleanup(func() {
			require.NoError(t, client.Resource.Delete(ctx, rawAWS.GetName(), metav1.DeleteOptions{}))
		})

		testDataKeeperGCP := testDataKeeperAWS.DeepCopy()
		testDataKeeperGCP.Object["spec"].(map[string]any)["aws"] = nil
		testDataKeeperGCP.Object["spec"].(map[string]any)["gcp"] = map[string]any{
			"projectId":       "project-id",
			"credentialsFile": "/path/to/file.json",
		}

		rawGCP, err := client.Resource.Update(ctx, testDataKeeperGCP, metav1.UpdateOptions{})
		require.NoError(t, err)
		require.NotNil(t, rawGCP)

		require.NotEqualValues(t, rawAWS.Object["spec"], rawGCP.Object["spec"])
	})

	t.Run("deleting a keeper that exists does not return an error", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		client := helper.GetResourceClient(apis.ResourceClientArgs{
			// #TODO: figure out permissions topic
			User: helper.Org1.Admin,
			GVR:  gvrKeepers,
		})

		generatePrefix := "generated-"

		testDataKeeperAwsXyz := helper.LoadYAMLOrJSONFile("testdata/keeper-aws-xyz.yaml")
		testDataKeeperAwsXyz.SetName("")
		testDataKeeperAwsXyz.SetGenerateName("generated-")

		raw, err := client.Resource.Create(ctx, testDataKeeperAwsXyz, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, raw)

		name := raw.GetName()
		require.True(t, strings.HasPrefix(name, generatePrefix))

		err = client.Resource.Delete(ctx, name, metav1.DeleteOptions{})
		require.NoError(t, err)

		t.Run("and then trying to read it returns a 404 error", func(t *testing.T) {
			raw, err := client.Resource.Get(ctx, name, metav1.GetOptions{})
			require.Error(t, err)
			require.Nil(t, raw)

			var statusErr *apierrors.StatusError
			require.True(t, errors.As(err, &statusErr))
			require.Equal(t, http.StatusNotFound, int(statusErr.Status().Code))
		})

		t.Run("and listing keepers returns an empty list", func(t *testing.T) {
			rawList, err := client.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.NotNil(t, rawList)
			require.Empty(t, rawList.Items)
		})
	})
}
