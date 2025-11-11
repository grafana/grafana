package dashboards

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	k8srest "k8s.io/client-go/rest"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashboardV2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashboardV2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func runDashboardTest(t *testing.T, mode rest.DualWriterMode, gvr schema.GroupVersionResource) {
	t.Run("simple crud+list", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {
					DualWriterMode: mode,
				},
			},
		})
		t.Cleanup(helper.Shutdown)

		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvr,
		})
		rsp, err := client.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Empty(t, rsp.Items)

		obj := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"spec": map[string]any{
					"title":         "Test empty dashboard",
					"schemaVersion": 42,
				},
			},
		}
		obj.SetGenerateName("aa")
		obj.SetAPIVersion(gvr.GroupVersion().String())
		obj.SetKind("Dashboard")
		obj, err = client.Resource.Create(ctx, obj, metav1.CreateOptions{})
		require.NoError(t, err)
		created := obj.GetName()
		require.True(t, strings.HasPrefix(created, "aa"), "expecting prefix %s (%s)", "aa", created) // the generate name prefix

		// The new value exists in a list
		rsp, err = client.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, rsp.Items, 1)
		require.Equal(t, created, rsp.Items[0].GetName())

		// Same value returned from get
		obj, err = client.Resource.Get(ctx, created, metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, created, obj.GetName())
		require.Equal(t, int64(1), obj.GetGeneration())
		require.Equal(t, "Test empty dashboard", obj.Object["spec"].(map[string]any)["title"])

		wrap, err := utils.MetaAccessor(obj)
		require.NoError(t, err)

		m, _ := wrap.GetManagerProperties()
		require.Empty(t, m.Identity) // no SQL repo stub
		require.Equal(t, helper.Org1.Admin.Identity.GetUID(), wrap.GetCreatedBy())

		// Commented out because the dynamic client does not like lists as sub-resource
		// // Check that it now appears in the history
		// sub, err := client.Resource.Get(ctx, created, metav1.GetOptions{}, "history")
		// require.NoError(t, err)
		// history, err := sub.ToList()
		// require.NoError(t, err)
		// require.Len(t, history.Items, 1)
		// require.Equal(t, created, history.Items[0].GetName())

		obj.Object["spec"].(map[string]any)["title"] = "Changed title"

		updated, err := client.Resource.Update(context.Background(),
			obj,
			metav1.UpdateOptions{},
		)
		require.NoError(t, err)
		require.Equal(t, obj.GetName(), updated.GetName())
		require.Equal(t, obj.GetUID(), updated.GetUID())
		require.Less(t, obj.GetResourceVersion(), updated.GetResourceVersion())
		require.Equal(t, "Changed title", updated.Object["spec"].(map[string]any)["title"])

		// Delete the object, skipping the provisioned dashboard check
		zeroInt64 := int64(0)
		err = client.Resource.Delete(ctx, created, metav1.DeleteOptions{
			GracePeriodSeconds: &zeroInt64,
		})
		require.NoError(t, err)

		// Now it is not in the list
		rsp, err = client.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Empty(t, rsp.Items)
	})
}

func TestIntegrationDashboardsAppV0Alpha1(t *testing.T) {
	gvr := schema.GroupVersionResource{
		Group:    dashboardV0.GROUP,
		Version:  dashboardV0.VERSION,
		Resource: "dashboards",
	}
	testutil.SkipIntegrationTestInShortMode(t)

	modes := []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2, rest.Mode3, rest.Mode4, rest.Mode5}
	for _, mode := range modes {
		t.Run(fmt.Sprintf("v0alpha1 with dual writer mode %d", mode), func(t *testing.T) {
			runDashboardTest(t, mode, gvr)
		})
	}
}

func TestIntegrationDashboardsAppV1(t *testing.T) {
	gvr := schema.GroupVersionResource{
		Group:    dashboardV1.GROUP,
		Version:  dashboardV1.VERSION,
		Resource: "dashboards",
	}
	testutil.SkipIntegrationTestInShortMode(t)

	modes := []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2, rest.Mode3, rest.Mode4, rest.Mode5}
	for _, mode := range modes {
		t.Run(fmt.Sprintf("v1beta1 with dual writer mode %d", mode), func(t *testing.T) {
			runDashboardTest(t, mode, gvr)
		})
	}
}

func TestIntegrationDashboardsAppV2alpha1(t *testing.T) {
	gvr := schema.GroupVersionResource{
		Group:    dashboardV2alpha1.GROUP,
		Version:  dashboardV2alpha1.VERSION,
		Resource: "dashboards",
	}
	testutil.SkipIntegrationTestInShortMode(t)

	modes := []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2, rest.Mode3, rest.Mode4, rest.Mode5}
	for _, mode := range modes {
		t.Run(fmt.Sprintf("v2alpha1 with dual writer mode %d", mode), func(t *testing.T) {
			runDashboardTest(t, mode, gvr)
		})
	}
}

func TestIntegrationDashboardsAppV2beta1(t *testing.T) {
	gvr := schema.GroupVersionResource{
		Group:    dashboardV2beta1.GROUP,
		Version:  dashboardV2beta1.VERSION,
		Resource: "dashboards",
	}
	testutil.SkipIntegrationTestInShortMode(t)

	modes := []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2, rest.Mode3, rest.Mode4, rest.Mode5}
	for _, mode := range modes {
		t.Run(fmt.Sprintf("v1alpha2 with dual writer mode %d", mode), func(t *testing.T) {
			runDashboardTest(t, mode, gvr)
		})
	}
}

func TestIntegrationLegacySupport(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{})

	clientV0 := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  dashboardV0.DashboardResourceInfo.GroupVersionResource(),
	})
	obj, err := clientV0.Resource.Create(ctx,
		helper.LoadYAMLOrJSONFile("testdata/dashboard-test-v0.yaml"),
		metav1.CreateOptions{},
	)
	require.NoError(t, err)
	require.Equal(t, "test-v0", obj.GetName())

	clientV1 := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  dashboardV1.DashboardResourceInfo.GroupVersionResource(),
	})
	obj, err = clientV1.Resource.Create(ctx,
		helper.LoadYAMLOrJSONFile("testdata/dashboard-test-v1.yaml"),
		metav1.CreateOptions{},
	)
	require.NoError(t, err)
	require.Equal(t, "test-v1", obj.GetName())

	clientV2 := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  dashboardV2alpha1.DashboardResourceInfo.GroupVersionResource(),
	})
	obj, err = clientV2.Resource.Create(ctx,
		helper.LoadYAMLOrJSONFile("testdata/dashboard-test-v2.yaml"),
		metav1.CreateOptions{},
	)
	require.NoError(t, err)
	require.Equal(t, "test-v2", obj.GetName())

	//---------------------------------------------------------
	// Now check that we can get each dashboard with any API
	//---------------------------------------------------------
	names := []string{"test-v0", "test-v1", "test-v2"}
	clients := []dynamic.ResourceInterface{
		clientV0.Resource,
		clientV1.Resource,
		clientV2.Resource,
	}
	for _, name := range names {
		for _, client := range clients {
			obj, err := client.Get(ctx, name, metav1.GetOptions{})
			require.NoError(t, err)
			require.Equal(t, name, obj.GetName())

			// Can get the same thing with the /dto endpoint
			obj, err = client.Get(ctx, name, metav1.GetOptions{}, "dto")
			require.NoError(t, err)
			require.Equal(t, name, obj.GetName())

			if obj.Object["spec"] == nil {
				continue // missing conversions
			}

			// This should have been moved to metadata
			spec, _, err := unstructured.NestedMap(obj.Object, "spec")
			require.NoError(t, err)

			require.Nil(t, spec["id"])
			require.Nil(t, spec["uid"])
			require.Nil(t, spec["version"])

			access, _, err := unstructured.NestedMap(obj.Object, "access")
			require.NoError(t, err)
			require.Equal(t, slugify.Slugify(spec["title"].(string)), access["slug"])
		}
	}

	//---------------------------------------------------------
	// Check that the legacy APIs return the correct apiVersion
	//---------------------------------------------------------

	rsp := apis.DoRequest(helper, apis.RequestParams{
		User: helper.Org1.Admin,
		Path: "/api/dashboards/uid/test-v0",
	}, &dtos.DashboardFullWithMeta{})
	require.Equal(t, 200, rsp.Response.StatusCode)
	require.Equal(t, dashboardV0.VERSION, rsp.Result.Meta.APIVersion)

	rsp = apis.DoRequest(helper, apis.RequestParams{
		User: helper.Org1.Admin,
		Path: "/api/dashboards/uid/test-v1",
	}, &dtos.DashboardFullWithMeta{})
	require.Equal(t, 200, rsp.Response.StatusCode)
	require.Equal(t, dashboardV0.VERSION, rsp.Result.Meta.APIVersion)

	// V2 should send a not acceptable
	rsp = apis.DoRequest(helper, apis.RequestParams{
		User: helper.Org1.Admin,
		Path: "/api/dashboards/uid/test-v2",
	}, &dtos.DashboardFullWithMeta{})
	require.Equal(t, 406, rsp.Response.StatusCode) // not acceptable
}

func TestIntegrationSearchTypeFiltering(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	modes := []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2, rest.Mode3, rest.Mode4, rest.Mode5}
	for _, mode := range modes {
		runDashboardSearchTest(t, mode)
	}
}

func runDashboardSearchTest(t *testing.T, mode rest.DualWriterMode) {
	t.Run(fmt.Sprintf("search types with dual writer mode %d", mode), func(t *testing.T) {
		ctx := context.Background()

		flags := []string{}
		if mode >= rest.Mode3 {
			flags = append(flags, featuremgmt.FlagUnifiedStorageSearch)
		}

		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true,
			DisableAnonymous:     true,
			APIServerStorageType: "unified",
			EnableFeatureToggles: flags,
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {DualWriterMode: mode},
				"folders.folder.grafana.app":       {DualWriterMode: mode},
			},
		})
		defer helper.Shutdown()

		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  dashboardV0.DashboardResourceInfo.GroupVersionResource(),
		})

		// Create one folder via legacy API
		{
			cfg := dynamic.ConfigFor(helper.Org1.Admin.NewRestConfig())
			cfg.GroupVersion = &schema.GroupVersion{Group: "folder.grafana.app", Version: "v1beta1"}
			restClient, err := k8srest.RESTClientFor(cfg)
			require.NoError(t, err)

			var statusCode int
			body := []byte(`{"uid":"sfolder","title":"Sample Folder"}`)
			result := restClient.Post().AbsPath("api", "folders").
				Body(body).
				SetHeader("Content-type", "application/json").
				Do(ctx).
				StatusCode(&statusCode)
			require.NoError(t, result.Error())
			require.Equal(t, int(http.StatusOK), statusCode)
		}

		// Create one dashboard in root
		{
			obj := &unstructured.Unstructured{
				Object: map[string]any{
					"spec": map[string]any{
						"title":         "X",
						"schemaVersion": 1,
					},
				},
			}
			obj.SetGenerateName("x-")
			obj.SetAPIVersion(dashboardV0.GroupVersion.String())
			obj.SetKind("Dashboard")
			_, err := client.Resource.Create(ctx, obj, metav1.CreateOptions{})
			require.NoError(t, err)
		}

		// Also create a dashboard via legacy API to ensure legacy search sees it in modes < 3
		{
			cfg := dynamic.ConfigFor(helper.Org1.Admin.NewRestConfig())
			cfg.GroupVersion = &schema.GroupVersion{Group: "dashboard.grafana.app", Version: "v0alpha1"}
			restClient, err := k8srest.RESTClientFor(cfg)
			require.NoError(t, err)
			var statusCode int
			body := []byte(`{"dashboard":{"title":"Legacy X"},"overwrite":true}`)
			result := restClient.Post().AbsPath("api", "dashboards", "db").
				Body(body).
				SetHeader("Content-type", "application/json").
				Do(ctx).
				StatusCode(&statusCode)
			require.NoError(t, result.Error())
			require.Equal(t, int(http.StatusOK), statusCode)
		}

		ns := helper.Org1.Admin.Identity.GetNamespace()
		cfg := dynamic.ConfigFor(helper.Org1.Admin.NewRestConfig())
		cfg.GroupVersion = &schema.GroupVersion{Group: "dashboard.grafana.app", Version: "v0alpha1"}
		restClient, err := k8srest.RESTClientFor(cfg)
		require.NoError(t, err)

		call := func(params string) dashboardV0.SearchResults {
			var statusCode int
			req := restClient.Get().AbsPath("apis", "dashboard.grafana.app", "v0alpha1", "namespaces", ns, "search").
				Param("limit", "1000")
			for _, kv := range strings.Split(params, "&") {
				if kv == "" {
					continue
				}
				parts := strings.SplitN(kv, "=", 2)
				if len(parts) == 2 {
					req = req.Param(parts[0], parts[1])
				}
			}
			res := req.Do(ctx).StatusCode(&statusCode)
			require.NoError(t, res.Error())
			require.Equal(t, int(http.StatusOK), statusCode)
			var sr dashboardV0.SearchResults
			raw, err := res.Raw()
			require.NoError(t, err)
			require.NoError(t, json.Unmarshal(raw, &sr))
			return sr
		}

		// No type => defaults to both
		resAny := call("")
		folders := 0
		dashboards := 0
		for _, h := range resAny.Hits {
			if strings.HasPrefix(h.Resource, "folder") {
				folders++
			}
			if strings.HasPrefix(h.Resource, "dash") {
				dashboards++
			}
		}
		require.GreaterOrEqual(t, dashboards, 1)
		require.GreaterOrEqual(t, folders, 1)

		// Only folder
		resFolder := call("type=folder")
		for _, h := range resFolder.Hits {
			require.True(t, strings.HasPrefix(h.Resource, "folder"))
		}

		// Only dashboard
		resDash := call("type=dashboard")
		require.GreaterOrEqual(t, len(resDash.Hits), 1)
		for _, h := range resDash.Hits {
			require.True(t, strings.HasPrefix(h.Resource, "dash"))
		}

		// Both via repetition
		resBoth := call("type=folder&type=dashboard")
		folders, dashboards = 0, 0
		for _, h := range resBoth.Hits {
			if strings.HasPrefix(h.Resource, "folder") {
				folders++
			}
			if strings.HasPrefix(h.Resource, "dash") {
				dashboards++
			}
		}
		require.GreaterOrEqual(t, dashboards, 1)
		require.GreaterOrEqual(t, folders, 1)

		// Invalid => defaults to both
		resInvalid := call("type=invalid")
		folders, dashboards = 0, 0
		for _, h := range resInvalid.Hits {
			if strings.HasPrefix(h.Resource, "folder") {
				folders++
			}
			if strings.HasPrefix(h.Resource, "dash") {
				dashboards++
			}
		}
		require.GreaterOrEqual(t, dashboards, 1)
		require.GreaterOrEqual(t, folders, 1)
	})
}
