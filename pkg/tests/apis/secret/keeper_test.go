package secret

import (
	"context"
	"errors"
	"math/rand/v2"
	"net/http"
	"strconv"
	"strings"
	"testing"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret"
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
	Group:    secretv0alpha1.GROUP,
	Version:  secretv0alpha1.VERSION,
	Resource: secretv0alpha1.KeeperResourceInfo.GetName(),
}

func TestIntegrationKeeper(t *testing.T) {
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

	permissions := map[string]ResourcePermission{ResourceKeepers: {Actions: ActionsAllKeepers}}

	genericUserEditor := mustCreateUsers(t, helper, permissions).Editor

	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User: genericUserEditor,
		GVR:  gvrKeepers,
	})

	t.Run("reading a keeper that does not exist returns a 404", func(t *testing.T) {
		raw, err := client.Resource.Get(ctx, "some-keeper-that-does-not-exist", metav1.GetOptions{})
		require.Error(t, err)
		require.Nil(t, raw)

		var statusErr *apierrors.StatusError
		require.True(t, errors.As(err, &statusErr))
		require.Equal(t, "keeper.secret.grafana.app \"some-keeper-that-does-not-exist\" not found", err.Error())
		require.Equal(t, http.StatusNotFound, int(statusErr.Status().Code))
	})

	t.Run("deleting a keeper that does not exist returns an error", func(t *testing.T) {
		err := client.Resource.Delete(ctx, "some-keeper-that-does-not-exist", metav1.DeleteOptions{})
		require.Error(t, err)

		var statusErr *apierrors.StatusError
		require.True(t, errors.As(err, &statusErr))
		require.Equal(t, "keeper.secret.grafana.app \"some-keeper-that-does-not-exist\" not found", err.Error())
		require.Equal(t, http.StatusNotFound, int(statusErr.Status().Code))
	})

	t.Run("creating a keeper returns it", func(t *testing.T) {
		raw := mustGenerateKeeper(t, helper, genericUserEditor, nil, "testdata/keeper-aws-generate.yaml")

		keeper := new(secretv0alpha1.Keeper)
		err := runtime.DefaultUnstructuredConverter.FromUnstructured(raw.Object, keeper)
		require.NoError(t, err)
		require.NotNil(t, keeper)

		require.NotEmpty(t, keeper.Spec.Description)
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
			newRaw.Object["spec"].(map[string]any)["description"] = "New description"
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
		testData.Object["spec"].(map[string]any)["description"] = ""

		raw, err := client.Resource.Create(ctx, testData, metav1.CreateOptions{})
		require.Error(t, err)
		require.Nil(t, raw)

		var statusErr *apierrors.StatusError
		require.True(t, errors.As(err, &statusErr))
	})

	t.Run("creating a keeper with a provider then changing the provider does not return an error", func(t *testing.T) {
		rawAWS := mustGenerateKeeper(t, helper, genericUserEditor, nil, "testdata/keeper-aws-generate.yaml")

		testDataKeeperGCP := rawAWS.DeepCopy()
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

	t.Run("creating a keeper that references a securevalue that is stored in the System Keeper returns no error", func(t *testing.T) {
		// 1. Create user with required permissions.
		permissions := map[string]ResourcePermission{
			ResourceKeepers: {Actions: ActionsAllKeepers},
			// needed for this test to create (and read+delete for cleanup) securevalues.
			ResourceSecureValues: {
				Actions: []string{
					secret.ActionSecretSecureValuesCreate,
					secret.ActionSecretSecureValuesRead,
					secret.ActionSecretSecureValuesDelete,
				},
			},
		}

		editor := mustCreateUsers(t, helper, permissions).Editor

		// 2. Create a secureValue that is stored in the system keeper.
		secureValue := mustGenerateSecureValue(t, helper, editor)

		// 3. Create a keeper that uses the secureValue.
		keeperAWS := mustGenerateKeeper(t, helper, editor, map[string]any{
			"description": "AWS Keeper",
			"aws": map[string]any{
				"accessKeyId":     map[string]any{"secureValueName": secureValue.GetName()},
				"secretAccessKey": map[string]any{"valueFromEnv": "SECRET_ACCESS_KEY_XYZ"},
			},
		}, "testdata/keeper-aws-generate.yaml")
		require.NotNil(t, keeperAWS)
	})

	t.Run("creating a keeper that references a securevalue that is stored in a 3rdparty Keeper returns an error", func(t *testing.T) {
		t.Skip("skipping because there is no 3rdparty keeper implementation for OSS, move this test to Enterprise")

		// 0. Create user with required permissions.
		permissions := map[string]ResourcePermission{
			ResourceKeepers: {Actions: ActionsAllKeepers},
			// needed for this test to create (and read+delete for cleanup) securevalues.
			ResourceSecureValues: {
				Actions: []string{
					secret.ActionSecretSecureValuesCreate,
					secret.ActionSecretSecureValuesRead,
					secret.ActionSecretSecureValuesDelete,
				},
			},
		}

		editor := mustCreateUsers(t, helper, permissions).Editor

		// 1. Create a 3rdparty keeper.
		keeperAWS := mustGenerateKeeper(t, helper, editor, nil, "testdata/keeper-aws-generate.yaml")

		// 2. Create a secureValue that is stored in the previously created keeper (AWS).
		secureValue := mustGenerateSecureValue(t, helper, editor, keeperAWS.GetName())

		// 3. Create another 3rdparty keeper that uses the secureValue.
		testDataKeeperAWS := helper.LoadYAMLOrJSONFile("testdata/keeper-aws-generate.yaml")
		testDataKeeperAWS.Object["spec"].(map[string]any)["aws"] = map[string]any{
			"accessKeyId": map[string]any{
				"secureValueName": secureValue.GetName(),
			},
			"secretAccessKey": map[string]any{
				"secureValueName": secureValue.GetName(),
			},
		}

		editorClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User: editor,
			GVR:  gvrKeepers,
		})

		raw, err := editorClient.Resource.Create(ctx, testDataKeeperAWS, metav1.CreateOptions{})
		require.Error(t, err)
		require.Nil(t, raw)
		require.Contains(t, err.Error(), secureValue.GetName())
	})

	t.Run("creating keepers in multiple namespaces", func(t *testing.T) {
		permissions := map[string]ResourcePermission{
			ResourceKeepers: {Actions: ActionsAllKeepers},
		}

		editorOrgA := mustCreateUsers(t, helper, permissions).Editor
		editorOrgB := mustCreateUsers(t, helper, permissions).Editor

		keeperOrgA := mustGenerateKeeper(t, helper, editorOrgA, nil, "testdata/keeper-aws-generate.yaml")
		keeperOrgB := mustGenerateKeeper(t, helper, editorOrgB, nil, "testdata/keeper-aws-generate.yaml")

		clientOrgA := helper.GetResourceClient(apis.ResourceClientArgs{User: editorOrgA, GVR: gvrKeepers})
		clientOrgB := helper.GetResourceClient(apis.ResourceClientArgs{User: editorOrgB, GVR: gvrKeepers})

		// Create
		t.Run("creating a keeper with the same name as one from another namespace does not return an error", func(t *testing.T) {
			// OrgA creating a keeper with the same name from OrgB.
			testData := helper.LoadYAMLOrJSONFile("testdata/keeper-aws-generate.yaml")
			testData.SetName(keeperOrgB.GetName())

			raw, err := clientOrgA.Resource.Create(ctx, testData, metav1.CreateOptions{})
			require.NoError(t, err)
			require.NotNil(t, raw)

			// OrgA creating a keeper with the same name from OrgB.
			testData = helper.LoadYAMLOrJSONFile("testdata/keeper-aws-generate.yaml")
			testData.SetName(keeperOrgA.GetName())

			raw, err = clientOrgB.Resource.Create(ctx, testData, metav1.CreateOptions{})
			require.NoError(t, err)
			require.NotNil(t, raw)

			require.NoError(t, clientOrgA.Resource.Delete(ctx, keeperOrgB.GetName(), metav1.DeleteOptions{}))
			require.NoError(t, clientOrgB.Resource.Delete(ctx, keeperOrgA.GetName(), metav1.DeleteOptions{}))
		})

		// Read
		t.Run("fetching a keeper from another namespace returns not found", func(t *testing.T) {
			var statusErr *apierrors.StatusError

			// OrgA trying to fetch keeper from OrgB.
			raw, err := clientOrgA.Resource.Get(ctx, keeperOrgB.GetName(), metav1.GetOptions{})
			require.Error(t, err)
			require.Nil(t, raw)
			require.True(t, errors.As(err, &statusErr))
			require.Equal(t, http.StatusNotFound, int(statusErr.Status().Code))

			// OrgB trying to fetch keeper from OrgA.
			raw, err = clientOrgB.Resource.Get(ctx, keeperOrgA.GetName(), metav1.GetOptions{})
			require.Error(t, err)
			require.Nil(t, raw)
			require.True(t, errors.As(err, &statusErr))
			require.Equal(t, http.StatusNotFound, int(statusErr.Status().Code))
		})

		// Update
		t.Run("updating a keeper from another namespace returns not found", func(t *testing.T) {
			var statusErr *apierrors.StatusError

			// OrgA trying to update securevalue from OrgB.
			testData := helper.LoadYAMLOrJSONFile("testdata/keeper-aws-generate.yaml")
			testData.SetName(keeperOrgB.GetName())
			testData.Object["spec"].(map[string]any)["description"] = "New description"

			raw, err := clientOrgA.Resource.Update(ctx, testData, metav1.UpdateOptions{})
			require.Error(t, err)
			require.Nil(t, raw)
			require.True(t, errors.As(err, &statusErr))
			require.Equal(t, http.StatusNotFound, int(statusErr.Status().Code))

			// OrgB trying to update keeper from OrgA.
			testData = helper.LoadYAMLOrJSONFile("testdata/keeper-aws-generate.yaml")
			testData.SetName(keeperOrgA.GetName())
			testData.Object["spec"].(map[string]any)["description"] = "New description"

			raw, err = clientOrgB.Resource.Update(ctx, testData, metav1.UpdateOptions{})
			require.Error(t, err)
			require.Nil(t, raw)
			require.True(t, errors.As(err, &statusErr))
			require.Equal(t, http.StatusNotFound, int(statusErr.Status().Code))
		})

		// Delete
		t.Run("deleting a keeper from another namespace returns an error and does not delete it", func(t *testing.T) {
			var statusErr *apierrors.StatusError

			// OrgA trying to delete keeper from OrgB.
			err := clientOrgA.Resource.Delete(ctx, keeperOrgB.GetName(), metav1.DeleteOptions{})
			require.Error(t, err)
			require.True(t, errors.As(err, &statusErr))
			require.Equal(t, http.StatusNotFound, int(statusErr.Status().Code))

			// Check that it still exists from the perspective of OrgB.
			raw, err := clientOrgB.Resource.Get(ctx, keeperOrgB.GetName(), metav1.GetOptions{})
			require.NoError(t, err)
			require.NotNil(t, raw)

			// OrgB trying to delete keeper from OrgA.
			err = clientOrgB.Resource.Delete(ctx, keeperOrgA.GetName(), metav1.DeleteOptions{})
			require.Error(t, err)
			require.Equal(t, http.StatusNotFound, int(statusErr.Status().Code))

			// Check that it still exists from the perspective of OrgA.
			raw, err = clientOrgA.Resource.Get(ctx, keeperOrgA.GetName(), metav1.GetOptions{})
			require.NoError(t, err)
			require.NotNil(t, raw)
		})

		// List
		t.Run("listing keeper from a namespace does not return the ones from another namespace", func(t *testing.T) {
			// OrgA listing keeper.
			listOrgA, err := clientOrgA.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.NotNil(t, listOrgA)
			require.Len(t, listOrgA.Items, 1)
			require.Equal(t, *keeperOrgA, listOrgA.Items[0])

			// OrgB listing keeper.
			listOrgB, err := clientOrgB.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.NotNil(t, listOrgB)
			require.Len(t, listOrgB.Items, 1)
			require.Equal(t, *keeperOrgB, listOrgB.Items[0])
		})
	})

	t.Run("keeper actions without having required permissions", func(t *testing.T) {
		// Create users on a random org without specifying secrets-related permissions.
		editorP := mustCreateUsers(t, helper, nil).Editor

		clientP := helper.GetResourceClient(apis.ResourceClientArgs{
			User: editorP,
			GVR:  gvrKeepers,
		})

		// GET
		rawGet, err := clientP.Resource.Get(ctx, "some-keeper", metav1.GetOptions{})
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
		testKeeper := helper.LoadYAMLOrJSONFile("testdata/keeper-gcp-generate.yaml") // to pass validation before authz.
		rawCreate, err := clientP.Resource.Create(ctx, testKeeper, metav1.CreateOptions{})
		require.Error(t, err)
		require.Nil(t, rawCreate)

		var statusCreateErr *apierrors.StatusError
		require.True(t, errors.As(err, &statusCreateErr))
		require.EqualValues(t, http.StatusForbidden, statusCreateErr.Status().Code)

		// UPDATE
		testKeeper.SetName("test") // to pass validation before authz.
		rawUpdate, err := clientP.Resource.Update(ctx, testKeeper, metav1.UpdateOptions{})
		require.Error(t, err)
		require.Nil(t, rawUpdate)

		var statusUpdateErr *apierrors.StatusError
		require.True(t, errors.As(err, &statusUpdateErr))
		require.EqualValues(t, http.StatusForbidden, statusUpdateErr.Status().Code)

		// DELETE
		err = clientP.Resource.Delete(ctx, "some-keeper", metav1.DeleteOptions{})
		require.Error(t, err)

		var statusDeleteErr *apierrors.StatusError
		require.True(t, errors.As(err, &statusDeleteErr))
		require.EqualValues(t, http.StatusForbidden, statusDeleteErr.Status().Code)
	})

	t.Run("keeper actions with permissions but with limited scope", func(t *testing.T) {
		suffix := strconv.FormatInt(rand.Int64(), 10)

		// Fix the Keeper names.
		keeperName := "kp-" + suffix
		testKeeper := helper.LoadYAMLOrJSONFile("testdata/keeper-gcp-generate.yaml")
		testKeeper.SetName(keeperName)

		keeperNameAnother := "kp-another-" + suffix
		testKeeperAnother := helper.LoadYAMLOrJSONFile("testdata/keeper-gcp-generate.yaml")
		testKeeperAnother.SetName(keeperNameAnother)

		// Fix the org ID because we will create another user with scope "all" permissions on the same org, to compare.
		orgID := rand.Int64() + 2

		// Permissions which allow any action, but scoped actions (get, update, delete) only on `keeperName` and NO OTHER Keeper.
		scopedLimitedPermissions := map[string]ResourcePermission{
			ResourceKeepers: {
				Actions: ActionsAllKeepers,
				Name:    keeperName,
			},
		}

		// Create users (+ client) with permission to manage ONLY the Keeper `keeperName`.
		editorLimited := mustCreateUsersWithOrg(t, helper, orgID, scopedLimitedPermissions).Editor

		clientScopedLimited := helper.GetResourceClient(apis.ResourceClientArgs{
			User: editorLimited,
			GVR:  gvrKeepers,
		})

		// Create users (+ client) with permission to manage ANY Keepers.
		scopedAllPermissions := map[string]ResourcePermission{
			ResourceKeepers: {
				Actions: ActionsAllKeepers,
				Name:    "*", // this or not sending a `Name` have the same effect.
			},
		}

		editorAll := mustCreateUsersWithOrg(t, helper, orgID, scopedAllPermissions).Editor

		clientScopedAll := helper.GetResourceClient(apis.ResourceClientArgs{
			User: editorAll,
			GVR:  gvrKeepers,
		})

		// For create, we don't have actual granular permissions, so we can use any client that has unscoped create permissions.
		// This is because when we don't know yet what the name of the resource will be, the request comes with an empty value.
		// And thus the authorizer can't do granular checks.
		t.Run("CREATE", func(t *testing.T) {
			rawCreateLimited, err := clientScopedAll.Resource.Create(ctx, testKeeper, metav1.CreateOptions{})
			require.NoError(t, err)
			require.NotNil(t, rawCreateLimited)

			rawCreateLimited, err = clientScopedAll.Resource.Create(ctx, testKeeperAnother, metav1.CreateOptions{})
			require.NoError(t, err)
			require.NotNil(t, rawCreateLimited)
		})

		t.Run("READ", func(t *testing.T) {
			// Retrieve `keeperName` from the limited client.
			rawGetLimited, err := clientScopedLimited.Resource.Get(ctx, keeperName, metav1.GetOptions{})
			require.NoError(t, err)
			require.NotNil(t, rawGetLimited)
			require.Equal(t, rawGetLimited.GetUID(), rawGetLimited.GetUID())

			// Retrieve `keeperName` from the scope-all client.
			rawGetAll, err := clientScopedAll.Resource.Get(ctx, keeperName, metav1.GetOptions{})
			require.NoError(t, err)
			require.NotNil(t, rawGetAll)
			require.Equal(t, rawGetAll.GetUID(), rawGetLimited.GetUID())

			// Even though we can create it, we cannot retrieve `keeperNameAnother` from the limited client.
			rawGetLimited, err = clientScopedLimited.Resource.Get(ctx, keeperNameAnother, metav1.GetOptions{})
			require.Error(t, err)
			require.Nil(t, rawGetLimited)

			var statusGetErr *apierrors.StatusError
			require.True(t, errors.As(err, &statusGetErr))
			require.EqualValues(t, http.StatusForbidden, statusGetErr.Status().Code)

			// Retrieve `keeperNameAnother` from the scope-all client.
			rawGetAll, err = clientScopedAll.Resource.Get(ctx, keeperNameAnother, metav1.GetOptions{})
			require.NoError(t, err)
			require.NotNil(t, rawGetAll)
		})

		t.Run("LIST", func(t *testing.T) {
			// List Keepers from the limited client should return only 1.
			rawList, err := clientScopedLimited.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.NotNil(t, rawList)
			require.Len(t, rawList.Items, 1)
			require.Equal(t, keeperName, rawList.Items[0].GetName())

			// List Keepers from the scope-all client should return all of them.
			rawList, err = clientScopedAll.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.NotNil(t, rawList)
			require.Len(t, rawList.Items, 2)
		})

		t.Run("UPDATE", func(t *testing.T) {
			// Update `keeperName` from the limited client.
			testKeeperUpdate := testKeeper.DeepCopy()
			testKeeperUpdate.Object["spec"].(map[string]any)["description"] = "keeper-description-1234"

			rawUpdate, err := clientScopedLimited.Resource.Update(ctx, testKeeperUpdate, metav1.UpdateOptions{})
			require.NoError(t, err)
			require.NotNil(t, rawUpdate)

			// Try to update `keeperNameAnother` from the limited client.
			testKeeperAnotherUpdate := testKeeperAnother.DeepCopy()
			testKeeperAnotherUpdate.Object["spec"].(map[string]any)["description"] = "keeper-description-5678"

			rawUpdate, err = clientScopedLimited.Resource.Update(ctx, testKeeperAnotherUpdate, metav1.UpdateOptions{})
			require.Error(t, err)
			require.Nil(t, rawUpdate)

			var statusUpdateErr *apierrors.StatusError
			require.True(t, errors.As(err, &statusUpdateErr))
			require.EqualValues(t, http.StatusForbidden, statusUpdateErr.Status().Code)

			// Update `keeperNameAnother` from the scope-all client.
			rawUpdate, err = clientScopedAll.Resource.Update(ctx, testKeeperAnotherUpdate, metav1.UpdateOptions{})
			require.NoError(t, err)
			require.NotNil(t, rawUpdate)
		})

		// Keep this last for cleaning up the resources.
		t.Run("DELETE", func(t *testing.T) {
			// Try to delete `keeperNameAnother` from the limited client.
			err := clientScopedLimited.Resource.Delete(ctx, keeperNameAnother, metav1.DeleteOptions{})
			require.Error(t, err)

			var statusDeleteErr *apierrors.StatusError
			require.True(t, errors.As(err, &statusDeleteErr))
			require.EqualValues(t, http.StatusForbidden, statusDeleteErr.Status().Code)

			// Delete `keeperNameAnother` from the scope-all client.
			err = clientScopedAll.Resource.Delete(ctx, keeperNameAnother, metav1.DeleteOptions{})
			require.NoError(t, err)

			// Delete `keeperName` from the limited client.
			err = clientScopedLimited.Resource.Delete(ctx, keeperName, metav1.DeleteOptions{})
			require.NoError(t, err)
		})
	})
}
