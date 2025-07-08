package identity

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

var gvrTeams = schema.GroupVersionResource{
	Group:    "iam.grafana.app",
	Version:  "v0alpha1",
	Resource: "teams",
}

var gvrUsers = schema.GroupVersionResource{
	Group:    "iam.grafana.app",
	Version:  "v0alpha1",
	Resource: "users",
}

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationIdentity(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false, // required for experimental APIs
		DisableAnonymous:  true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, // Required to start the example service
		},
	})
	_, err := helper.NewDiscoveryClient().ServerResourcesForGroupVersion("iam.grafana.app/v0alpha1")
	require.NoError(t, err)

	t.Run("read only views", func(t *testing.T) {
		ctx := context.Background()
		teamClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvrTeams,
		})
		rsp, err := teamClient.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		found := teamClient.SanitizeJSONList(rsp, "name", "labels")
		require.JSONEq(t, `{
      "items": [
        {
          "apiVersion": "iam.grafana.app/v0alpha1",
          "kind": "Team",
          "metadata": {
            "creationTimestamp": "${creationTimestamp}",
            "name": "${name}",
            "namespace": "default",
            "resourceVersion": "${resourceVersion}"
          },
          "spec": {
            "email": "staff@Org1",
            "title": "staff"
          },
          "status": {}
        }
      ]
    }`, found)

		// Org1 users
		userClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvrUsers,
		})
		rsp, err = userClient.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)

		// Get just the specs (avoids values that change with each deployment)
		found = teamClient.SpecJSON(rsp)
		require.JSONEq(t, `[
			{
				"disabled": false,
				"email": "admin@localhost",
				"emailVerified": false,
				"grafanaAdmin": true,
				"login": "admin",
				"name": "",
				"provisioned": false
			},
			{
				"disabled": false,
				"email": "admin2-1",
				"emailVerified": false,
				"grafanaAdmin": true,
				"login": "admin2-1",
				"name": "",
				"provisioned": false
			},
			{
				"disabled": false,
				"email": "editor-1",
				"emailVerified": false,
				"grafanaAdmin": false,
				"login": "editor-1",
				"name": "",
				"provisioned": false
			},
			{
				"disabled": false,
				"email": "viewer-1",
				"emailVerified": false,
				"grafanaAdmin": false,
				"login": "viewer-1",
				"name": "",
				"provisioned": false
			}
		]`, found)

		// OrgB users
		userClient = helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,                                        // super admin
			Namespace: helper.Namespacer(helper.OrgB.Admin.Identity.GetOrgID()), // list values for orgB with super admin user
			GVR:       gvrUsers,
		})
		rsp, err = userClient.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)

		// Get just the specs (avoids values that change with each deployment)
		found = teamClient.SpecJSON(rsp)
		require.JSONEq(t, `[
			{
				"disabled": false,
				"email": "admin2-1",
				"emailVerified": false,
				"grafanaAdmin": true,
				"login": "admin2-1",
				"name": "",
				"provisioned": false
			},
			{
				"disabled": false,
				"email": "admin2-2",
				"emailVerified": false,
				"grafanaAdmin": false,
				"login": "admin2-2",
				"name": "",
				"provisioned": false
			},
			{
				"disabled": false,
				"email": "editor-2",
				"emailVerified": false,
				"grafanaAdmin": false,
				"login": "editor-2",
				"name": "",
				"provisioned": false
			},
			{
				"disabled": false,
				"email": "viewer-2",
				"emailVerified": false,
				"grafanaAdmin": false,
				"login": "viewer-2",
				"name": "",
				"provisioned": false
			}
		]`, found)
	})
}

func TestIntegrationUsers(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	t.Run("User CRUD operations with dual writer mode 0", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    false,
			DisableAnonymous:     true,
			APIServerStorageType: "unified",
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"users.iam.grafana.app": {
					DualWriterMode: grafanarest.Mode0,
				},
			},
			EnableFeatureToggles: []string{
				featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
			},
		})
		doUserCRUDTests(t, helper)
	})

	t.Run("User CRUD operations with dual writer mode 1", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    false,
			DisableAnonymous:     true,
			APIServerStorageType: "unified",
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"users.iam.grafana.app": {
					DualWriterMode: grafanarest.Mode1,
				},
			},
			EnableFeatureToggles: []string{
				featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
			},
		})
		doUserCRUDTests(t, helper)
	})
}

func doUserCRUDTests(t *testing.T, helper *apis.K8sTestHelper) {
	t.Run("should create user through the new APIs", func(t *testing.T) {
		ctx := context.Background()
		userClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvrUsers,
		})

		// Create the user
		created, err := userClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("testdata/user-test-create-v0.yaml"), metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)

		// Verify creation response
		createdSpec := created.Object["spec"].(map[string]interface{})
		require.Equal(t, "testuser1@example123.com", createdSpec["email"])
		require.Equal(t, "testuser1", createdSpec["login"])
		require.Equal(t, "Test User 1", createdSpec["name"])
		require.Equal(t, false, createdSpec["provisioned"])

		// Get the UID from created user for fetching
		createdUID := created.GetName()
		require.NotEmpty(t, createdUID)

		fetched, err := userClient.Resource.Get(ctx, createdUID, metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, fetched)

		// Verify fetched user matches created user
		fetchedSpec := fetched.Object["spec"].(map[string]interface{})
		require.Equal(t, "testuser1@example123.com", fetchedSpec["email"])
		require.Equal(t, "testuser1", fetchedSpec["login"])
		require.Equal(t, "Test User 1", fetchedSpec["name"])
		require.Equal(t, false, fetchedSpec["provisioned"])

		// Verify metadata
		require.Equal(t, createdUID, fetched.GetName())
		require.Equal(t, "default", fetched.GetNamespace())

		err = userClient.Resource.Delete(ctx, createdUID, metav1.DeleteOptions{})
		require.NoError(t, err)
	})

	t.Run("should create user using legacy APIs", func(t *testing.T) {
		ctx := context.Background()
		userClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvrUsers,
		})

		legacyUserPayload := `{
			"name": "Test User 2",
			"email": "testuser2@example.com",
			"login": "testuser2",
			"password": "password123"
		}`

		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "POST",
			Path:   "/api/admin/users",
			Body:   []byte(legacyUserPayload),
		}, &user.User{})

		require.NotNil(t, rsp)
		require.Equal(t, 200, rsp.Response.StatusCode)
		require.NotEmpty(t, rsp.Result.UID)

		// Now try to fetch the user via the new API
		user, err := userClient.Resource.Get(context.Background(), rsp.Result.UID, metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, user)

		// Verify fetched user matches created user
		userSpec := user.Object["spec"].(map[string]interface{})
		require.Equal(t, "testuser2@example.com", userSpec["email"])
		require.Equal(t, "testuser2", userSpec["login"])
		require.Equal(t, "Test User 2", userSpec["name"])
		require.Equal(t, false, userSpec["provisioned"])

		// Verify metadata
		require.Equal(t, rsp.Result.UID, user.GetName())
		require.Equal(t, "default", user.GetNamespace())

		err = userClient.Resource.Delete(ctx, rsp.Result.UID, metav1.DeleteOptions{})
		require.NoError(t, err)
	})
}
