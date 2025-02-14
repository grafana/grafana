package secret

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret"
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

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false, // required for experimental APIs
		EnableFeatureToggles: []string{
			// Required to start the example service
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
			featuremgmt.FlagSecretsManagementAppPlatform,
		},
	})

	permissions := map[string][]string{
		ResourceSecureValues: ActionsAllSecureValues,
		// in order to create securevalues, we need to first create keepers (and delete them to clean it up).
		ResourceKeepers: []string{
			secret.ActionSecretsManagerKeepersWrite,
			secret.ActionSecretsManagerKeepersDelete,
		},
	}

	genericUserEditor := mustCreateUsers(t, helper, permissions).Editor

	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User: genericUserEditor,
		GVR:  gvrSecureValues,
	})

	t.Run("creating a secure value returns it without any of the value or ref", func(t *testing.T) {
		keeper := mustGenerateKeeper(t, helper, genericUserEditor, nil)
		raw := mustGenerateSecureValue(t, helper, genericUserEditor, keeper.GetName())

		secureValue := new(secretv0alpha1.SecureValue)
		err := runtime.DefaultUnstructuredConverter.FromUnstructured(raw.Object, secureValue)
		require.NoError(t, err)
		require.NotNil(t, secureValue)

		require.Empty(t, secureValue.Spec.Value)
		require.Empty(t, secureValue.Spec.Ref)
		require.NotEmpty(t, secureValue.Spec.Title)
		require.NotEmpty(t, secureValue.Spec.Keeper)
		require.NotEmpty(t, secureValue.Spec.Audiences)

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
			newKeeper := mustGenerateKeeper(t, helper, genericUserEditor, nil)

			newRaw := helper.LoadYAMLOrJSONFile("testdata/secure-value-generate.yaml")
			newRaw.SetName(raw.GetName())
			newRaw.Object["spec"].(map[string]any)["title"] = "New title"
			newRaw.Object["spec"].(map[string]any)["keeper"] = newKeeper.GetName()
			newRaw.Object["spec"].(map[string]any)["value"] = "New secure value"
			newRaw.Object["spec"].(map[string]any)["audiences"] = []string{"audience1/name1", "audience2/*"}
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
	})

	t.Run("creating a secure value with a `value` then updating it to a `ref` returns an error", func(t *testing.T) {
		keeper := mustGenerateKeeper(t, helper, genericUserEditor, nil)
		svWithValue := mustGenerateSecureValue(t, helper, genericUserEditor, keeper.GetName())

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

		keeper := mustGenerateKeeper(t, helper, genericUserEditor, nil)

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
		permissions := map[string][]string{
			ResourceSecureValues: ActionsAllSecureValues,
			ResourceKeepers:      ActionsAllKeepers,
		}

		editorOrgA := mustCreateUsers(t, helper, permissions).Editor
		editorOrgB := mustCreateUsers(t, helper, permissions).Editor

		keeperOrgA := mustGenerateKeeper(t, helper, editorOrgA, nil)
		keeperOrgB := mustGenerateKeeper(t, helper, editorOrgB, nil)

		secureValueOrgA := mustGenerateSecureValue(t, helper, editorOrgA, keeperOrgA.GetName())
		secureValueOrgB := mustGenerateSecureValue(t, helper, editorOrgB, keeperOrgB.GetName())

		clientOrgA := helper.GetResourceClient(apis.ResourceClientArgs{User: editorOrgA, GVR: gvrSecureValues})
		clientOrgB := helper.GetResourceClient(apis.ResourceClientArgs{User: editorOrgB, GVR: gvrSecureValues})

		// Create
		t.Run("creating a securevalue with the same name as one from another namespace does not return an error", func(t *testing.T) {
			// OrgA creating a securevalue with the same name from OrgB.
			testData := helper.LoadYAMLOrJSONFile("testdata/secure-value-generate.yaml")
			testData.SetName(secureValueOrgB.GetName())
			testData.Object["spec"].(map[string]any)["keeper"] = keeperOrgA.GetName()

			raw, err := clientOrgA.Resource.Create(ctx, testData, metav1.CreateOptions{})
			require.NoError(t, err)
			require.NotNil(t, raw)

			// OrgB creating a securevalue with the same name from OrgA.
			testData = helper.LoadYAMLOrJSONFile("testdata/secure-value-generate.yaml")
			testData.SetName(secureValueOrgA.GetName())
			testData.Object["spec"].(map[string]any)["keeper"] = keeperOrgB.GetName()

			raw, err = clientOrgB.Resource.Create(ctx, testData, metav1.CreateOptions{})
			require.NoError(t, err)
			require.NotNil(t, raw)

			require.NoError(t, clientOrgA.Resource.Delete(ctx, secureValueOrgB.GetName(), metav1.DeleteOptions{}))
			require.NoError(t, clientOrgB.Resource.Delete(ctx, secureValueOrgA.GetName(), metav1.DeleteOptions{}))
		})

		// Read
		t.Run("fetching a securevalue from another namespace returns not found", func(t *testing.T) {
			var statusErr *apierrors.StatusError

			// OrgA trying to fetch securevalue from OrgB.
			raw, err := clientOrgA.Resource.Get(ctx, secureValueOrgB.GetName(), metav1.GetOptions{})
			require.Error(t, err)
			require.Nil(t, raw)
			require.True(t, errors.As(err, &statusErr))
			require.Equal(t, http.StatusNotFound, int(statusErr.Status().Code))

			// OrgB trying to fetch securevalue from OrgA.
			raw, err = clientOrgB.Resource.Get(ctx, secureValueOrgA.GetName(), metav1.GetOptions{})
			require.Error(t, err)
			require.Nil(t, raw)
			require.True(t, errors.As(err, &statusErr))
			require.Equal(t, http.StatusNotFound, int(statusErr.Status().Code))
		})

		// Update
		t.Run("updating a securevalue from another namespace returns not found", func(t *testing.T) {
			var statusErr *apierrors.StatusError

			// OrgA trying to update securevalue from OrgB.
			testData := helper.LoadYAMLOrJSONFile("testdata/secure-value-generate.yaml")
			testData.SetName(secureValueOrgB.GetName())
			testData.Object["spec"].(map[string]any)["title"] = "New title"

			raw, err := clientOrgA.Resource.Update(ctx, testData, metav1.UpdateOptions{})
			require.Error(t, err)
			require.Nil(t, raw)
			require.True(t, errors.As(err, &statusErr))
			require.Equal(t, http.StatusNotFound, int(statusErr.Status().Code))

			// OrgB trying to update securevalue from OrgA.
			testData = helper.LoadYAMLOrJSONFile("testdata/secure-value-generate.yaml")
			testData.SetName(secureValueOrgA.GetName())
			testData.Object["spec"].(map[string]any)["title"] = "New title"

			raw, err = clientOrgB.Resource.Update(ctx, testData, metav1.UpdateOptions{})
			require.Error(t, err)
			require.Nil(t, raw)
			require.True(t, errors.As(err, &statusErr))
			require.Equal(t, http.StatusNotFound, int(statusErr.Status().Code))
		})

		// Delete
		t.Run("deleting a securevalue from another namespace does not return an error but does not delete it", func(t *testing.T) {
			// OrgA trying to delete securevalue from OrgB.
			err := clientOrgA.Resource.Delete(ctx, secureValueOrgB.GetName(), metav1.DeleteOptions{})
			require.NoError(t, err)

			// Check that it still exists from the perspective of OrgB.
			raw, err := clientOrgB.Resource.Get(ctx, secureValueOrgB.GetName(), metav1.GetOptions{})
			require.NoError(t, err)
			require.NotNil(t, raw)

			// OrgB trying to delete securevalue from OrgA.
			err = clientOrgB.Resource.Delete(ctx, secureValueOrgA.GetName(), metav1.DeleteOptions{})
			require.NoError(t, err)

			// Check that it still exists from the perspective of OrgA.
			raw, err = clientOrgA.Resource.Get(ctx, secureValueOrgA.GetName(), metav1.GetOptions{})
			require.NoError(t, err)
			require.NotNil(t, raw)
		})

		// List
		t.Run("listing securevalues from a namespace does not return the ones from another namespace", func(t *testing.T) {
			// OrgA listing securevalues.
			listOrgA, err := clientOrgA.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.NotNil(t, listOrgA)
			require.Len(t, listOrgA.Items, 1)
			require.Equal(t, *secureValueOrgA, listOrgA.Items[0])

			// OrgB listing securevalues.
			listOrgB, err := clientOrgB.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.NotNil(t, listOrgB)
			require.Len(t, listOrgB.Items, 1)
			require.Equal(t, *secureValueOrgB, listOrgB.Items[0])
		})
	})

	t.Run("securevalue actions without having required permissions", func(t *testing.T) {
		// Create users on a random org without specifying secrets-related permissions.
		editorP := mustCreateUsers(t, helper, nil).Editor

		clientP := helper.GetResourceClient(apis.ResourceClientArgs{
			User: editorP,
			GVR:  gvrSecureValues,
		})

		// GET
		rawGet, err := clientP.Resource.Get(ctx, "some-securevalue", metav1.GetOptions{})
		require.Error(t, err)
		require.Nil(t, rawGet)

		var statusGetErr *apierrors.StatusError
		require.True(t, errors.As(err, &statusGetErr))
		require.EqualValues(t, http.StatusForbidden, statusGetErr.Status().Code)

		// LIST
		rawList, err := clientP.Resource.List(ctx, metav1.ListOptions{})
		require.Error(t, err)
		require.Nil(t, rawList)

		var statusListErr *apierrors.StatusError
		require.True(t, errors.As(err, &statusListErr))
		require.EqualValues(t, http.StatusForbidden, statusListErr.Status().Code)

		// CREATE
		testSecureValue := helper.LoadYAMLOrJSONFile("testdata/secure-value-generate.yaml") // to pass validation before authz.
		rawCreate, err := clientP.Resource.Create(ctx, testSecureValue, metav1.CreateOptions{})
		require.Error(t, err)
		require.Nil(t, rawCreate)

		var statusCreateErr *apierrors.StatusError
		require.True(t, errors.As(err, &statusCreateErr))
		require.EqualValues(t, http.StatusForbidden, statusCreateErr.Status().Code)

		// UPDATE
		testSecureValue.SetName("test") // to pass validation before authz.
		rawUpdate, err := clientP.Resource.Update(ctx, testSecureValue, metav1.UpdateOptions{})
		require.Error(t, err)
		require.Nil(t, rawUpdate)

		var statusUpdateErr *apierrors.StatusError
		require.True(t, errors.As(err, &statusUpdateErr))
		require.EqualValues(t, http.StatusForbidden, statusUpdateErr.Status().Code)

		// DELETE
		err = clientP.Resource.Delete(ctx, "some-securevalue", metav1.DeleteOptions{})
		require.Error(t, err)

		var statusDeleteErr *apierrors.StatusError
		require.True(t, errors.As(err, &statusDeleteErr))
		require.EqualValues(t, http.StatusForbidden, statusDeleteErr.Status().Code)
	})
}
