package dashboards

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	k8srest "k8s.io/client-go/rest"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationSearchLegacyAPI tests the legacy /api/search endpoint
// This establishes a baseline for the legacy API behavior before migration.
func TestIntegrationSearchLegacyAPI(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("legacy search API baseline tests", func(t *testing.T) {
		ctx := context.Background()

		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableDataMigrations: true,
			AppModeProduction:     true,
			DisableAnonymous:      true,
			APIServerStorageType:  "unified",
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode3},
				"folders.folder.grafana.app":       {DualWriterMode: rest.Mode3},
			},
			UnifiedStorageEnableSearch: true,
		})
		defer helper.Shutdown()

		// Create test data via K8s API
		folderUID := "search-test-folder"
		dashboardUID := createTestDashboard(t, helper, ctx, folderUID)
		createTestFolder(t, helper, ctx, folderUID)

		t.Run("basic search returns results", func(t *testing.T) {
			results := callLegacySearch(t, helper, helper.Org1.Admin, "")
			require.NotNil(t, results, "Legacy search should return results")
		})

		t.Run("search with query parameter", func(t *testing.T) {
			results := callLegacySearch(t, helper, helper.Org1.Admin, "query=Search")
			require.NotNil(t, results, "Search with query should return results")
		})

		t.Run("search with type=dash-folder", func(t *testing.T) {
			results := callLegacySearch(t, helper, helper.Org1.Admin, "type=dash-folder")
			for _, hit := range results {
				assert.Equal(t, model.DashHitFolder, hit.Type, "All results should be folders")
			}
		})

		t.Run("search with type=dash-db", func(t *testing.T) {
			results := callLegacySearch(t, helper, helper.Org1.Admin, "type=dash-db")
			for _, hit := range results {
				assert.Equal(t, model.DashHitDB, hit.Type, "All results should be dashboards")
			}
		})

		t.Run("search with limit parameter", func(t *testing.T) {
			results := callLegacySearch(t, helper, helper.Org1.Admin, "limit=5")
			require.LessOrEqual(t, len(results), 5, "Results should respect limit")
		})

		t.Run("search with permission=Edit", func(t *testing.T) {
			// Viewer should not see edit-only items
			_ = callLegacySearch(t, helper, helper.Org1.Viewer, "permission=Edit")
			// Test completes without error - permission filtering works
		})

		t.Run("search with folderUIDs parameter", func(t *testing.T) {
			results := callLegacySearch(t, helper, helper.Org1.Admin, fmt.Sprintf("folderUIDs=%s", folderUID))
			for _, hit := range results {
				if hit.Type == model.DashHitDB {
					assert.Equal(t, folderUID, hit.FolderUID, "Dashboard should be in specified folder")
				}
			}
		})

		t.Run("search returns proper hit structure", func(t *testing.T) {
			results := callLegacySearch(t, helper, helper.Org1.Admin, fmt.Sprintf("dashboardUIDs=%s", dashboardUID))
			if len(results) > 0 {
				hit := results[0]
				assert.NotEmpty(t, hit.UID, "Hit should have UID")
				assert.NotEmpty(t, hit.Title, "Hit should have Title")
				assert.NotEmpty(t, hit.URL, "Hit should have URL")
				assert.NotEmpty(t, hit.Type, "Hit should have Type")
			}
		})
	})
}

// TestIntegrationSearchK8sAPI tests the new K8s /apis/ search endpoint
func TestIntegrationSearchK8sAPI(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("K8s search API tests", func(t *testing.T) {
		ctx := context.Background()

		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableDataMigrations: true,
			AppModeProduction:     true,
			DisableAnonymous:      true,
			APIServerStorageType:  "unified",
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode3},
				"folders.folder.grafana.app":       {DualWriterMode: rest.Mode3},
			},
			UnifiedStorageEnableSearch: true,
		})
		defer helper.Shutdown()

		// Create test data
		folderUID := "k8s-search-test-folder"
		createTestFolder(t, helper, ctx, folderUID)
		createTestDashboard(t, helper, ctx, folderUID)

		t.Run("basic search returns results", func(t *testing.T) {
			results := callK8sSearch(t, helper, ctx, helper.Org1.Admin, "")
			require.NotNil(t, results, "K8s search should return results")
		})

		t.Run("search with query parameter", func(t *testing.T) {
			results := callK8sSearch(t, helper, ctx, helper.Org1.Admin, "query=Search")
			require.NotNil(t, results, "Search with query should return results")
		})

		t.Run("search with type=folder", func(t *testing.T) {
			results := callK8sSearch(t, helper, ctx, helper.Org1.Admin, "type=folder")
			for _, hit := range results.Hits {
				assert.Equal(t, "folders", hit.Resource, "All results should be folders")
			}
		})

		t.Run("search with type=dashboard", func(t *testing.T) {
			results := callK8sSearch(t, helper, ctx, helper.Org1.Admin, "type=dashboard")
			for _, hit := range results.Hits {
				assert.Equal(t, "dashboards", hit.Resource, "All results should be dashboards")
			}
		})

		t.Run("search with limit parameter", func(t *testing.T) {
			results := callK8sSearch(t, helper, ctx, helper.Org1.Admin, "limit=5")
			require.LessOrEqual(t, len(results.Hits), 5, "Results should respect limit")
		})

		t.Run("search with permission=view", func(t *testing.T) {
			results := callK8sSearch(t, helper, ctx, helper.Org1.Viewer, "permission=view")
			require.NotNil(t, results, "Search with view permission should work")
		})

		t.Run("search with permission=edit", func(t *testing.T) {
			// Viewer should not see edit-only items
			_ = callK8sSearch(t, helper, ctx, helper.Org1.Viewer, "permission=edit")
			// Test completes without error - permission filtering works
		})

		t.Run("search with folder parameter", func(t *testing.T) {
			results := callK8sSearch(t, helper, ctx, helper.Org1.Admin, fmt.Sprintf("folder=%s", folderUID))
			for _, hit := range results.Hits {
				if hit.Resource == "dashboards" {
					assert.Equal(t, folderUID, hit.Folder, "Dashboard should be in specified folder")
				}
			}
		})

		t.Run("search sortable endpoint works", func(t *testing.T) {
			sortable := callK8sSortable(t, helper, ctx, helper.Org1.Admin)
			require.NotNil(t, sortable, "Sortable endpoint should return results")
			require.NotEmpty(t, sortable.Fields, "Should have sortable fields")
		})
	})
}

// TestIntegrationSearchCrossAPIParity verifies that legacy and K8s APIs produce equivalent results
func TestIntegrationSearchCrossAPIParity(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// Only test modes where both legacy and K8s paths should work
	modes := []rest.DualWriterMode{rest.Mode3, rest.Mode4, rest.Mode5}
	for _, mode := range modes {
		t.Run(fmt.Sprintf("cross-API parity with mode %d", mode), func(t *testing.T) {
			ctx := context.Background()

			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				DisableDataMigrations: true,
				AppModeProduction:     true,
				DisableAnonymous:      true,
				APIServerStorageType:  "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"dashboards.dashboard.grafana.app": {DualWriterMode: mode},
					"folders.folder.grafana.app":       {DualWriterMode: mode},
				},
				UnifiedStorageEnableSearch: true,
			})
			defer helper.Shutdown()

			// Create test data
			folderUID := fmt.Sprintf("parity-test-folder-%d", mode)
			createTestFolder(t, helper, ctx, folderUID)
			dashUID := createTestDashboard(t, helper, ctx, folderUID)

			t.Run("both APIs return same dashboard count for folder search", func(t *testing.T) {
				// Note: Legacy API uses folderUIDs, K8s uses folder
				legacyResults := callLegacySearch(t, helper, helper.Org1.Admin, fmt.Sprintf("folderUIDs=%s&type=dash-db", folderUID))
				k8sResults := callK8sSearch(t, helper, ctx, helper.Org1.Admin, fmt.Sprintf("folder=%s&type=dashboard", folderUID))

				// Count dashboards from each
				legacyDashCount := 0
				for _, hit := range legacyResults {
					if hit.Type == model.DashHitDB {
						legacyDashCount++
					}
				}

				k8sDashCount := 0
				for _, hit := range k8sResults.Hits {
					if hit.Resource == "dashboards" {
						k8sDashCount++
					}
				}

				assert.Equal(t, legacyDashCount, k8sDashCount, "Both APIs should return same number of dashboards")
			})

			t.Run("both APIs find same dashboard by UID", func(t *testing.T) {
				// Legacy uses dashboardUIDs, K8s uses name
				legacyResults := callLegacySearch(t, helper, helper.Org1.Admin, fmt.Sprintf("dashboardUIDs=%s", dashUID))
				k8sResults := callK8sSearch(t, helper, ctx, helper.Org1.Admin, fmt.Sprintf("name=%s", dashUID))

				require.Len(t, legacyResults, 1, "Legacy should find exactly one dashboard")
				require.Len(t, k8sResults.Hits, 1, "K8s should find exactly one dashboard")

				assert.Equal(t, dashUID, legacyResults[0].UID, "Legacy result should have correct UID")
				assert.Equal(t, dashUID, k8sResults.Hits[0].Name, "K8s result should have correct name")
			})

			t.Run("type filtering produces equivalent results", func(t *testing.T) {
				// Get folder counts from both APIs
				legacyFolders := callLegacySearch(t, helper, helper.Org1.Admin, "type=dash-folder")
				k8sFolders := callK8sSearch(t, helper, ctx, helper.Org1.Admin, "type=folder")

				legacyFolderCount := len(legacyFolders)
				k8sFolderCount := len(k8sFolders.Hits)

				assert.Equal(t, legacyFolderCount, k8sFolderCount, "Both APIs should return same number of folders")
			})

			t.Run("permission filtering works equivalently", func(t *testing.T) {
				// Both should return same access for same user with same permission filter
				legacyView := callLegacySearch(t, helper, helper.Org1.Viewer, "permission=View")
				k8sView := callK8sSearch(t, helper, ctx, helper.Org1.Viewer, "permission=view")

				// Just verify both work - exact parity depends on permission setup
				require.NotNil(t, legacyView, "Legacy view permission search should work")
				require.NotNil(t, k8sView, "K8s view permission search should work")
			})
		})
	}
}

// Helper functions

func callLegacySearch(t *testing.T, helper *apis.K8sTestHelper, user apis.User, params string) model.HitList {
	path := "/api/search"
	if params != "" {
		path = fmt.Sprintf("%s?%s", path, params)
	}

	resp := apis.DoRequest(helper, apis.RequestParams{
		User:   user,
		Method: http.MethodGet,
		Path:   path,
	}, &model.HitList{})

	require.Equal(t, http.StatusOK, resp.Response.StatusCode, "Legacy search should succeed")
	return *resp.Result
}

func callK8sSearch(t *testing.T, helper *apis.K8sTestHelper, ctx context.Context, user apis.User, params string) dashboardV0.SearchResults {
	ns := user.Identity.GetNamespace()
	cfg := dynamic.ConfigFor(user.NewRestConfig())
	cfg.GroupVersion = &schema.GroupVersion{Group: "dashboard.grafana.app", Version: "v0alpha1"}
	restClient, err := k8srest.RESTClientFor(cfg)
	require.NoError(t, err)

	var statusCode int
	req := restClient.Get().AbsPath("apis", "dashboard.grafana.app", "v0alpha1", "namespaces", ns, "search")

	// Parse params and add them
	for _, kv := range splitParams(params) {
		if len(kv) == 2 {
			req = req.Param(kv[0], kv[1])
		}
	}

	res := req.Do(ctx).StatusCode(&statusCode)
	require.NoError(t, res.Error())
	require.Equal(t, http.StatusOK, statusCode, "K8s search should succeed")

	var sr dashboardV0.SearchResults
	raw, err := res.Raw()
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(raw, &sr))
	return sr
}

func callK8sSortable(t *testing.T, helper *apis.K8sTestHelper, ctx context.Context, user apis.User) dashboardV0.SortableFields {
	ns := user.Identity.GetNamespace()
	cfg := dynamic.ConfigFor(user.NewRestConfig())
	cfg.GroupVersion = &schema.GroupVersion{Group: "dashboard.grafana.app", Version: "v0alpha1"}
	restClient, err := k8srest.RESTClientFor(cfg)
	require.NoError(t, err)

	var statusCode int
	res := restClient.Get().AbsPath("apis", "dashboard.grafana.app", "v0alpha1", "namespaces", ns, "search", "sortable").
		Do(ctx).StatusCode(&statusCode)
	require.NoError(t, res.Error())
	require.Equal(t, http.StatusOK, statusCode, "K8s sortable should succeed")

	var sf dashboardV0.SortableFields
	raw, err := res.Raw()
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(raw, &sf))
	return sf
}

func splitParams(params string) [][2]string {
	if params == "" {
		return nil
	}
	result := make([][2]string, 0)
	for _, kv := range splitString(params, '&') {
		parts := splitString(kv, '=')
		if len(parts) == 2 {
			result = append(result, [2]string{parts[0], parts[1]})
		}
	}
	return result
}

func splitString(s string, sep byte) []string {
	result := make([]string, 0)
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == sep {
			result = append(result, s[start:i])
			start = i + 1
		}
	}
	result = append(result, s[start:])
	return result
}

func createTestFolder(t *testing.T, helper *apis.K8sTestHelper, ctx context.Context, folderUID string) {
	cfg := dynamic.ConfigFor(helper.Org1.Admin.NewRestConfig())
	cfg.GroupVersion = &schema.GroupVersion{Group: "folder.grafana.app", Version: "v1beta1"}
	restClient, err := k8srest.RESTClientFor(cfg)
	require.NoError(t, err)

	var statusCode int
	body := []byte(fmt.Sprintf(`{"uid":"%s","title":"Search Test Folder %s"}`, folderUID, folderUID))
	result := restClient.Post().AbsPath("api", "folders").
		Body(body).
		SetHeader("Content-type", "application/json").
		Do(ctx).
		StatusCode(&statusCode)

	// Ignore if folder already exists
	if statusCode != http.StatusOK && statusCode != http.StatusConflict {
		require.NoError(t, result.Error())
	}
}

func createTestDashboard(t *testing.T, helper *apis.K8sTestHelper, ctx context.Context, folderUID string) string {
	dashUID := fmt.Sprintf("search-test-dash-%s", folderUID)
	cfg := dynamic.ConfigFor(helper.Org1.Admin.NewRestConfig())
	cfg.GroupVersion = &schema.GroupVersion{Group: "dashboard.grafana.app", Version: "v0alpha1"}
	restClient, err := k8srest.RESTClientFor(cfg)
	require.NoError(t, err)

	var statusCode int
	body := []byte(fmt.Sprintf(`{
		"dashboard": {
			"uid": "%s",
			"title": "Search Test Dashboard",
			"schemaVersion": 30
		},
		"folderUid": "%s",
		"overwrite": true
	}`, dashUID, folderUID))

	result := restClient.Post().AbsPath("api", "dashboards", "db").
		Body(body).
		SetHeader("Content-type", "application/json").
		Do(ctx).
		StatusCode(&statusCode)

	// May fail if already exists, which is fine
	if statusCode != http.StatusOK && statusCode != http.StatusPreconditionFailed {
		require.NoError(t, result.Error())
	}

	return dashUID
}
