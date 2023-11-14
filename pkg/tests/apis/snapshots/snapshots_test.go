package playlist

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestSnapshotsApp(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: true, // do not start extra port 6443
		DisableAnonymous:  true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServer,
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, // Required to start the example service
		},
	})

	t.Run("Check discovery client", func(t *testing.T) {
		disco := helper.GetGroupVersionInfoJSON("snapshots.grafana.app")

		fmt.Printf("%s", disco)
		require.JSONEq(t, `[
			{
			  "version": "v0alpha1",
			  "freshness": "Current",
			  "resources": [
				{
				  "resource": "dashboards",
				  "responseKind": {
					"group": "",
					"kind": "DashboardSnapshot",
					"version": ""
				  },
				  "scope": "Namespaced",
				  "singularResource": "dashboard",
				  "subresources": [
					{
					  "responseKind": {
						"group": "",
						"kind": "Status",
						"version": ""
					  },
					  "subresource": "delete",
					  "verbs": [
						"delete"
					  ]
					}
				  ],
				  "verbs": [
					"create",
					"delete",
					"get",
					"list"
				  ]
				},
				{
				  "resource": "options",
				  "responseKind": {
					"group": "",
					"kind": "SnapshotSharingConfig",
					"version": ""
				  },
				  "scope": "Cluster",
				  "singularResource": "options",
				  "verbs": [
					"get",
					"list"
				  ]
				}
			  ]
			}
		  ]`, disco)
	})

	t.Run("Check dummy with subresource", func(t *testing.T) {
		client := helper.Org1.Viewer.Client.Resource(schema.GroupVersionResource{
			Group:    "example.grafana.app",
			Version:  "v0alpha1",
			Resource: "dummy",
		}).Namespace("default")
		rsp, err := client.Get(context.Background(), "test2", metav1.GetOptions{})
		require.NoError(t, err)

		require.Equal(t, "dummy: test2", rsp.Object["spec"])
		require.Equal(t, "DummyResource", rsp.GetObjectKind().GroupVersionKind().Kind)

		// Now a sub-resource
		rsp, err = client.Get(context.Background(), "test2", metav1.GetOptions{}, "sub")
		require.NoError(t, err)

		raw, err := json.MarshalIndent(rsp, "", "  ")
		require.NoError(t, err)
		//fmt.Printf("%s", string(raw))
		require.JSONEq(t, `{
			"apiVersion": "example.grafana.app/v0alpha1",
			"kind": "DummySubresource",
			"info": "default/viewer-1"
		  }`, string(raw))
	})
}
