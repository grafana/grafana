package secret

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"testing"

	keepertypes "github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/types"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

var gvrSecureValues = schema.GroupVersionResource{
	Group:    "secret.grafana.app",
	Version:  "v0alpha1",
	Resource: "securevalues",
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

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	client := helper.GetResourceClient(apis.ResourceClientArgs{
		// #TODO: figure out permissions topic
		User: helper.Org1.Admin,
		GVR:  gvrSecureValues,
	})

	t.Run("creating a secure value returns it without any of the value or ref", func(t *testing.T) {
		keeper := mustGenerateKeeper(t, helper, helper.Org1.Admin, nil, "")
		raw := mustGenerateSecureValue(t, helper, helper.Org1.Admin, keeper.GetName())

		secureValue := new(secretv0alpha1.SecureValue)
		err := runtime.DefaultUnstructuredConverter.FromUnstructured(raw.Object, secureValue)
		require.NoError(t, err)
		require.NotNil(t, secureValue)

		require.Empty(t, secureValue.Spec.Value)
		require.Empty(t, secureValue.Spec.Ref)
		require.NotEmpty(t, secureValue.Spec.Title)
		require.NotEmpty(t, secureValue.Spec.Keeper)
		require.NotEmpty(t, secureValue.Spec.Decrypters)

		t.Run("and creating another secure value with the same name in the same namespace returns an error", func(t *testing.T) {
			testSecureValue := helper.LoadYAMLOrJSONFile("testdata/secure-value-generate.yaml")
			testSecureValue.SetName(raw.GetName())

			raw, err := client.Resource.Create(ctx, testSecureValue, metav1.CreateOptions{})
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

		t.Run("and listing securevalues returns the created secure value", func(t *testing.T) {
			rawList, err := client.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.NotNil(t, rawList)
			require.GreaterOrEqual(t, len(rawList.Items), 1)
			require.Equal(t, secureValue.Name, rawList.Items[0].GetName())
		})

		t.Run("and updating the secure value replaces the spec fields and returns them", func(t *testing.T) {
			newRaw := helper.LoadYAMLOrJSONFile("testdata/secure-value-generate.yaml")
			newRaw.SetName(raw.GetName())
			newRaw.Object["spec"].(map[string]any)["title"] = "New title"
			newRaw.Object["spec"].(map[string]any)["value"] = "New secure value"
			newRaw.Object["spec"].(map[string]any)["keeper"] = keeper.GetName()
			newRaw.Object["spec"].(map[string]any)["decrypters"] = []string{"decrypter1/name1", "decrypter2/*"}
			newRaw.Object["metadata"].(map[string]any)["annotations"] = map[string]any{"newAnnotation": "newValue"}

			updatedRaw, err := client.Resource.Update(ctx, newRaw, metav1.UpdateOptions{})
			require.NoError(t, err)
			require.NotNil(t, updatedRaw)

			updatedSecureValue := new(secretv0alpha1.SecureValue)
			err = runtime.DefaultUnstructuredConverter.FromUnstructured(updatedRaw.Object, updatedSecureValue)
			require.NoError(t, err)
			require.NotNil(t, updatedSecureValue)

			require.NotEqualValues(t, updatedSecureValue.Spec, secureValue.Spec)
		})

		t.Run("and updating the secure value keeper is not allowed and returns error", func(t *testing.T) {
			newKeeper := mustGenerateKeeper(t, helper, helper.Org1.Admin, nil, "")

			newRaw := helper.LoadYAMLOrJSONFile("testdata/secure-value-generate.yaml")
			newRaw.SetName(raw.GetName())
			newRaw.Object["spec"].(map[string]any)["title"] = "New title"
			newRaw.Object["spec"].(map[string]any)["keeper"] = newKeeper.GetName()
			newRaw.Object["spec"].(map[string]any)["value"] = "New secure value"

			updatedRaw, err := client.Resource.Update(ctx, newRaw, metav1.UpdateOptions{})
			require.Error(t, err)
			require.Nil(t, updatedRaw)
		})
	})

	t.Run("creating a secure value with a `value` then updating it to a `ref` returns an error", func(t *testing.T) {
		keeper := mustGenerateKeeper(t, helper, helper.Org1.Admin, nil, "")
		svWithValue := mustGenerateSecureValue(t, helper, helper.Org1.Admin, keeper.GetName())

		testData := svWithValue.DeepCopy()
		testData.Object["spec"].(map[string]any)["value"] = nil
		testData.Object["spec"].(map[string]any)["ref"] = "some-ref"

		raw, err := client.Resource.Update(ctx, testData, metav1.UpdateOptions{})
		require.Error(t, err)
		require.Nil(t, raw)
	})

	t.Run("creating an invalid secure value fails validation and returns an error", func(t *testing.T) {
		testData := helper.LoadYAMLOrJSONFile("testdata/secure-value-generate.yaml")
		testData.Object["spec"].(map[string]any)["title"] = ""

		raw, err := client.Resource.Create(ctx, testData, metav1.CreateOptions{})
		require.Error(t, err)
		require.Nil(t, raw)

		var statusErr *apierrors.StatusError
		require.True(t, errors.As(err, &statusErr))
	})

	t.Run("reading a secure value that does not exist returns a 404", func(t *testing.T) {
		raw, err := client.Resource.Get(ctx, "some-secure-value-that-does-not-exist", metav1.GetOptions{})
		require.Error(t, err)
		require.Nil(t, raw)

		var statusErr *apierrors.StatusError
		require.True(t, errors.As(err, &statusErr))
		require.Equal(t, http.StatusNotFound, int(statusErr.Status().Code))
	})

	t.Run("deleting a secure value that does not exist does not return an error", func(t *testing.T) {
		err := client.Resource.Delete(ctx, "some-secure-value-that-does-not-exist", metav1.DeleteOptions{})
		require.NoError(t, err)
	})

	t.Run("deleting a secure value that exists does not return an error", func(t *testing.T) {
		generatePrefix := "generated-"

		keeper := mustGenerateKeeper(t, helper, helper.Org1.Admin, nil, "")

		testData := helper.LoadYAMLOrJSONFile("testdata/secure-value-generate.yaml")
		testData.SetGenerateName(generatePrefix)
		testData.Object["spec"].(map[string]any)["keeper"] = keeper.GetName()

		raw, err := client.Resource.Create(ctx, testData, metav1.CreateOptions{})
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

		t.Run("and listing secure values returns an empty list", func(t *testing.T) {
			rawList, err := client.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.NotNil(t, rawList)
			require.Empty(t, rawList.Items)
		})
	})

	t.Run("creating securevalues in multiple namespaces", func(t *testing.T) {
		adminOrg1 := helper.Org1.Admin
		adminOrg2 := helper.OrgB.Admin

		keeperOrg1 := mustGenerateKeeper(t, helper, adminOrg1, nil, "")
		keeperOrg2 := mustGenerateKeeper(t, helper, adminOrg2, nil, "")

		secureValueOrg1 := mustGenerateSecureValue(t, helper, adminOrg1, keeperOrg1.GetName())
		secureValueOrg2 := mustGenerateSecureValue(t, helper, adminOrg2, keeperOrg2.GetName())

		clientOrg1 := helper.GetResourceClient(apis.ResourceClientArgs{User: adminOrg1, GVR: gvrSecureValues})
		clientOrg2 := helper.GetResourceClient(apis.ResourceClientArgs{User: adminOrg2, GVR: gvrSecureValues})

		// Create
		t.Run("creating a securevalue with the same name as one from another namespace does not return an error", func(t *testing.T) {
			// Org1 creating a securevalue with the same name from Org2.
			testData := helper.LoadYAMLOrJSONFile("testdata/secure-value-generate.yaml")
			testData.SetName(secureValueOrg2.GetName())
			testData.Object["spec"].(map[string]any)["keeper"] = keeperOrg1.GetName()

			raw, err := clientOrg1.Resource.Create(ctx, testData, metav1.CreateOptions{})
			require.NoError(t, err)
			require.NotNil(t, raw)

			// Org2 creating a securevalue with the same name from Org1.
			testData = helper.LoadYAMLOrJSONFile("testdata/secure-value-generate.yaml")
			testData.SetName(secureValueOrg1.GetName())
			testData.Object["spec"].(map[string]any)["keeper"] = keeperOrg2.GetName()

			raw, err = clientOrg2.Resource.Create(ctx, testData, metav1.CreateOptions{})
			require.NoError(t, err)
			require.NotNil(t, raw)

			require.NoError(t, clientOrg1.Resource.Delete(ctx, secureValueOrg2.GetName(), metav1.DeleteOptions{}))
			require.NoError(t, clientOrg2.Resource.Delete(ctx, secureValueOrg1.GetName(), metav1.DeleteOptions{}))
		})

		// Read
		t.Run("fetching a securevalue from another namespace returns not found", func(t *testing.T) {
			var statusErr *apierrors.StatusError

			// Org1 trying to fetch securevalue from Org2.
			raw, err := clientOrg1.Resource.Get(ctx, secureValueOrg2.GetName(), metav1.GetOptions{})
			require.Error(t, err)
			require.Nil(t, raw)
			require.True(t, errors.As(err, &statusErr))
			require.Equal(t, http.StatusNotFound, int(statusErr.Status().Code))

			// Org2 trying to fetch securevalue from Org1.
			raw, err = clientOrg2.Resource.Get(ctx, secureValueOrg1.GetName(), metav1.GetOptions{})
			require.Error(t, err)
			require.Nil(t, raw)
			require.True(t, errors.As(err, &statusErr))
			require.Equal(t, http.StatusNotFound, int(statusErr.Status().Code))
		})

		// Update
		t.Run("updating a securevalue from another namespace returns not found", func(t *testing.T) {
			var statusErr *apierrors.StatusError

			// Org1 trying to update securevalue from Org2.
			testData := helper.LoadYAMLOrJSONFile("testdata/secure-value-generate.yaml")
			testData.SetName(secureValueOrg2.GetName())
			testData.Object["spec"].(map[string]any)["title"] = "New title"

			raw, err := clientOrg1.Resource.Update(ctx, testData, metav1.UpdateOptions{})
			require.Error(t, err)
			require.Nil(t, raw)
			require.True(t, errors.As(err, &statusErr))
			require.Equal(t, http.StatusNotFound, int(statusErr.Status().Code))

			// Org2 trying to update securevalue from Org1.
			testData = helper.LoadYAMLOrJSONFile("testdata/secure-value-generate.yaml")
			testData.SetName(secureValueOrg1.GetName())
			testData.Object["spec"].(map[string]any)["title"] = "New title"

			raw, err = clientOrg2.Resource.Update(ctx, testData, metav1.UpdateOptions{})
			require.Error(t, err)
			require.Nil(t, raw)
			require.True(t, errors.As(err, &statusErr))
			require.Equal(t, http.StatusNotFound, int(statusErr.Status().Code))
		})

		// Delete
		t.Run("deleting a securevalue from another namespace does not return an error but does not delete it", func(t *testing.T) {
			// Org1 trying to delete securevalue from Org2.
			err := clientOrg1.Resource.Delete(ctx, secureValueOrg2.GetName(), metav1.DeleteOptions{})
			require.NoError(t, err)

			// Check that it still exists from the perspective of Org2.
			raw, err := clientOrg2.Resource.Get(ctx, secureValueOrg2.GetName(), metav1.GetOptions{})
			require.NoError(t, err)
			require.NotNil(t, raw)

			// Org2 trying to delete securevalue from Org1.
			err = clientOrg2.Resource.Delete(ctx, secureValueOrg1.GetName(), metav1.DeleteOptions{})
			require.NoError(t, err)

			// Check that it still exists from the perspective of Org1.
			raw, err = clientOrg1.Resource.Get(ctx, secureValueOrg1.GetName(), metav1.GetOptions{})
			require.NoError(t, err)
			require.NotNil(t, raw)
		})

		// List
		t.Run("listing securevalues from a namespace does not return the ones from another namespace", func(t *testing.T) {
			// Org1 listing securevalues.
			listOrg1, err := clientOrg1.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.NotNil(t, listOrg1)
			require.Len(t, listOrg1.Items, 1)
			require.Equal(t, *secureValueOrg1, listOrg1.Items[0])

			// Org2 listing securevalues.
			listOrg2, err := clientOrg2.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.NotNil(t, listOrg2)
			require.Len(t, listOrg2.Items, 1)
			require.Equal(t, *secureValueOrg2, listOrg2.Items[0])
		})
	})

	t.Run("creating a secure value with a not implemented keeper returns error", func(t *testing.T) {
		keeper := mustGenerateKeeper(t, helper, helper.Org1.Admin, nil, "testdata/keeper-aws-generate.yaml")
		testSecureValue := helper.LoadYAMLOrJSONFile("testdata/secure-value-generate.yaml")
		testSecureValue.Object["spec"].(map[string]any)["keeper"] = keeper.GetName()

		raw, err := client.Resource.Create(ctx, testSecureValue, metav1.CreateOptions{})
		require.Error(t, err)
		require.Nil(t, raw)
	})

	t.Run("creating a secure value in default sql keeper returns it", func(t *testing.T) {
		raw := mustGenerateSecureValue(t, helper, helper.Org1.Admin, keepertypes.DefaultSQLKeeper)

		secureValue := new(secretv0alpha1.SecureValue)
		err := runtime.DefaultUnstructuredConverter.FromUnstructured(raw.Object, secureValue)
		require.NoError(t, err)
		require.NotNil(t, secureValue)

		require.Empty(t, secureValue.Spec.Value)
		require.Empty(t, secureValue.Spec.Ref)
		require.NotEmpty(t, secureValue.Spec.Title)
		require.NotEmpty(t, secureValue.Spec.Keeper)
		require.NotEmpty(t, secureValue.Spec.Decrypters)

		t.Run("and creating another secure value with the same name in the same namespace returns an error", func(t *testing.T) {
			testSecureValue := helper.LoadYAMLOrJSONFile("testdata/secure-value-generate.yaml")
			testSecureValue.SetName(raw.GetName())

			raw, err := client.Resource.Create(ctx, testSecureValue, metav1.CreateOptions{})
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

		t.Run("and listing securevalues returns the created secure value", func(t *testing.T) {
			rawList, err := client.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.NotNil(t, rawList)
			require.GreaterOrEqual(t, len(rawList.Items), 1)
			require.Equal(t, secureValue.Name, rawList.Items[0].GetName())
		})

		t.Run("and updating the secure value replaces the spec fields and returns them", func(t *testing.T) {
			newRaw := helper.LoadYAMLOrJSONFile("testdata/secure-value-generate.yaml")
			newRaw.SetName(raw.GetName())
			newRaw.Object["spec"].(map[string]any)["title"] = "New title"
			newRaw.Object["spec"].(map[string]any)["value"] = "New secure value"
			newRaw.Object["spec"].(map[string]any)["keeper"] = keepertypes.DefaultSQLKeeper
			newRaw.Object["spec"].(map[string]any)["decrypters"] = []string{"decrypter1/name1", "decrypter2/*"}
			newRaw.Object["metadata"].(map[string]any)["annotations"] = map[string]any{"newAnnotation": "newValue"}

			updatedRaw, err := client.Resource.Update(ctx, newRaw, metav1.UpdateOptions{})
			require.NoError(t, err)
			require.NotNil(t, updatedRaw)

			updatedSecureValue := new(secretv0alpha1.SecureValue)
			err = runtime.DefaultUnstructuredConverter.FromUnstructured(updatedRaw.Object, updatedSecureValue)
			require.NoError(t, err)
			require.NotNil(t, updatedSecureValue)

			require.NotEqualValues(t, updatedSecureValue.Spec, secureValue.Spec)
		})

		t.Run("and updating the secure value keeper is not allowed and returns error", func(t *testing.T) {
			newKeeper := mustGenerateKeeper(t, helper, helper.Org1.Admin, nil, "")

			newRaw := helper.LoadYAMLOrJSONFile("testdata/secure-value-generate.yaml")
			newRaw.SetName(raw.GetName())
			newRaw.Object["spec"].(map[string]any)["title"] = "New title"
			newRaw.Object["spec"].(map[string]any)["keeper"] = newKeeper.GetName()
			newRaw.Object["spec"].(map[string]any)["value"] = "New secure value"

			updatedRaw, err := client.Resource.Update(ctx, newRaw, metav1.UpdateOptions{})
			require.Error(t, err)
			require.Nil(t, updatedRaw)
		})
	})
}
