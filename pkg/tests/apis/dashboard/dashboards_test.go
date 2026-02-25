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
	dashboardV2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/slugify"
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
			DisableAnonymous:      true,
			DisableDataMigrations: true,
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

	modes := []rest.DualWriterMode{rest.Mode0, rest.Mode2, rest.Mode3, rest.Mode4, rest.Mode5}
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

	modes := []rest.DualWriterMode{rest.Mode0, rest.Mode2, rest.Mode3, rest.Mode4, rest.Mode5}
	for _, mode := range modes {
		t.Run(fmt.Sprintf("v1beta1 with dual writer mode %d", mode), func(t *testing.T) {
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

	modes := []rest.DualWriterMode{rest.Mode0, rest.Mode2, rest.Mode3, rest.Mode4, rest.Mode5}
	for _, mode := range modes {
		t.Run(fmt.Sprintf("v1alpha2 with dual writer mode %d", mode), func(t *testing.T) {
			runDashboardTest(t, mode, gvr)
		})
	}
}

func TestIntegrationLegacySupport(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableDataMigrations: true,
	})

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
		GVR:  dashboardV2beta1.DashboardResourceInfo.GroupVersionResource(),
	})
	obj, err = clientV2.Resource.Create(ctx,
		helper.LoadYAMLOrJSONFile("testdata/dashboard-test-v2.yaml"),
		metav1.CreateOptions{},
	)
	require.NoError(t, err)
	require.Equal(t, "test-v2", obj.GetName())

	t.Run("validate legacy apis", func(t *testing.T) {
		cfg := dynamic.ConfigFor(helper.Org1.Admin.NewRestConfig())
		cfg.GroupVersion = &dashboardV0.GroupVersion
		adminClient, err := k8srest.RESTClientFor(cfg)
		require.NoError(t, err)

		testCases := []struct {
			name   string
			input  map[string]any
			expect string
			inK8s  bool
		}{{
			name: "with apiVersion",
			input: map[string]any{
				"apiVersion": "v2",
			},
			expect: "Dashboard appears to be a full k8s style resource",
		}, {
			name: "with metadata",
			input: map[string]any{
				"metadata": map[string]any{},
			},
			expect: "Dashboard appears to be a full k8s style resource",
		}, {
			name: "with spec",
			input: map[string]any{
				"spec": map[string]any{},
			},
			expect: "Dashboard appears to be a full k8s style resource",
		}, {
			name: "with elements",
			input: map[string]any{
				"elements": []any{},
				"title":    "V2 dashboard",
			},
			expect: "dashboard appears to be in v2 format",
			inK8s:  true,
		}, {
			name: "with layout",
			input: map[string]any{
				"layout": "???",
				"title":  "V2 dashboard",
			},
			expect: "dashboard appears to be in v2 format",
			inK8s:  true,
		}, {
			name: "missing title",
			input: map[string]any{
				"panels": []any{}, // this used to be a panic
			},
			expect: "Dashboard is missing required title property",
		}}
		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				dash, err := json.Marshal(tc.input)
				require.NoError(t, err)

				var statusCode int
				result := adminClient.Post().AbsPath("api", "dashboards", "db").
					Body([]byte(`{"dashboard": `+string(dash)+`}`)).
					SetHeader("Content-type", "application/json").
					Do(ctx).
					StatusCode(&statusCode)
				body, _ := result.Raw()
				require.Equal(t, int(http.StatusBadRequest), statusCode)
				require.Contains(t, string(body), tc.expect)

				if tc.inK8s {
					t.Run("inK8s", func(t *testing.T) {
						obj := &unstructured.Unstructured{
							Object: map[string]any{
								"metadata": map[string]any{
									"generateName": "xxx",
								},
								"spec": tc.input,
							},
						}
						_, err := clientV0.Resource.Create(ctx, obj, metav1.CreateOptions{})
						require.ErrorContains(t, err, tc.expect)
					})
				}
			})
		}
	})

	t.Run("validate k8s payload in legacy API", func(t *testing.T) {
		cfg := dynamic.ConfigFor(helper.Org1.Admin.NewRestConfig())
		cfg.GroupVersion = &dashboardV0.GroupVersion
		adminClient, err := k8srest.RESTClientFor(cfg)
		require.NoError(t, err)

		names := []string{"test-v0", "test-v1", "test-v2"}
		clients := []dynamic.ResourceInterface{
			clientV0.Resource,
			clientV1.Resource,
			clientV2.Resource,
		}
		for idx, name := range names {
			t.Run(name, func(t *testing.T) {
				client := clients[idx]
				obj := helper.LoadYAMLOrJSONFile(fmt.Sprintf("testdata/dashboard-%s.yaml", name))
				obj.SetName(name + "-legacy")
				title := "create:" + name
				err = unstructured.SetNestedField(obj.Object, title, "spec", "title") // update the title
				require.NoError(t, err)
				jj, err := obj.MarshalJSON()
				require.NoError(t, err)

				// Create it
				var statusCode int
				body := []byte(`{"dashboard": ` + string(jj) + `, "overwrite": true}`)
				result := adminClient.Post().AbsPath("api", "dashboards", "db").
					Body(body).
					SetHeader("Content-type", "application/json").
					Do(ctx).
					StatusCode(&statusCode)
				require.NoError(t, result.Error())
				require.Equal(t, int(http.StatusOK), statusCode)

				found, err := client.Get(ctx, obj.GetName(), metav1.GetOptions{})
				require.NoError(t, err)
				foundTitle, _, _ := unstructured.NestedString(found.Object, "spec", "title")
				require.Equal(t, title, foundTitle, "in object: %s", obj.GetName())

				// Update the title -- try to save without overwrite=false
				title = "update:" + name
				err = unstructured.SetNestedField(obj.Object, title, "spec", "title") // update the title
				require.NoError(t, err)
				jj, err = obj.MarshalJSON()
				require.NoError(t, err)

				body = []byte(`{"dashboard": ` + string(jj) + `, "overwrite": false}`)
				_ = adminClient.Post().AbsPath("api", "dashboards", "db").
					Body(body).
					SetHeader("Content-type", "application/json").
					Do(ctx).
					StatusCode(&statusCode)
				require.Equal(t, int(http.StatusConflict), statusCode) // already exists

				// Overwrite!
				body = []byte(`{"dashboard": ` + string(jj) + `, "overwrite": true}`)
				_ = adminClient.Post().AbsPath("api", "dashboards", "db").
					Body(body).
					SetHeader("Content-type", "application/json").
					Do(ctx).
					StatusCode(&statusCode)
				require.Equal(t, int(http.StatusOK), statusCode) // already exists

				found, err = client.Get(ctx, obj.GetName(), metav1.GetOptions{})
				require.NoError(t, err)
				foundTitle, _, _ = unstructured.NestedString(found.Object, "spec", "title")
				require.Equal(t, title, foundTitle, "in object: %s", obj.GetName())

				// legacy GET should also work
				result = adminClient.Get().AbsPath("api", "dashboards", "uid", obj.GetName()).
					Do(ctx).
					StatusCode(&statusCode)
				require.Equal(t, int(http.StatusOK), statusCode)
				jj, _ = result.Raw()
				dto := &dtos.DashboardFullWithMeta{}
				err = json.Unmarshal(jj, dto)
				require.NoError(t, err)
				require.Equal(t, title, dto.Dashboard.Get("title").MustString(""), "in object: %s", obj.GetName())
			})
		}
	})

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

	rsp = apis.DoRequest(helper, apis.RequestParams{
		User: helper.Org1.Admin,
		Path: "/api/dashboards/uid/test-v2",
	}, &dtos.DashboardFullWithMeta{})
	require.Equal(t, 200, rsp.Response.StatusCode)
	require.Equal(t, dashboardV0.VERSION, rsp.Result.Meta.APIVersion)
}

func TestIntegrationListPagination(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	gvr := schema.GroupVersionResource{
		Group:    dashboardV0.GROUP,
		Version:  dashboardV0.VERSION,
		Resource: "dashboards",
	}

	// Test on modes with legacy
	modes := []rest.DualWriterMode{rest.Mode1, rest.Mode2, rest.Mode3}
	for _, mode := range modes {
		t.Run(fmt.Sprintf("pagination with dual writer mode %d", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				DisableAnonymous:      true,
				DisableDataMigrations: true,
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

			// Test 1: List with no dashboards
			rsp, err := client.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.Len(t, rsp.Items, 0)

			// Create 5 dashboards to test pagination with small limits
			const totalDashboards = 5
			createdNames := make([]string, 0, totalDashboards)
			for i := range totalDashboards {
				obj := &unstructured.Unstructured{
					Object: map[string]interface{}{
						"spec": map[string]any{
							"title":         fmt.Sprintf("Pagination test dashboard %d", i),
							"schemaVersion": 42,
						},
					},
				}
				obj.SetGenerateName("pag-")
				obj.SetAPIVersion(gvr.GroupVersion().String())
				obj.SetKind("Dashboard")
				created, err := client.Resource.Create(ctx, obj, metav1.CreateOptions{})
				require.NoError(t, err)
				createdNames = append(createdNames, created.GetName())
			}

			// Test 2: List all without limit - should return all dashboards
			rsp, err = client.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.Len(t, rsp.Items, totalDashboards, "should return all %d dashboards", totalDashboards)

			// Test 3: List with small limit (2) - should paginate
			const pageSize = 2
			allNames := make(map[string]bool)
			continueToken := ""
			pageCount := 0

			for {
				pageCount++
				listOpts := metav1.ListOptions{
					Limit:    pageSize,
					Continue: continueToken,
				}
				rsp, err = client.Resource.List(ctx, listOpts)
				require.NoError(t, err)

				// Collect names from this page
				for _, item := range rsp.Items {
					name := item.GetName()
					require.False(t, allNames[name], "duplicate item %s found across pages", name)
					allNames[name] = true
				}

				// Check if there's more pages
				continueToken = rsp.GetContinue()
				if continueToken == "" {
					break
				}

				// Safety check to prevent infinite loops
				require.Less(t, pageCount, 5)
			}

			// Verify we got all dashboards across all pages
			require.Len(t, allNames, totalDashboards, "should have collected all %d dashboards across pages", totalDashboards)

			// Verify all created dashboards were found
			for _, name := range createdNames {
				require.True(t, allNames[name], "dashboard %s not found in paginated results", name)
			}
		})

		t.Run(fmt.Sprintf("history pagination with dual writer mode %d", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				DisableAnonymous:      true,
				DisableDataMigrations: true,
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

			// Create a dashboard
			obj := &unstructured.Unstructured{
				Object: map[string]interface{}{
					"spec": map[string]any{
						"title":         "History pagination test dashboard",
						"schemaVersion": 42,
					},
				},
			}
			obj.SetGenerateName("hist-")
			obj.SetAPIVersion(gvr.GroupVersion().String())
			obj.SetKind("Dashboard")
			created, err := client.Resource.Create(ctx, obj, metav1.CreateOptions{})
			require.NoError(t, err)
			dashName := created.GetName()

			// Update the dashboard multiple times to create history entries
			const totalVersions = 5
			for i := 1; i < totalVersions; i++ {
				// Get latest version
				current, err := client.Resource.Get(ctx, dashName, metav1.GetOptions{})
				require.NoError(t, err)

				// Update title
				spec := current.Object["spec"].(map[string]interface{})
				spec["title"] = fmt.Sprintf("History pagination test dashboard v%d", i+1)
				current.Object["spec"] = spec

				_, err = client.Resource.Update(ctx, current, metav1.UpdateOptions{})
				require.NoError(t, err)
			}

			// Test: List history with pagination
			labelSelector := utils.LabelKeyGetHistory + "=true"
			fieldSelector := "metadata.name=" + dashName

			const pageSize int64 = 2
			allVersions := make([]string, 0)
			continueToken := ""
			pageCount := 0

			for {
				pageCount++
				listOpts := metav1.ListOptions{
					LabelSelector: labelSelector,
					FieldSelector: fieldSelector,
					Limit:         pageSize,
					Continue:      continueToken,
				}
				rsp, err := client.Resource.List(ctx, listOpts)
				require.NoError(t, err)

				// Collect resource versions from this page
				for _, item := range rsp.Items {
					rv := item.GetResourceVersion()
					allVersions = append(allVersions, rv)
				}

				// Check if there's more pages
				continueToken = rsp.GetContinue()
				if continueToken == "" {
					break
				}

				// Safety check to prevent infinite loops
				require.Less(t, pageCount, 5)
			}

			// Verify we got all history versions
			require.Len(t, allVersions, totalVersions, "should have collected all %d history versions across pages", totalVersions)
		})
	}
}

func TestIntegrationSearchTypeFiltering(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	modes := []rest.DualWriterMode{rest.Mode0, rest.Mode2, rest.Mode3, rest.Mode4, rest.Mode5}
	for _, mode := range modes {
		runDashboardSearchTest(t, mode)
	}
}

func runDashboardSearchTest(t *testing.T, mode rest.DualWriterMode) {
	t.Run(fmt.Sprintf("search types with dual writer mode %d", mode), func(t *testing.T) {
		ctx := context.Background()

		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:     true,
			DisableDataMigrations: true,
			DisableAnonymous:      true,
			APIServerStorageType:  "unified",
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {DualWriterMode: mode},
				"folders.folder.grafana.app":       {DualWriterMode: mode},
			},
			UnifiedStorageEnableSearch: mode >= rest.Mode3,
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
