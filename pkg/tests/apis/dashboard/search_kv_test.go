package dashboards

// Integration tests for search sort by views_total from KV stats.
//
// Expected behaviour: sort=-views_total orders dashboards by the KV documents
// within one refresh interval.
//
// Two test functions:
//   - TestIntegrationSearchKVSort: toggle ON; 3 dashboards with distinct
//     views_total; after writing KV stats the first search (which triggers
//     lazy index build) must return them in descending views_total order.
//   - TestIntegrationSearchKVSort_ToggleOff: toggle OFF; sort=-views_total
//     must not error (200) and no KV-derived values appear in hits.
//
// Name design: the three dashboard names are chosen so their alphabetical
// order is the REVERSE of the expected -views_total sort order:
//
//   name               views  alpha-rank  expected-views-rank
//   kv-srch-aaa-view   10     1st (first)  3rd (lowest views)
//   kv-srch-bbb-view   100    2nd          2nd
//   kv-srch-ccc-view   1000   3rd (last)   1st (highest views)
//
// Correct -views_total sort → ccc(0) < bbb(1) < aaa(2): assertions hold.
// Alpha fallback sort       → aaa(0) < bbb(1) < ccc(2): hitPos[ccc]=2,
//
//	not < hitPos[bbb]=1 — FAILS.
//
// This ensures that if views_total is absent from the index and bleve
// falls back to the name-based tiebreaker, at least one assertion fails.
// Only a correct sort by views_total makes all assertions pass.

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"
	k8srest "k8s.io/client-go/rest"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

const (
	// Fixed dashboard names: alphabetical order is intentionally reversed
	// from the expected -views_total sort order so that any alphabetical
	// fallback causes at least one assertion to fail.
	kvSearchNameLow  = "kv-srch-aaa-view" // 10 views  (alpha 1st, must sort 3rd)
	kvSearchNameMid  = "kv-srch-bbb-view" // 100 views (alpha 2nd, must sort 2nd)
	kvSearchNameHigh = "kv-srch-ccc-view" // 1000 views (alpha 3rd, must sort 1st)
)

// createSearchKVDashboard creates a dashboard with an explicit name (not
// generated) and registers a cleanup to delete it when the test ends.
func createSearchKVDashboard(
	t *testing.T, client *apis.K8sResourceClient,
	name, title, folderUID string,
) {
	t.Helper()
	obj := &unstructured.Unstructured{Object: map[string]interface{}{
		"spec": map[string]interface{}{
			"title":         title,
			"schemaVersion": 42,
		},
	}}
	obj.SetName(name)
	obj.SetAPIVersion(dashKVGVR.GroupVersion().String())
	obj.SetKind("Dashboard")
	if folderUID != "" {
		obj.SetAnnotations(map[string]string{utils.AnnoKeyFolder: folderUID})
	}
	created, err := client.Resource.Create(context.Background(), obj, metav1.CreateOptions{})
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = client.Resource.Delete(context.Background(), created.GetName(), metav1.DeleteOptions{})
	})
}

// TestIntegrationSearchKVSort verifies that when the storage.resourceKV toggle
// is on and KV stats are written for dashboards, a GET search sorted by
// -views_total returns them in descending views_total order.
//
// The three dashboards are named so that their alphabetical order is the
// REVERSE of the expected views_total sort order — any alpha-fallback causes
// at least one assertion to fail.
func TestIntegrationSearchKVSort(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	h := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: true,
		DisableAnonymous:  true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagStorageResourceKV,
		},
		APIServerStorageType: "unified",
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			"dashboards.dashboard.grafana.app": {DualWriterMode: 5},
			"folders.folder.grafana.app":       {DualWriterMode: 5},
		},
		// Short interval so the KV stats check runs quickly and queues a
		// namespace rebuild when the stats change.
		KVStatsRefreshInterval: 50 * time.Millisecond,
	})
	defer h.Shutdown()

	ctx := context.Background()
	ns := h.Namespacer(h.Org1.Admin.Identity.GetOrgID())

	adminClient := h.GetResourceClient(apis.ResourceClientArgs{
		User: h.Org1.Admin,
		GVR:  dashKVGVR,
	})
	kvHelper := &kvDashHelper{t: t, helper: h}

	// ── Folder ───────────────────────────────────────────────────────────────
	const testFolderUID = "kv-search-sort-folder"
	createFolder(t, ctx, h, testFolderUID, "KV Search Sort Test")

	// ── Service account with kv:write ─────────────────────────────────────
	const owner = "usageinsights.grafana.app"
	const kvKey = "stats"

	permittedSA := h.CreateServiceAccount(h.Org1.Admin, "kv-search-sa",
		h.Org1.Admin.Identity.GetOrgID(), org.RoleViewer)
	permittedToken := h.CreateServiceAccountToken(h.Org1.Admin, permittedSA.Id,
		h.Org1.Admin.Identity.GetOrgID(), "kv-search-token", 0)
	grantKVWriteDashboard(t, h, h.Org1.Admin.Identity.GetOrgID(), permittedSA.Id, owner)

	// The SA also needs folder-view access to reach the KV subresource.
	setFolderPermissions(t, h, h.Org1.Admin, testFolderUID, []ResourcePermissionSetting{
		{UserID: &permittedSA.Id, Level: ResourcePermissionLevelView},
	})

	// ── Create 3 dashboards with fixed names ──────────────────────────────
	// aaa=low, bbb=mid, ccc=high: alphabetical order is the REVERSE of
	// expected views_total sort order.
	createSearchKVDashboard(t, adminClient, kvSearchNameLow, "KV Search Low Views", testFolderUID)
	createSearchKVDashboard(t, adminClient, kvSearchNameMid, "KV Search Mid Views", testFolderUID)
	createSearchKVDashboard(t, adminClient, kvSearchNameHigh, "KV Search High Views", testFolderUID)

	// ── Write KV stats with distinct views_total ──────────────────────────
	// aaa gets the lowest, ccc the highest — opposite of alpha order.
	type kvEntry struct {
		name  string
		views int
	}
	entries := []kvEntry{
		{kvSearchNameLow, 10},
		{kvSearchNameMid, 100},
		{kvSearchNameHigh, 1000},
	}
	for _, e := range entries {
		body := []byte(fmt.Sprintf(`{"views_total":%d}`, e.views))
		resp := kvHelper.putWithToken(permittedToken, ns, e.name, owner, kvKey, body)
		statusCode := resp.StatusCode
		_ = resp.Body.Close()
		require.Equal(t, http.StatusNoContent, statusCode,
			"PUT kv for %s (views=%d) must return 204", e.name, e.views)
	}

	// ── Verify KV stats are readable ─────────────────────────────────────
	// Confirms the stats are in the database before the search index is built.
	for _, e := range entries {
		resp := kvHelper.getWithToken(permittedToken, ns, e.name, owner, kvKey)
		require.Equal(t, http.StatusOK, resp.StatusCode,
			"GET kv for %s must return 200", e.name)
		var got map[string]interface{}
		err := json.NewDecoder(resp.Body).Decode(&got)
		_ = resp.Body.Close()
		require.NoError(t, err)
		assert.EqualValues(t, e.views, got["views_total"],
			"kv GET for %s must reflect written views_total=%d", e.name, e.views)
	}

	// ── Search sorted by -views_total ─────────────────────────────────────
	// The dashboard index was built at server startup, before the KV stats were
	// written. With KVStatsRefreshInterval=50ms the next due check sees that the
	// stats differ from those the index was built with and queues a namespace
	// rebuild. We retry until the sort order reflects the new stats.
	cfg := dynamic.ConfigFor(h.Org1.Admin.NewRestConfig())
	cfg.GroupVersion = &dashboardV0.GroupVersion
	restClient, err := k8srest.RESTClientFor(cfg)
	require.NoError(t, err)

	// lastSR holds the most recent search response. t.Cleanup logs it even when
	// require.Eventually times out (cleanup runs after t.Fatalf / runtime.Goexit).
	var lastSR dashboardV0.SearchResults
	t.Cleanup(func() {
		for i, hit := range lastSR.Hits {
			var viewsTotal interface{}
			if hit.Field != nil {
				viewsTotal = hit.Field.Object["views_total"]
			}
			t.Logf("last-search hit[%d]: name=%s views_total=%v", i, hit.Name, viewsTotal)
		}
	})

	finalHitPos := map[string]int{
		kvSearchNameLow:  -1,
		kvSearchNameMid:  -1,
		kvSearchNameHigh: -1,
	}

	// Poll until the index is rebuilt with fresh KV stats and the sort order
	// is correct. 10s allows several builder refresh cycles (interval=50ms).
	require.Eventually(t, func() bool {
		var sc int
		res := restClient.Get().
			AbsPath("apis", dashboardV0.GroupVersion.Group, "v0alpha1", "namespaces", ns, "search").
			Param("sort", "-views_total").
			Param("type", "dashboard").
			Param("field", "views_total"). // makes views_total appear in hit.Field.Object
			Do(ctx).StatusCode(&sc)
		if res.Error() != nil || sc != http.StatusOK {
			return false
		}
		raw, err := res.Raw()
		if err != nil {
			return false
		}
		var sr dashboardV0.SearchResults
		if err := json.Unmarshal(raw, &sr); err != nil {
			return false
		}
		lastSR = sr

		pos := map[string]int{
			kvSearchNameLow:  -1,
			kvSearchNameMid:  -1,
			kvSearchNameHigh: -1,
		}
		for i, hit := range sr.Hits {
			if _, want := pos[hit.Name]; want {
				pos[hit.Name] = i
			}
		}
		if pos[kvSearchNameHigh] < 0 || pos[kvSearchNameMid] < 0 || pos[kvSearchNameLow] < 0 {
			return false
		}
		finalHitPos = pos
		return pos[kvSearchNameHigh] < pos[kvSearchNameMid] &&
			pos[kvSearchNameMid] < pos[kvSearchNameLow]
	}, 10*time.Second, 250*time.Millisecond,
		"dashboards must be sorted by -views_total (ccc>bbb>aaa) within 10s")

	// ── Assert descending views_total order ───────────────────────────────
	// ccc (1000) must precede bbb (100) must precede aaa (10).
	//
	// If views_total is NOT in the index (all-zero or absent), bleve falls
	// back to sorting by name: aaa(0) < bbb(1) < ccc(2).
	// Then hitPos[ccc]=2, which is NOT < hitPos[bbb]=1 → at least one
	// assertion fails, correctly flagging the production bug.
	assert.Less(t, finalHitPos[kvSearchNameHigh], finalHitPos[kvSearchNameMid],
		"high-views (1000, %s pos=%d) must appear before mid-views (100, %s pos=%d) when sorted by -views_total",
		kvSearchNameHigh, finalHitPos[kvSearchNameHigh], kvSearchNameMid, finalHitPos[kvSearchNameMid])
	assert.Less(t, finalHitPos[kvSearchNameMid], finalHitPos[kvSearchNameLow],
		"mid-views (100, %s pos=%d) must appear before low-views (10, %s pos=%d) when sorted by -views_total",
		kvSearchNameMid, finalHitPos[kvSearchNameMid], kvSearchNameLow, finalHitPos[kvSearchNameLow])

	// ── Assert views_total is present in the final result ─────────────────
	for _, name := range []string{kvSearchNameLow, kvSearchNameMid, kvSearchNameHigh} {
		pos := finalHitPos[name]
		if pos < 0 || pos >= len(lastSR.Hits) {
			continue
		}
		hit := lastSR.Hits[pos]
		if hit.Field == nil {
			t.Errorf("hit %q has nil Field; expected views_total to be present", name)
			continue
		}
		_, hasViews := hit.Field.Object["views_total"]
		assert.True(t, hasViews, "hit %q must carry views_total in the sorted result", name)
	}

	// ── Regression: stats-only changes (no dashboard RV change) must be
	// picked up by the next builder refresh ──────────────────────────────
	// PUT reversed stats: aaa now highest (1000), ccc now lowest (10). None of
	// the three dashboards' own resourceVersion changes — only the KV
	// side-channel data does (kv_test.go: "KV write does not change the
	// dashboard's resourceVersion"). By now the search index already exists
	// (built above), so ListModifiedSince alone never sees these dashboards
	// again: if updaterFn only reindexed via ListModifiedSince, the sort order
	// above would stay frozen forever. A correct fix diffs the old vs new KV
	// stats snapshot on every builder refresh and, when they differ, queues a
	// full rebuild of the namespace's dashboard index through the existing
	// rebuild mechanism (search.go: queueKVStatsRebuild / rebuildQueue), so
	// the order below must flip within the same 50ms-refresh-interval budget
	// as the first assertion, once the background rebuild worker picks up
	// the queued request and completes the rebuild.
	reversedEntries := []kvEntry{
		{kvSearchNameLow, 1000},
		{kvSearchNameMid, 100},
		{kvSearchNameHigh, 10},
	}
	for _, e := range reversedEntries {
		body := []byte(fmt.Sprintf(`{"views_total":%d}`, e.views))
		resp := kvHelper.putWithToken(permittedToken, ns, e.name, owner, kvKey, body)
		statusCode := resp.StatusCode
		_ = resp.Body.Close()
		require.Equal(t, http.StatusNoContent, statusCode,
			"PUT reversed kv for %s (views=%d) must return 204", e.name, e.views)
	}

	require.Eventually(t, func() bool {
		var sc int
		res := restClient.Get().
			AbsPath("apis", dashboardV0.GroupVersion.Group, "v0alpha1", "namespaces", ns, "search").
			Param("sort", "-views_total").
			Param("type", "dashboard").
			Param("field", "views_total").
			Do(ctx).StatusCode(&sc)
		if res.Error() != nil || sc != http.StatusOK {
			return false
		}
		raw, err := res.Raw()
		if err != nil {
			return false
		}
		var sr dashboardV0.SearchResults
		if err := json.Unmarshal(raw, &sr); err != nil {
			return false
		}
		lastSR = sr

		pos := map[string]int{
			kvSearchNameLow:  -1,
			kvSearchNameMid:  -1,
			kvSearchNameHigh: -1,
		}
		for i, hit := range sr.Hits {
			if _, want := pos[hit.Name]; want {
				pos[hit.Name] = i
			}
		}
		if pos[kvSearchNameLow] < 0 || pos[kvSearchNameMid] < 0 || pos[kvSearchNameHigh] < 0 {
			return false
		}
		finalHitPos = pos
		// Order must now be reversed: aaa(1000) > bbb(100) > ccc(10).
		return pos[kvSearchNameLow] < pos[kvSearchNameMid] &&
			pos[kvSearchNameMid] < pos[kvSearchNameHigh]
	}, 10*time.Second, 250*time.Millisecond,
		"dashboards must re-sort after KV-only stats changes (aaa>bbb>ccc) within 10s, even though no dashboard resourceVersion changed")

	assert.Less(t, finalHitPos[kvSearchNameLow], finalHitPos[kvSearchNameMid],
		"after reversal, low-name/high-views (%s pos=%d) must appear before mid (%s pos=%d)",
		kvSearchNameLow, finalHitPos[kvSearchNameLow], kvSearchNameMid, finalHitPos[kvSearchNameMid])
	assert.Less(t, finalHitPos[kvSearchNameMid], finalHitPos[kvSearchNameHigh],
		"after reversal, mid (%s pos=%d) must appear before high-name/low-views (%s pos=%d)",
		kvSearchNameMid, finalHitPos[kvSearchNameMid], kvSearchNameHigh, finalHitPos[kvSearchNameHigh])
}

// TestIntegrationSearchKVSort_ToggleOff verifies that when storage.resourceKV
// is OFF, GET search?sort=-views_total does not return an error (200) and no
// KV-derived views_total values appear in the hits.
func TestIntegrationSearchKVSort_ToggleOff(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// No FlagStorageResourceKV in EnableFeatureToggles.
	h := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:    true,
		DisableAnonymous:     true,
		APIServerStorageType: "unified",
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			"dashboards.dashboard.grafana.app": {DualWriterMode: 5},
			"folders.folder.grafana.app":       {DualWriterMode: 5},
		},
	})
	defer h.Shutdown()

	ctx := context.Background()
	ns := h.Namespacer(h.Org1.Admin.Identity.GetOrgID())

	cfg := dynamic.ConfigFor(h.Org1.Admin.NewRestConfig())
	cfg.GroupVersion = &dashboardV0.GroupVersion
	restClient, err := k8srest.RESTClientFor(cfg)
	require.NoError(t, err)

	var statusCode int
	res := restClient.Get().
		AbsPath("apis", dashboardV0.GroupVersion.Group, "v0alpha1", "namespaces", ns, "search").
		Param("sort", "-views_total").
		Param("type", "dashboard").
		Do(ctx).StatusCode(&statusCode)
	require.NoError(t, res.Error())
	assert.Equal(t, http.StatusOK, statusCode,
		"sort=-views_total with toggle off must return 200 (no error)")

	raw, err := res.Raw()
	require.NoError(t, err)
	var sr dashboardV0.SearchResults
	require.NoError(t, json.Unmarshal(raw, &sr))

	// No KV-derived views_total must appear in any hit.
	for _, hit := range sr.Hits {
		if hit.Field == nil {
			continue
		}
		_, hasViewsTotal := hit.Field.Object["views_total"]
		assert.False(t, hasViewsTotal,
			"hit %q must not carry views_total when toggle is off", hit.Name)
	}
}
