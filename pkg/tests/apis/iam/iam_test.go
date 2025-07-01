package identity

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
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
				"email": "admin2-1",
				"login": "admin2-1"
			},
			{
				"email": "admin2-2",
				"login": "admin2-2"
			},
			{
				"email": "editor-2",
				"login": "editor-2"
			},
			{
				"email": "viewer-2",
				"login": "viewer-2"
			}
		]`, found)
	})
}
