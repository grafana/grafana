package dashboards

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	dashboardV2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// Run with -update-golden to regenerate the snapshots after an intentional
// change to a legacy response:
//
//	go test ./pkg/tests/apis/dashboard/ -run TestIntegrationLegacyDashboardAPIGolden -update-golden
var updateGolden = flag.Bool("update-golden", false, "regenerate legacy dashboard API golden JSON files")

const legacyGoldenDir = "testdata/legacy"

// TestIntegrationLegacyDashboardAPIGolden pins the response shape of the legacy
// GET /api/dashboards/uid/:uid and GET /api/search endpoints. Any service that
// serves these endpoints in place of single-tenant Grafana must produce the
// same snapshots.
func TestIntegrationLegacyDashboardAPIGolden(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	opts := testinfra.GrafanaOpts{DisableAnonymous: true}
	opts.Dir, opts.DirPath = testinfra.CreateGrafDir(t, opts)
	writeProvisionedDashboard(t, opts.Dir)

	helper := apis.NewK8sTestHelperWithOpts(t, apis.K8sTestHelperOpts{GrafanaOpts: opts})
	t.Cleanup(helper.Shutdown)

	admin := helper.Org1.Admin
	createLegacyFolder(t, helper, admin, map[string]any{"uid": "golden-parent", "title": "Golden parent"})
	createLegacyFolder(t, helper, admin, map[string]any{"uid": "golden-child", "title": "Golden child", "parentUid": "golden-parent"})
	createLegacyDashboard(t, helper, admin, map[string]any{
		"dashboard": map[string]any{
			"uid":           "golden-general",
			"title":         "Golden general",
			"tags":          []string{"golden"},
			"schemaVersion": 41,
			"panels": []any{map[string]any{
				"id":      1,
				"type":    "timeseries",
				"title":   "Panel",
				"gridPos": map[string]any{"x": 0, "y": 0, "w": 12, "h": 8},
			}},
			"templating": map[string]any{"list": []any{map[string]any{
				"name":  "env",
				"type":  "custom",
				"query": "dev,prod",
			}}},
		},
	})
	createLegacyDashboard(t, helper, admin, map[string]any{
		"folderUid": "golden-child",
		"dashboard": map[string]any{
			"uid":           "golden-nested",
			"title":         "Golden nested",
			"tags":          []string{"golden", "nested"},
			"schemaVersion": 41,
		},
	})

	v2 := helper.LoadYAMLOrJSON(`
apiVersion: dashboard.grafana.app/v2beta1
kind: Dashboard
metadata:
  name: golden-v2
spec:
  title: Golden v2
  tags:
    - golden
  layout:
    kind: GridLayout
    spec:
      items: []
`)
	v2Client := helper.GetResourceClient(apis.ResourceClientArgs{
		User: admin,
		GVR:  dashboardV2beta1.DashboardResourceInfo.GroupVersionResource(),
	})
	_, err := v2Client.Resource.Create(t.Context(), v2, metav1.CreateOptions{})
	require.NoError(t, err)

	fixtureUIDs := []string{"golden-parent", "golden-child", "golden-general", "golden-nested", "golden-v2", "golden-provisioned"}
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		var hits []map[string]any
		rsp := apis.DoRequest(helper, apis.RequestParams{User: admin, Path: "/api/search?query=Golden"}, &hits)
		if !assert.Equal(collect, http.StatusOK, rsp.Response.StatusCode) {
			return
		}
		found := map[string]bool{}
		for _, hit := range hits {
			if uid, ok := hit["uid"].(string); ok {
				found[uid] = true
			}
		}
		for _, uid := range fixtureUIDs {
			assert.True(collect, found[uid], "search index is missing %s", uid)
		}
	}, 30*time.Second, 100*time.Millisecond)

	cases := []struct {
		name string
		user apis.User
		path string
	}{
		{"get-general-admin", admin, "/api/dashboards/uid/golden-general"},
		{"get-general-editor", helper.Org1.Editor, "/api/dashboards/uid/golden-general"},
		{"get-general-viewer", helper.Org1.Viewer, "/api/dashboards/uid/golden-general"},
		{"get-nested-admin", admin, "/api/dashboards/uid/golden-nested"},
		{"get-provisioned-admin", admin, "/api/dashboards/uid/golden-provisioned"},
		{"get-v2-admin", admin, "/api/dashboards/uid/golden-v2"},
		{"get-v2-viewer", helper.Org1.Viewer, "/api/dashboards/uid/golden-v2"},
		{"get-v2-admin-apiversion-v2beta1", admin, "/api/dashboards/uid/golden-v2?apiVersion=v2beta1"},
		{"get-missing-admin", admin, "/api/dashboards/uid/golden-missing"},
		{"search-query-admin", admin, "/api/search?query=Golden&sort=alpha-asc"},
		{"search-query-viewer", helper.Org1.Viewer, "/api/search?query=Golden&sort=alpha-asc"},
		{"search-type-dash-db", admin, "/api/search?query=Golden&type=dash-db&sort=alpha-asc"},
		{"search-type-dash-folder", admin, "/api/search?query=Golden&type=dash-folder&sort=alpha-asc"},
		{"search-folder-uids", admin, "/api/search?folderUIDs=golden-child&sort=alpha-asc"},
		{"search-tag", admin, "/api/search?tag=nested&sort=alpha-asc"},
		{"search-dashboard-uids", admin, "/api/search?dashboardUIDs=golden-general&dashboardUIDs=golden-v2&sort=alpha-asc"},
		{"search-sorting", admin, "/api/search/sorting"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var body any
			rsp := apis.DoRequest(helper, apis.RequestParams{User: tc.user, Path: tc.path}, &body)
			checkLegacyGolden(t, tc.name, rsp.Response.StatusCode, rsp.Body)
		})
	}
}

func writeProvisionedDashboard(t *testing.T, grafanaDir string) {
	t.Helper()

	provDir := filepath.Join(grafanaDir, "conf", "provisioning", "dashboards")
	dashDir := filepath.Join(provDir, "legacy-golden")
	require.NoError(t, os.MkdirAll(dashDir, 0o750))

	cfg := fmt.Appendf(nil, `apiVersion: 1

providers:
- name: 'legacy golden'
  type: file
  allowUiUpdates: false
  options:
    path: %s
`, dashDir)
	require.NoError(t, os.WriteFile(filepath.Join(provDir, "legacy-golden.yaml"), cfg, 0o600))

	dash := []byte(`{"uid": "golden-provisioned", "title": "Golden provisioned", "tags": ["golden"], "schemaVersion": 41}`)
	require.NoError(t, os.WriteFile(filepath.Join(dashDir, "golden-provisioned.json"), dash, 0o600))
}

func createLegacyFolder(t *testing.T, helper *apis.K8sTestHelper, user apis.User, payload map[string]any) {
	t.Helper()
	postLegacy(t, helper, user, "/api/folders", payload)
}

func createLegacyDashboard(t *testing.T, helper *apis.K8sTestHelper, user apis.User, payload map[string]any) {
	t.Helper()
	postLegacy(t, helper, user, "/api/dashboards/db", payload)
}

func postLegacy(t *testing.T, helper *apis.K8sTestHelper, user apis.User, path string, payload map[string]any) {
	t.Helper()

	body, err := json.Marshal(payload)
	require.NoError(t, err)
	var result any
	rsp := apis.DoRequest(helper, apis.RequestParams{User: user, Method: http.MethodPost, Path: path, Body: body}, &result)
	require.Equal(t, http.StatusOK, rsp.Response.StatusCode, "POST %s: %s", path, rsp.Body)
}

func checkLegacyGolden(t *testing.T, name string, status int, body []byte) {
	t.Helper()

	var decoded any
	if len(body) > 0 {
		dec := json.NewDecoder(bytes.NewReader(body))
		dec.UseNumber()
		require.NoError(t, dec.Decode(&decoded), "response is not JSON: %s", body)
	}

	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	enc.SetIndent("", "  ")
	require.NoError(t, enc.Encode(map[string]any{
		"status": status,
		"body":   maskLegacyResponse(decoded),
	}))
	got := buf.Bytes()

	path := filepath.Join(legacyGoldenDir, name+".json")
	if *updateGolden {
		require.NoError(t, os.MkdirAll(legacyGoldenDir, 0o750))
		require.NoError(t, os.WriteFile(path, got, 0o600)) // #nosec G703 -- test golden-file regeneration on controlled path
		return
	}

	want, err := os.ReadFile(path) //nolint:gosec
	require.NoError(t, err, "missing golden file; run with -update-golden")
	assert.JSONEq(t, string(want), string(got))
}

// maskLegacyResponse replaces values that change between runs. Zero IDs and
// empty timestamps stay as they are, since whether they are set is part of the
// response shape. An "id" is masked only next to a "uid", so stable panel IDs
// stay in the snapshot.
func maskLegacyResponse(v any) any {
	switch val := v.(type) {
	case map[string]any:
		_, hasUID := val["uid"]
		out := make(map[string]any, len(val))
		for k, child := range val {
			out[k] = maskLegacyField(k, child, hasUID)
		}
		return out
	case []any:
		out := make([]any, len(val))
		for i, child := range val {
			out[i] = maskLegacyResponse(child)
		}
		return out
	default:
		return v
	}
}

func maskLegacyField(key string, v any, hasUID bool) any {
	switch key {
	case "id":
		if n, ok := v.(json.Number); ok && hasUID && n.String() != "0" {
			return "<id>"
		}
	case "folderId", "dashboardId":
		if n, ok := v.(json.Number); ok && n.String() != "0" {
			return "<id>"
		}
	case "created", "updated":
		if s, ok := v.(string); ok && s != "" && s != "0001-01-01T00:00:00Z" {
			return "<timestamp>"
		}
	case "traceID", "accessErrorId":
		if s, ok := v.(string); ok && s != "" {
			return "<" + key + ">"
		}
	}
	return maskLegacyResponse(v)
}
