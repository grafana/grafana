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

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	client := helper.GetResourceClient(apis.ResourceClientArgs{
		// #TODO: figure out permissions topic
		User: helper.Org1.Admin,
		GVR:  gvrKeepers,
	})

	t.Run("reading a keeper that does not exist returns a 404", func(t *testing.T) {
		raw, err := client.Resource.Get(ctx, "some-keeper-that-does-not-exist", metav1.GetOptions{})
		require.Error(t, err)
		require.Nil(t, raw)

		var statusErr *apierrors.StatusError
		require.True(t, errors.As(err, &statusErr))
		require.Equal(t, http.StatusNotFound, int(statusErr.Status().Code))
	})

	t.Run("deleting a keeper that does not exist does not return an error", func(t *testing.T) {
		err := client.Resource.Delete(ctx, "some-keeper-that-does-not-exist", metav1.DeleteOptions{})
		require.NoError(t, err)
	})

	t.Run("creating a keeper returns it", func(t *testing.T) {
		raw := mustGenerateKeeper(t, helper, helper.Org1.Admin, nil, "testdata/keeper-aws-generate.yaml")

		keeper := new(secretv0alpha1.Keeper)
		err := runtime.DefaultUnstructuredConverter.FromUnstructured(raw.Object, keeper)
		require.NoError(t, err)
		require.NotNil(t, keeper)

		require.NotEmpty(t, keeper.Spec.Title)
		require.NotEmpty(t, keeper.Spec.AWS)
		require.Empty(t, keeper.Spec.Azure)

		t.Run("and creating another keeper with the same name in the same namespace returns an error", func(t *testing.T) {
			testKeeper := helper.LoadYAMLOrJSONFile("testdata/keeper-gcp-generate.yaml")
			testKeeper.SetName(raw.GetName())

			raw, err := client.Resource.Create(ctx, testKeeper, metav1.CreateOptions{})
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
			newRaw := helper.LoadYAMLOrJSONFile("testdata/keeper-gcp-generate.yaml")
			newRaw.SetName(raw.GetName())
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

		t.Run("and updating the keeper to reference securevalues that does not exist returns an error", func(t *testing.T) {
			newRaw := helper.LoadYAMLOrJSONFile("testdata/keeper-aws-generate.yaml")
			newRaw.SetName(raw.GetName())
			newRaw.Object["spec"].(map[string]any)["aws"] = map[string]any{
				"accessKeyId": map[string]any{
					"secureValueName": "securevalue-does-not-exist-1",
				},
				"secretAccessKey": map[string]any{
					"secureValueName": "securevalue-does-not-exist-2",
				},
			}

			updatedRaw, err := client.Resource.Update(ctx, newRaw, metav1.UpdateOptions{})
			require.Error(t, err)
			require.Nil(t, updatedRaw)
			require.Contains(t, err.Error(), "securevalue-does-not-exist-1")
			require.Contains(t, err.Error(), "securevalue-does-not-exist-2")
		})
	})

	t.Run("creating an invalid keeper fails validation and returns an error", func(t *testing.T) {
		testData := helper.LoadYAMLOrJSONFile("testdata/keeper-aws-generate.yaml")
		testData.Object["spec"].(map[string]any)["title"] = ""

		raw, err := client.Resource.Create(ctx, testData, metav1.CreateOptions{})
		require.Error(t, err)
		require.Nil(t, raw)

		var statusErr *apierrors.StatusError
		require.True(t, errors.As(err, &statusErr))
	})

	t.Run("creating a keeper with a provider then changing the provider does not return an error", func(t *testing.T) {
		rawAWS := mustGenerateKeeper(t, helper, helper.Org1.Admin, nil, "")

		testDataKeeperGCP := rawAWS.DeepCopy()
		testDataKeeperGCP.Object["spec"].(map[string]any)["sql"] = nil
		testDataKeeperGCP.Object["spec"].(map[string]any)["gcp"] = map[string]any{
			"projectId":       "project-id",
			"credentialsFile": "/path/to/file.json",
		}

		rawGCP, err := client.Resource.Update(ctx, testDataKeeperGCP, metav1.UpdateOptions{})
		require.NoError(t, err)
		require.NotNil(t, rawGCP)

		require.NotEqualValues(t, rawAWS.Object["spec"], rawGCP.Object["spec"])
	})

	t.Run("creating a keeper that references securevalues that does not exist returns an error", func(t *testing.T) {
		testDataKeeper := helper.LoadYAMLOrJSONFile("testdata/keeper-aws-generate.yaml")
		testDataKeeper.Object["spec"].(map[string]any)["aws"] = map[string]any{
			"accessKeyId": map[string]any{
				"secureValueName": "securevalue-does-not-exist-1",
			},
			"secretAccessKey": map[string]any{
				"secureValueName": "securevalue-does-not-exist-2",
			},
		}

		raw, err := client.Resource.Create(ctx, testDataKeeper, metav1.CreateOptions{})
		require.Error(t, err)
		require.Nil(t, raw)
		require.Contains(t, err.Error(), "securevalue-does-not-exist-1")
		require.Contains(t, err.Error(), "securevalue-does-not-exist-2")
	})

	t.Run("deleting a keeper that exists does not return an error", func(t *testing.T) {
		generatePrefix := "generated-"

		testData := helper.LoadYAMLOrJSONFile("testdata/keeper-aws-generate.yaml")
		testData.SetGenerateName(generatePrefix)

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

		t.Run("and listing keepers returns an empty list", func(t *testing.T) {
			rawList, err := client.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.NotNil(t, rawList)
			require.Empty(t, rawList.Items)
		})
	})

	t.Run("creating a keeper that references a securevalue that is stored in a SQL type Keeper returns no error", func(t *testing.T) {
		// 1. Create a SQL keeper.
		keeperSQL := mustGenerateKeeper(t, helper, helper.Org1.Admin, map[string]any{
			"title": "SQL Keeper",
			"sql": map[string]any{
				"encryption": map[string]any{"envelope": map[string]any{}},
			},
		}, "")

		// 2. Create a secureValue that is stored in the previously created keeper (SQL).
		secureValue := mustGenerateSecureValue(t, helper, helper.Org1.Admin, keeperSQL.GetName())

		// 3. Create a non-SQL keeper that uses the secureValue.
		keeperAWS := mustGenerateKeeper(t, helper, helper.Org1.Admin, map[string]any{
			"title": "AWS Keeper",
			"aws": map[string]any{
				"accessKeyId":     map[string]any{"secureValueName": secureValue.GetName()},
				"secretAccessKey": map[string]any{"valueFromEnv": "SECRET_ACCESS_KEY_XYZ"},
			},
		}, "")
		require.NotNil(t, keeperAWS)
	})

	t.Run("creating keepers in multiple namespaces", func(t *testing.T) {
		adminOrg1 := helper.Org1.Admin
		adminOrg2 := helper.OrgB.Admin

		keeperOrg1 := mustGenerateKeeper(t, helper, adminOrg1, nil, "")
		keeperOrg2 := mustGenerateKeeper(t, helper, adminOrg2, nil, "")

		clientOrg1 := helper.GetResourceClient(apis.ResourceClientArgs{User: adminOrg1, GVR: gvrKeepers})
		clientOrg2 := helper.GetResourceClient(apis.ResourceClientArgs{User: adminOrg2, GVR: gvrKeepers})

		// Create
		t.Run("creating a keeper with the same name as one from another namespace does not return an error", func(t *testing.T) {
			// Org1 creating a keeper with the same name from Org2.
			testData := helper.LoadYAMLOrJSONFile("testdata/keeper-aws-generate.yaml")
			testData.SetName(keeperOrg2.GetName())

			raw, err := clientOrg1.Resource.Create(ctx, testData, metav1.CreateOptions{})
			require.NoError(t, err)
			require.NotNil(t, raw)

			// Org2 creating a keeper with the same name from Org1.
			testData = helper.LoadYAMLOrJSONFile("testdata/keeper-aws-generate.yaml")
			testData.SetName(keeperOrg1.GetName())

			raw, err = clientOrg2.Resource.Create(ctx, testData, metav1.CreateOptions{})
			require.NoError(t, err)
			require.NotNil(t, raw)

			require.NoError(t, clientOrg1.Resource.Delete(ctx, keeperOrg2.GetName(), metav1.DeleteOptions{}))
			require.NoError(t, clientOrg2.Resource.Delete(ctx, keeperOrg1.GetName(), metav1.DeleteOptions{}))
		})

		// Read
		t.Run("fetching a keeper from another namespace returns not found", func(t *testing.T) {
			var statusErr *apierrors.StatusError

			// Org1 trying to fetch keeper from Org2.
			raw, err := clientOrg1.Resource.Get(ctx, keeperOrg2.GetName(), metav1.GetOptions{})
			require.Error(t, err)
			require.Nil(t, raw)
			require.True(t, errors.As(err, &statusErr))
			require.Equal(t, http.StatusNotFound, int(statusErr.Status().Code))

			// Org2 trying to fetch keeper from Org1.
			raw, err = clientOrg2.Resource.Get(ctx, keeperOrg1.GetName(), metav1.GetOptions{})
			require.Error(t, err)
			require.Nil(t, raw)
			require.True(t, errors.As(err, &statusErr))
			require.Equal(t, http.StatusNotFound, int(statusErr.Status().Code))
		})

		// Update
		t.Run("updating a keeper from another namespace returns not found", func(t *testing.T) {
			var statusErr *apierrors.StatusError

			// Org1 trying to update securevalue from Org2.
			testData := helper.LoadYAMLOrJSONFile("testdata/keeper-aws-generate.yaml")
			testData.SetName(keeperOrg2.GetName())
			testData.Object["spec"].(map[string]any)["title"] = "New title"

			raw, err := clientOrg1.Resource.Update(ctx, testData, metav1.UpdateOptions{})
			require.Error(t, err)
			require.Nil(t, raw)
			require.True(t, errors.As(err, &statusErr))
			require.Equal(t, http.StatusNotFound, int(statusErr.Status().Code))

			// Org2 trying to update keeper from Org1.
			testData = helper.LoadYAMLOrJSONFile("testdata/keeper-aws-generate.yaml")
			testData.SetName(keeperOrg1.GetName())
			testData.Object["spec"].(map[string]any)["title"] = "New title"

			raw, err = clientOrg2.Resource.Update(ctx, testData, metav1.UpdateOptions{})
			require.Error(t, err)
			require.Nil(t, raw)
			require.True(t, errors.As(err, &statusErr))
			require.Equal(t, http.StatusNotFound, int(statusErr.Status().Code))
		})

		// Delete
		t.Run("deleting a keeper from another namespace does not return an error but does not delete it", func(t *testing.T) {
			// Org1 trying to delete keeper from Org2.
			err := clientOrg1.Resource.Delete(ctx, keeperOrg2.GetName(), metav1.DeleteOptions{})
			require.NoError(t, err)

			// Check that it still exists from the perspective of Org2.
			raw, err := clientOrg2.Resource.Get(ctx, keeperOrg2.GetName(), metav1.GetOptions{})
			require.NoError(t, err)
			require.NotNil(t, raw)

			// Org2 trying to delete keeper from Org1.
			err = clientOrg2.Resource.Delete(ctx, keeperOrg1.GetName(), metav1.DeleteOptions{})
			require.NoError(t, err)

			// Check that it still exists from the perspective of Org1.
			raw, err = clientOrg1.Resource.Get(ctx, keeperOrg1.GetName(), metav1.GetOptions{})
			require.NoError(t, err)
			require.NotNil(t, raw)
		})

		// List
		t.Run("listing keeper from a namespace does not return the ones from another namespace", func(t *testing.T) {
			// Org1 listing keeper.
			listOrg1, err := clientOrg1.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.NotNil(t, listOrg1)
			require.Len(t, listOrg1.Items, 1)
			require.Equal(t, *keeperOrg1, listOrg1.Items[0])

			// Org2 listing keeper.
			listOrg2, err := clientOrg2.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.NotNil(t, listOrg2)
			require.Len(t, listOrg2.Items, 1)
			require.Equal(t, *keeperOrg2, listOrg2.Items[0])
		})
	})
}
