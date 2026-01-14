package dashboards

import (
	"context"
	"encoding/json"
	"fmt"
	"io/fs"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	k8srest "k8s.io/client-go/rest"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationSearchDevDashboards(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	ctx := context.Background()

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableDataMigrations: true,
		AppModeProduction:     true,
		DisableAnonymous:      true,
		APIServerStorageType:  "unified",
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode5},
			"folders.folder.grafana.app":       {DualWriterMode: rest.Mode5},
		},
		UnifiedStorageEnableSearch: true,
	})
	defer helper.Shutdown()

	// Create devenv dashboards from legacy API
	cfg := dynamic.ConfigFor(helper.Org1.Admin.NewRestConfig())
	cfg.GroupVersion = &dashboardV0.GroupVersion
	adminClient, err := k8srest.RESTClientFor(cfg)
	require.NoError(t, err)
	adminClient.Get()

	fileCount := 0
	devenv := "../../../../devenv/dev-dashboards/panel-timeseries"
	err = filepath.WalkDir(devenv, func(p string, d fs.DirEntry, e error) error {
		require.NoError(t, err)
		if d.IsDir() || filepath.Ext(d.Name()) != ".json" {
			return nil
		}

		// use the filename as UID
		uid := strings.TrimSuffix(d.Name(), ".json")
		if len(uid) > 40 {
			uid = uid[:40] // avoid uid too long, max 40 characters
		}

		// nolint:gosec
		data, err := os.ReadFile(p)
		require.NoError(t, err)

		cmd := dashboards.SaveDashboardCommand{
			Dashboard: &simplejson.Json{},
			Overwrite: true,
		}
		err = cmd.Dashboard.FromDB(data)
		require.NoError(t, err)
		cmd.Dashboard.Set("id", nil)
		cmd.Dashboard.Set("uid", uid)
		data, err = json.Marshal(cmd)
		require.NoError(t, err)

		var statusCode int
		result := adminClient.Post().AbsPath("api", "dashboards", "db").
			Body(data).
			SetHeader("Content-type", "application/json").
			Do(ctx).
			StatusCode(&statusCode)
		require.NoError(t, result.Error(), "file: [%d] %s [status:%d]", fileCount, d.Name(), statusCode)
		require.Equal(t, int(http.StatusOK), statusCode)
		fileCount++
		return nil
	})
	require.NoError(t, err)
	require.Equal(t, 16, fileCount, "file count from %s", devenv)

	// Helper to call search
	callSearch := func(user apis.User, params string) dashboardV0.SearchResults {
		require.NotNil(t, user)
		ns := user.Identity.GetNamespace()
		cfg := dynamic.ConfigFor(user.NewRestConfig())
		cfg.GroupVersion = &dashboardV0.GroupVersion
		restClient, err := k8srest.RESTClientFor(cfg)
		require.NoError(t, err)

		var statusCode int
		req := restClient.Get().AbsPath("apis", "dashboard.grafana.app", "v0alpha1", "namespaces", ns, "search").
			Param("limit", "1000").
			Param("type", "dashboard") // Only search dashboards

		for kv := range strings.SplitSeq(params, "&") {
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

		// Normalize scores and query cost for snapshot comparison
		sr.QueryCost = 0 // this depends on the hardware
		sr.MaxScore = roundTo(sr.MaxScore, 3)
		for i := range sr.Hits {
			sr.Hits[i].Score = roundTo(sr.Hits[i].Score, 3) // 0.6250571494814442 -> 0.625
		}
		return sr
	}

	// Compare a results to snapshots
	testCases := []struct {
		name   string
		user   apis.User
		params string
	}{
		{
			name:   "all",
			user:   helper.Org1.Admin,
			params: "", // only dashboards
		},
		{
			name:   "query-single-word",
			user:   helper.Org1.Admin,
			params: "query=stacking",
		},
		{
			name:   "query-multiple-words",
			user:   helper.Org1.Admin,
			params: "query=graph softMin", // must match ALL terms
		},
		{
			name:   "with-text-panel",
			user:   helper.Org1.Admin,
			params: "field=panel_types&panelType=text",
		},
		{
			name:   "title-ngram-prefix",
			user:   helper.Org1.Admin,
			params: "query=zer", // should match "Zero Decimals Y Ticks"
		},
		{
			name:   "title-ngram-middle-word",
			user:   helper.Org1.Admin,
			params: "query=decim", // should match "Zero Decimals Y Ticks"
		},
	}
	for i, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			res := callSearch(tc.user, tc.params)
			jj, err := json.MarshalIndent(res, "", "  ")
			require.NoError(t, err)

			fname := fmt.Sprintf("testdata/searchV0/t%02d-%s.json", i, tc.name)
			// nolint:gosec
			snapshot, err := os.ReadFile(fname)
			if err != nil {
				assert.Failf(t, "Failed to read snapshot", "file: %s", fname)
				err = os.WriteFile(fname, jj, 0o644)
				require.NoErrorf(t, err, "Failed to write snapshot file %s", fname)
				return
			}

			if !assert.JSONEq(t, string(snapshot), string(jj)) {
				err = os.WriteFile(fname, jj, 0o644)
				require.NoErrorf(t, err, "Failed to write snapshot file %s", fname)
			}
		})
	}
}

func TestIntegrationSearchPermissionFiltering(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// Only run for Unified Storage modes that support search (Mode3+)
	modes := []rest.DualWriterMode{rest.Mode3, rest.Mode4, rest.Mode5}
	for _, mode := range modes {
		runSearchPermissionTest(t, mode)
	}
}

func runSearchPermissionTest(t *testing.T, mode rest.DualWriterMode) {
	t.Run(fmt.Sprintf("search permission filtering with dual writer mode %d", mode), func(t *testing.T) {
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

		// Create a folder via legacy API using Admin
		folderUID := "perm-test-folder"
		{
			cfg := dynamic.ConfigFor(helper.Org1.Admin.NewRestConfig())
			cfg.GroupVersion = &schema.GroupVersion{Group: "folder.grafana.app", Version: "v1beta1"}
			restClient, err := k8srest.RESTClientFor(cfg)
			require.NoError(t, err)

			var statusCode int
			body := []byte(fmt.Sprintf(`{"uid":"%s","title":"Permission Test Folder"}`, folderUID))
			result := restClient.Post().AbsPath("api", "folders").
				Body(body).
				SetHeader("Content-type", "application/json").
				Do(ctx).
				StatusCode(&statusCode)
			require.NoError(t, result.Error())
			require.Equal(t, int(http.StatusOK), statusCode)
		}

		// Set permissions: Viewer gets View, Editor gets Edit
		viewerID, err := identity.UserIdentifier(helper.Org1.Viewer.Identity.GetID())
		require.NoError(t, err)
		editorID, err := identity.UserIdentifier(helper.Org1.Editor.Identity.GetID())
		require.NoError(t, err)

		permissions := []ResourcePermissionSetting{
			{UserID: &viewerID, Level: ResourcePermissionLevelView},
			{UserID: &editorID, Level: ResourcePermissionLevelEdit},
		}
		setFolderPermissions(t, helper, helper.Org1.Admin, folderUID, permissions)

		// Helper to call search
		callSearch := func(user apis.User, params string) dashboardV0.SearchResults {
			ns := user.Identity.GetNamespace()
			cfg := dynamic.ConfigFor(user.NewRestConfig())
			cfg.GroupVersion = &schema.GroupVersion{Group: "dashboard.grafana.app", Version: "v0alpha1"}
			restClient, err := k8srest.RESTClientFor(cfg)
			require.NoError(t, err)

			var statusCode int
			req := restClient.Get().AbsPath("apis", "dashboard.grafana.app", "v0alpha1", "namespaces", ns, "search").
				Param("limit", "1000").
				Param("type", "folder") // Only search folders

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

		// 1. Viewer searching without permission parameter should find it (has View access)
		{
			res := callSearch(helper.Org1.Viewer, "")
			found := false
			for _, h := range res.Hits {
				if h.Name == folderUID { // Verify it's our folder
					found = true
					break
				}
			}
			require.True(t, found, "Viewer should find folder without permission parameter")
		}

		// 2. Viewer searching with permission=View should find it
		{
			res := callSearch(helper.Org1.Viewer, "permission=view")
			found := false
			for _, h := range res.Hits {
				if h.Name == folderUID { // Verify it's our folder
					found = true
					break
				}
			}
			require.True(t, found, "Viewer should find folder with permission=view")
		}

		// 3. Viewer searching with permission=Edit should NOT find it
		{
			res := callSearch(helper.Org1.Viewer, "permission=edit")
			found := false
			for _, h := range res.Hits {
				if h.Name == folderUID { // Verify it's our folder
					found = true
					break
				}
			}
			require.False(t, found, "Viewer should NOT find folder with permission=edit")
		}

		// 4. Editor searching with permission=Edit should find it
		{
			res := callSearch(helper.Org1.Editor, "permission=edit")
			found := false
			for _, h := range res.Hits {
				if h.Name == folderUID { // Verify it's our folder
					found = true
					break
				}
			}
			require.True(t, found, "Editor should find folder with permission=edit")
		}

		// 5. Editor searching with permission=View should find it (Edit permission includes View)
		{
			res := callSearch(helper.Org1.Editor, "permission=view")
			found := false
			for _, h := range res.Hits {
				if h.Name == folderUID { // Verify it's our folder
					found = true
					break
				}
			}
			require.True(t, found, "Editor should find folder with permission=view (Edit includes View)")
		}

		// 6. Editor searching without permission parameter should find it (has Edit access)
		{
			res := callSearch(helper.Org1.Editor, "")
			found := false
			for _, h := range res.Hits {
				if h.Name == folderUID { // Verify it's our folder
					found = true
					break
				}
			}
			require.True(t, found, "Editor should find folder without permission parameter")
		}

		// 7. Admin searching with permission=View should find it (Admin has full access)
		{
			res := callSearch(helper.Org1.Admin, "permission=view")
			found := false
			for _, h := range res.Hits {
				if h.Name == folderUID { // Verify it's our folder
					found = true
					break
				}
			}
			require.True(t, found, "Admin should find folder with permission=view")
		}

		// 8. Admin searching with permission=Edit should find it (Admin has full access)
		{
			res := callSearch(helper.Org1.Admin, "permission=edit")
			found := false
			for _, h := range res.Hits {
				if h.Name == folderUID { // Verify it's our folder
					found = true
					break
				}
			}
			require.True(t, found, "Admin should find folder with permission=edit")
		}

		// 9. Admin searching with permission=Admin should find it (Admin has full access)
		{
			res := callSearch(helper.Org1.Admin, "permission=admin")
			found := false
			for _, h := range res.Hits {
				if h.Name == folderUID { // Verify it's our folder
					found = true
					break
				}
			}
			require.True(t, found, "Admin should find folder with permission=admin")
		}

		// 10. Admin searching without permission parameter should find it (has Admin access)
		{
			res := callSearch(helper.Org1.Admin, "")
			found := false
			for _, h := range res.Hits {
				if h.Name == folderUID { // Verify it's our folder
					found = true
					break
				}
			}
			require.True(t, found, "Admin should find folder without permission parameter")
		}
	})
}

// Types and helpers for permission setting

type ResourcePermissionLevel int

const (
	ResourcePermissionLevelView  ResourcePermissionLevel = 1
	ResourcePermissionLevelEdit  ResourcePermissionLevel = 2
	ResourcePermissionLevelAdmin ResourcePermissionLevel = 4
)

type ResourcePermissionSetting struct {
	UserID *int64                  `json:"userId,omitempty"`
	TeamID *int64                  `json:"teamId,omitempty"`
	Role   *string                 `json:"role,omitempty"`
	Level  ResourcePermissionLevel `json:"permission"`
}

type permissionRequest struct {
	Items []ResourcePermissionSetting `json:"items"`
}

func setFolderPermissions(t *testing.T, helper *apis.K8sTestHelper, actingUser apis.User, folderUID string, permissions []ResourcePermissionSetting) {
	reqBody := permissionRequest{
		Items: permissions,
	}

	jsonBody, err := json.Marshal(reqBody)
	require.NoError(t, err, "Failed to marshal permissions to JSON")

	path := fmt.Sprintf("/api/folders/%s/permissions", folderUID)

	resp := apis.DoRequest(helper, apis.RequestParams{
		User:        actingUser,
		Method:      http.MethodPost,
		Path:        path,
		Body:        jsonBody,
		ContentType: "application/json",
	}, &struct{}{})

	require.Equal(t, http.StatusOK, resp.Response.StatusCode, "Failed to set permissions for folder %s", folderUID)
}

// roundTo rounds a float64 to a specified number of decimal places.
func roundTo(n float64, decimals uint32) float64 {
	// Calculate the power of 10 for the desired number of decimals
	scale := math.Pow(10, float64(decimals))
	// Multiply, round to the nearest integer, and then divide back
	return math.Round(n*scale) / scale
}
