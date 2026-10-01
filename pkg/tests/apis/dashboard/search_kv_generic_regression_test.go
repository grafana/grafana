package dashboards

// Regression tests for dashboard KV-stats sorting after the generic source.kv
// work. Dashboards keep their hand-written KVDashboardStats extraction; these
// tests only pin the observable sort behaviour of both search endpoints:
//
//   - legacy GET .../v0alpha1/namespaces/{ns}/search with sort=-views_total and
//     the legacy alias sort=viewed-recently-desc (views_last_30_days);
//   - generic POST .../v1/namespaces/{ns}/dashboards/search sorted by
//     views_total, which is what the Usage Insights plugin ranks with.
//
// Names sort alphabetically in the reverse of the expected views order, so an
// alphabetical fallback fails the order assertions.

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

const (
	regrOwner = "usageinsights.grafana.app"
	regrKey   = "stats"

	regrLow  = "kv-regr-aaa" // views_total 10
	regrMid  = "kv-regr-bbb" // views_total 100
	regrHigh = "kv-regr-ccc" // views_total 1000
	regrNone = "kv-regr-000" // no stats document; sorts first by name
)

type regrHit struct {
	Name   string
	Fields map[string]any
}

func newDashboardKVRegressionHelper(t *testing.T) *apis.K8sTestHelper {
	t.Helper()
	return apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: true,
		DisableAnonymous:  true,
		EnableSearchAPI:   true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagStorageResourceKV,
		},
		APIServerStorageType: "unified",
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			"dashboards.dashboard.grafana.app": {DualWriterMode: 5},
			"folders.folder.grafana.app":       {DualWriterMode: 5},
		},
		KVStatsRefreshInterval: 50 * time.Millisecond,
	})
}

// seedRegressionDashboards creates the four dashboards in a folder and writes
// the given stats documents through a service account holding kv:write.
func seedRegressionDashboards(t *testing.T, h *apis.K8sTestHelper, folderUID string, stats map[string]string) {
	t.Helper()
	ctx := context.Background()
	orgID := h.Org1.Admin.Identity.GetOrgID()
	ns := h.Namespacer(orgID)

	adminClient := h.GetResourceClient(apis.ResourceClientArgs{User: h.Org1.Admin, GVR: dashKVGVR})
	createFolder(t, ctx, h, folderUID, "KV regression "+folderUID)

	sa := h.CreateServiceAccount(h.Org1.Admin, "kv-regr-sa-"+folderUID, orgID, org.RoleViewer)
	token := h.CreateServiceAccountToken(h.Org1.Admin, sa.Id, orgID, "kv-regr-token-"+folderUID, 0)
	grantKVWriteDashboard(t, h, orgID, sa.Id, regrOwner)
	setFolderPermissions(t, h, h.Org1.Admin, folderUID, []ResourcePermissionSetting{
		{UserID: &sa.Id, Level: ResourcePermissionLevelView},
	})

	createSearchKVDashboard(t, adminClient, regrLow, "Regression Low", folderUID)
	createSearchKVDashboard(t, adminClient, regrMid, "Regression Mid", folderUID)
	createSearchKVDashboard(t, adminClient, regrHigh, "Regression High", folderUID)
	createSearchKVDashboard(t, adminClient, regrNone, "Regression None", folderUID)

	kv := &kvDashHelper{t: t, helper: h}
	for name, body := range stats {
		resp := kv.putWithToken(token, ns, name, regrOwner, regrKey, []byte(body))
		code := resp.StatusCode
		_ = resp.Body.Close()
		require.Equal(t, http.StatusNoContent, code, "PUT stats for %s", name)
	}
}

func doRegrRequest(h *apis.K8sTestHelper, method, path string, body []byte) (int, []byte, error) {
	url := fmt.Sprintf("http://%s%s", h.GetEnv().Server.HTTPServer.Listener.Addr(), path)
	var rdr io.Reader
	if body != nil {
		rdr = bytes.NewReader(body)
	}
	req, err := http.NewRequest(method, url, rdr)
	if err != nil {
		return 0, nil, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	cfg := h.Org1.Admin.NewRestConfig()
	req.SetBasicAuth(cfg.Username, cfg.Password)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	raw, err := io.ReadAll(resp.Body)
	return resp.StatusCode, raw, err
}

// legacySearch runs GET .../v0alpha1/.../search?type=dashboard&sort=<sort>&field=<field>.
func legacySearch(h *apis.K8sTestHelper, sort, field string) (int, []regrHit, error) {
	ns := h.Namespacer(h.Org1.Admin.Identity.GetOrgID())
	path := fmt.Sprintf("/apis/dashboard.grafana.app/v0alpha1/namespaces/%s/search?type=dashboard&limit=100&sort=%s&field=%s",
		ns, sort, field)
	code, raw, err := doRegrRequest(h, http.MethodGet, path, nil)
	if err != nil || code != http.StatusOK {
		return code, nil, err
	}
	var sr struct {
		Hits []struct {
			Name  string         `json:"name"`
			Field map[string]any `json:"field"`
		} `json:"hits"`
	}
	if err := json.Unmarshal(raw, &sr); err != nil {
		return code, nil, err
	}
	out := make([]regrHit, 0, len(sr.Hits))
	for _, hit := range sr.Hits {
		out = append(out, regrHit{Name: hit.Name, Fields: hit.Field})
	}
	return code, out, nil
}

// genericSearch runs POST /apis/dashboard.grafana.app/v1/.../dashboards/search.
func genericSearch(h *apis.K8sTestHelper, field, dir string) (int, []regrHit, error) {
	ns := h.Namespacer(h.Org1.Admin.Identity.GetOrgID())
	body := fmt.Appendf(nil,
		`{"apiVersion":"search.grafana.app/v0alpha1","kind":"SearchQuery","sort":[{"field":%q,"direction":%q}],"fields":["title",%q],"limit":100}`,
		field, dir, field)
	code, raw, err := doRegrRequest(h, http.MethodPost,
		fmt.Sprintf("/apis/dashboard.grafana.app/v1/namespaces/%s/dashboards/search", ns), body)
	if err != nil || code != http.StatusOK {
		return code, nil, err
	}
	var sr struct {
		Items []struct {
			Resource struct {
				Name string `json:"name"`
			} `json:"resource"`
			Fields map[string]any `json:"fields"`
		} `json:"items"`
	}
	if err := json.Unmarshal(raw, &sr); err != nil {
		return code, nil, err
	}
	out := make([]regrHit, 0, len(sr.Items))
	for _, it := range sr.Items {
		out = append(out, regrHit{Name: it.Resource.Name, Fields: it.Fields})
	}
	return code, out, nil
}

func regrOrder(hits []regrHit) []string {
	want := map[string]bool{regrLow: true, regrMid: true, regrHigh: true, regrNone: true}
	out := []string{}
	for _, h := range hits {
		if want[h.Name] {
			out = append(out, h.Name)
		}
	}
	return out
}

func regrHitByName(hits []regrHit, name string) (regrHit, bool) {
	for _, h := range hits {
		if h.Name == name {
			return h, true
		}
	}
	return regrHit{}, false
}

// eventuallyRegrOrder polls run until the order of the four dashboards is want.
func eventuallyRegrOrder(t *testing.T, run func() (int, []regrHit, error), want []string, bound time.Duration, msg string) []regrHit {
	t.Helper()
	var last []regrHit
	var lastCode int
	ok := assert.Eventually(t, func() bool {
		code, hits, err := run()
		lastCode = code
		if err != nil || code != http.StatusOK {
			return false
		}
		last = hits
		return assert.ObjectsAreEqual(want, regrOrder(hits))
	}, bound, 250*time.Millisecond, msg)
	if !ok {
		t.Logf("last status=%d order=%v", lastCode, regrOrder(last))
		t.FailNow()
	}
	return last
}

// Legacy search keeps ordering dashboards by KV stats, for both the index
// field name and the legacy viewed-recently alias (views_last_30_days).
func TestIntegrationDashboardSearchKVRegression(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	h := newDashboardKVRegressionHelper(t)
	defer h.Shutdown()

	// views_total:        ccc 1000 > bbb 100 > aaa 10 > 000 none
	// views_last_30_days: aaa 300  > ccc 200 > bbb 20 > 000 none
	seedRegressionDashboards(t, h, "kv-regr-legacy", map[string]string{
		regrLow:  `{"views_total":10,"views_last_30_days":300}`,
		regrMid:  `{"views_total":100,"views_last_30_days":20}`,
		regrHigh: `{"views_total":1000,"views_last_30_days":200}`,
	})

	t.Run("sort=-views_total", func(t *testing.T) {
		hits := eventuallyRegrOrder(t, func() (int, []regrHit, error) {
			return legacySearch(h, "-views_total", "views_total")
		}, []string{regrHigh, regrMid, regrLow, regrNone}, 10*time.Second,
			"legacy sort=-views_total must order ccc, bbb, aaa, then the dashboard without stats")
		high, _ := regrHitByName(hits, regrHigh)
		assert.EqualValues(t, 1000, high.Fields["views_total"])
	})

	t.Run("sort=viewed-recently-desc", func(t *testing.T) {
		eventuallyRegrOrder(t, func() (int, []regrHit, error) {
			return legacySearch(h, "viewed-recently-desc", "views_last_30_days")
		}, []string{regrLow, regrHigh, regrMid, regrNone}, 10*time.Second,
			"legacy sort=viewed-recently-desc must order by views_last_30_days: aaa, ccc, bbb, then none")
	})
}

// The generic per-kind search endpoint sorts dashboards by views_total, which
// is how the Usage Insights plugin ranks every kind.
func TestIntegrationDashboardGenericSearchViewsSort(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	h := newDashboardKVRegressionHelper(t)
	defer h.Shutdown()

	seedRegressionDashboards(t, h, "kv-regr-generic", map[string]string{
		regrLow:  `{"views_total":10}`,
		regrMid:  `{"views_total":100}`,
		regrHigh: `{"views_total":1000}`,
	})

	hits := eventuallyRegrOrder(t, func() (int, []regrHit, error) {
		return genericSearch(h, "views_total", "desc")
	}, []string{regrHigh, regrMid, regrLow, regrNone}, 10*time.Second,
		"generic dashboards/search sorted by views_total desc must order high, mid, low, none")

	for name, want := range map[string]float64{regrHigh: 1000, regrMid: 100, regrLow: 10} {
		hit, ok := regrHitByName(hits, name)
		require.True(t, ok)
		assert.EqualValues(t, want, hit.Fields["views_total"], "views_total for %s", name)
	}
	none, ok := regrHitByName(hits, regrNone)
	require.True(t, ok)
	_, has := none.Fields["views_total"]
	assert.False(t, has, "views_total must be absent for a dashboard with no stats document")
	assert.Equal(t, "Regression None", none.Fields["title"])
}
