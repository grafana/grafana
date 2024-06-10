package playlist

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationExampleApp(t *testing.T) {
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

	t.Run("Check runtime info resource", func(t *testing.T) {
		// Resource is not namespaced!
		client := helper.Org1.Admin.ResourceClient(t, schema.GroupVersionResource{
			Group:    "example.grafana.app",
			Version:  "v0alpha1",
			Resource: "runtime",
		})
		rsp, err := client.List(context.Background(), metav1.ListOptions{})
		require.NoError(t, err)

		v, ok := rsp.Object["startupTime"].(int64)
		require.True(t, ok)
		require.Greater(t, v, time.Now().Add(-1*time.Hour).UnixMilli()) // should be within the last hour
	})

	t.Run("Check discovery client", func(t *testing.T) {
		disco := helper.NewDiscoveryClient()
		resources, err := disco.ServerResourcesForGroupVersion("example.grafana.app/v0alpha1")
		require.NoError(t, err)

		v1Disco, err := json.MarshalIndent(resources, "", "  ")
		require.NoError(t, err)
		//fmt.Printf("%s", string(v1Disco))

		require.JSONEq(t, `{
			"kind": "APIResourceList",
			"apiVersion": "v1",
			"groupVersion": "example.grafana.app/v0alpha1",
			"resources": [
			  {
				"name": "dummy",
				"singularName": "dummy",
				"namespaced": true,
				"kind": "DummyResource",
				"verbs": [
				  "get",
				  "list"
				]
			  },
			  {
				"name": "dummy/sub",
				"singularName": "",
				"namespaced": true,
				"kind": "DummySubresource",
				"verbs": [
				  "get"
				]
			  },
			  {
				"name": "runtime",
				"singularName": "runtime",
				"namespaced": false,
				"kind": "RuntimeInfo",
				"verbs": [
				  "list"
				]
			  }
			]
		  }`, string(v1Disco))

		//fmt.Printf("%s", string(v1Disco))
		require.JSONEq(t, `[
			{
			  "version": "v0alpha1",
			  "freshness": "Current",
			  "resources": [
				{
				  "resource": "dummy",
				  "responseKind": {
					"group": "",
					"kind": "DummyResource",
					"version": ""
				  },
				  "scope": "Namespaced",
				  "singularResource": "dummy",
				  "subresources": [
					{
					  "responseKind": {
						"group": "",
						"kind": "DummySubresource",
						"version": ""
					  },
					  "subresource": "sub",
					  "verbs": [
						"get"
					  ]
					}
				  ],
				  "verbs": [
					"get",
					"list"
				  ]
				},
				{
				  "resource": "runtime",
				  "responseKind": {
					"group": "",
					"kind": "RuntimeInfo",
					"version": ""
				  },
				  "scope": "Cluster",
				  "singularResource": "runtime",
				  "verbs": [
					"list"
				  ]
				}
			  ]
			}
		  ]`, helper.GetGroupVersionInfoJSON("example.grafana.app"))
	})

	t.Run("Check dummy with subresource", func(t *testing.T) {
		client := helper.Org1.Viewer.ResourceClient(t, schema.GroupVersionResource{
			Group:    "example.grafana.app",
			Version:  "v0alpha1",
			Resource: "dummy",
		}).Namespace("default")
		rsp, err := client.Get(context.Background(), "test2", metav1.GetOptions{})
		require.NoError(t, err)

		v, ok, err := unstructured.NestedString(rsp.Object, "spec", "Dummy")
		require.NoError(t, err)
		require.True(t, ok)

		require.Equal(t, "test2", v)
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
