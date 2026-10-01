package playlist

// Integration tests for the generic source.kv search fields on playlists.
//
// Playlists declare views_* searchFields whose values come from the Usage
// Insights "stats" KV document (owner usageinsights.grafana.app). These tests
// check, through the public per-kind search endpoint only, that:
//   - sorting by a views_* field orders playlists by the KV value, with
//     playlists that have no stats document last in both directions;
//   - a KV-only change (no playlist resourceVersion change) is picked up by a
//     later search within the documented bound;
//   - the refresh counter reports the change;
//   - without KV data, or with the KV toggle off, search still works and the
//     fields are simply absent.
//
// Name design: names sort a < b < c < d, but by views_total desc the expected
// order is b, d, a, c. Any name-based fallback fails the order assertions.

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/prometheus/common/expfmt"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

const (
	searchKVOwner = "usageinsights.grafana.app"
	searchKVKey   = "stats"

	// The refresh interval configured on the test server, and the documented
	// bound within which a KV write shows up in sorted results.
	searchKVRefreshInterval = time.Second
	searchKVPollBound       = 2*searchKVRefreshInterval + 10*time.Second
	searchKVPollTick        = 250 * time.Millisecond

	plA = "kvsearch-p-a"
	plB = "kvsearch-p-b"
	plC = "kvsearch-p-c" // never gets a stats document
	plD = "kvsearch-p-d"
)

var allSearchPlaylists = []string{plA, plB, plC, plD}

type searchSort struct {
	Field     string `json:"field"`
	Direction string `json:"direction,omitempty"`
}

type searchQueryBody struct {
	APIVersion string       `json:"apiVersion"`
	Kind       string       `json:"kind"`
	Sort       []searchSort `json:"sort,omitempty"`
	Fields     []string     `json:"fields,omitempty"`
	Limit      int          `json:"limit,omitempty"`
}

type searchResultItem struct {
	Resource struct {
		Group    string `json:"group"`
		Resource string `json:"resource"`
		Kind     string `json:"kind"`
		Name     string `json:"name"`
	} `json:"resource"`
	Fields map[string]any `json:"fields"`
}

type searchResultsBody struct {
	APIVersion string             `json:"apiVersion"`
	Kind       string             `json:"kind"`
	Items      []searchResultItem `json:"items"`
}

func newPlaylistSearchHelper(t *testing.T, kvToggle bool) *apis.K8sTestHelper {
	t.Helper()
	var toggles []string
	if kvToggle {
		toggles = append(toggles, featuremgmt.FlagStorageResourceKV)
	}
	// No UnifiedStorageConfig for playlists: the default configuration must
	// already serve playlists from unified storage (not dual-write).
	return apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:      true,
		DisableAnonymous:       true,
		EnableSearchAPI:        true,
		EnableFeatureToggles:   toggles,
		KVStatsRefreshInterval: searchKVRefreshInterval,
	})
}

// tryPlaylistSearch posts a SearchQuery to the playlist search endpoint of the
// given API version and returns the HTTP status and, on 200, the decoded body.
// It never calls t.FailNow, so it is safe inside Eventually conditions.
func tryPlaylistSearch(h *apis.K8sTestHelper, user apis.User, version string, q searchQueryBody) (int, searchResultsBody, error) {
	q.APIVersion = "search.grafana.app/v0alpha1"
	q.Kind = "SearchQuery"
	if q.Limit == 0 {
		q.Limit = 50
	}
	var out searchResultsBody
	body, err := json.Marshal(q)
	if err != nil {
		return 0, out, err
	}

	ns := h.Namespacer(user.Identity.GetOrgID())
	url := fmt.Sprintf("http://%s/apis/playlist.grafana.app/%s/namespaces/%s/playlists/search",
		h.GetEnv().Server.HTTPServer.Listener.Addr(), version, ns)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return 0, out, err
	}
	req.Header.Set("Content-Type", "application/json")
	cfg := user.NewRestConfig()
	req.SetBasicAuth(cfg.Username, cfg.Password)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, out, err
	}
	defer func() { _ = resp.Body.Close() }()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return resp.StatusCode, out, err
	}
	if resp.StatusCode == http.StatusOK {
		if err := json.Unmarshal(raw, &out); err != nil {
			return resp.StatusCode, out, fmt.Errorf("decode %s: %w", string(raw), err)
		}
	}
	return resp.StatusCode, out, nil
}

func postPlaylistSearch(t *testing.T, h *apis.K8sTestHelper, user apis.User, version string, q searchQueryBody) (int, searchResultsBody) {
	t.Helper()
	code, res, err := tryPlaylistSearch(h, user, version, q)
	require.NoError(t, err)
	return code, res
}

func createNamedPlaylist(t *testing.T, client *apis.K8sResourceClient, name, title string) {
	t.Helper()
	obj := &unstructured.Unstructured{Object: map[string]any{
		"spec": map[string]any{
			"title":    title,
			"interval": "5m",
			"items":    []any{},
		},
	}}
	obj.SetName(name)
	obj.SetAPIVersion(playlistKVGVR.GroupVersion().String())
	obj.SetKind("Playlist")
	_, err := client.Resource.Create(context.Background(), obj, metav1.CreateOptions{})
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = client.Resource.Delete(context.Background(), name, metav1.DeleteOptions{})
	})
}

// onlyNames returns the names of items among want, in result order.
func onlyNames(res searchResultsBody, want []string) []string {
	set := map[string]bool{}
	for _, w := range want {
		set[w] = true
	}
	out := []string{}
	for _, it := range res.Items {
		if set[it.Resource.Name] {
			out = append(out, it.Resource.Name)
		}
	}
	return out
}

func itemByName(res searchResultsBody, name string) (searchResultItem, bool) {
	for _, it := range res.Items {
		if it.Resource.Name == name {
			return it, true
		}
	}
	return searchResultItem{}, false
}

// eventuallyOrder polls the search until the order of our playlists equals want,
// and returns the last response.
func eventuallyOrder(t *testing.T, h *apis.K8sTestHelper, version string, q searchQueryBody, want []string, msg string) searchResultsBody {
	t.Helper()
	var last searchResultsBody
	var lastCode int
	ok := assert.Eventually(t, func() bool {
		code, res, err := tryPlaylistSearch(h, h.Org1.Admin, version, q)
		lastCode, last = code, res
		if err != nil || code != http.StatusOK {
			return false
		}
		got := onlyNames(res, want)
		if len(got) != len(want) {
			return false
		}
		for i := range want {
			if got[i] != want[i] {
				return false
			}
		}
		return true
	}, searchKVPollBound, searchKVPollTick, msg)
	if !ok {
		t.Logf("last status=%d order=%v", lastCode, onlyNames(last, want))
		for _, it := range last.Items {
			t.Logf("  %s fields=%v", it.Resource.Name, it.Fields)
		}
		t.FailNow()
	}
	return last
}

// kvFieldsRefreshChanged reads index_server_kv_fields_refresh_total from the
// server's /metrics and sums the series for the given group with result=changed.
func kvFieldsRefreshChanged(t *testing.T, h *apis.K8sTestHelper, group string) float64 {
	t.Helper()
	url := fmt.Sprintf("http://%s/metrics", h.GetEnv().Server.HTTPServer.Listener.Addr())
	resp, err := http.Get(url)
	require.NoError(t, err)
	defer func() { _ = resp.Body.Close() }()
	require.Equal(t, http.StatusOK, resp.StatusCode, "GET /metrics")

	parser := expfmt.NewTextParser(model.UTF8Validation)
	families, err := parser.TextToMetricFamilies(resp.Body)
	require.NoError(t, err)

	// Metrics registered on the legacy (index server) registry are exposed with a
	// grafana_ prefix on /metrics; accept either spelling.
	fam, ok := families["index_server_kv_fields_refresh_total"]
	if !ok {
		fam, ok = families["grafana_index_server_kv_fields_refresh_total"]
	}
	require.True(t, ok, "index_server_kv_fields_refresh_total must be exposed on /metrics")

	total := 0.0
	for _, m := range fam.GetMetric() {
		labels := map[string]string{}
		for _, l := range m.GetLabel() {
			labels[l.GetName()] = l.GetValue()
		}
		if labels["group"] == group && labels["result"] == "changed" {
			total += m.GetCounter().GetValue()
		}
	}
	return total
}

func TestIntegrationPlaylistSearchKV(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	h := newPlaylistSearchHelper(t, true)
	defer h.Shutdown()

	orgID := h.Org1.Admin.Identity.GetOrgID()
	ns := h.Namespacer(orgID)
	adminClient := h.GetResourceClient(apis.ResourceClientArgs{User: h.Org1.Admin, GVR: playlistKVGVR})
	kv := &kvPlaylistHelper{t: t, helper: h}

	sa := h.CreateServiceAccount(h.Org1.Admin, "kv-search-playlist-sa", orgID, org.RoleViewer)
	token := h.CreateServiceAccountToken(h.Org1.Admin, sa.Id, orgID, "kv-search-playlist-token", 0)
	grantKVWritePlaylist(t, h, orgID, sa.Id, searchKVOwner)

	createNamedPlaylist(t, adminClient, plA, "Playlist A")
	createNamedPlaylist(t, adminClient, plB, "Playlist B")
	createNamedPlaylist(t, adminClient, plC, "Playlist C")
	createNamedPlaylist(t, adminClient, plD, "Playlist D")

	putStats := func(name string, total, last7 int) {
		t.Helper()
		body := fmt.Appendf(nil,
			`{"views_today":%d,"views_last_1_days":%d,"views_last_7_days":%d,"views_last_30_days":%d,"views_total":%d}`,
			last7, last7, last7, total, total)
		resp := kv.doWithToken(http.MethodPut, kv.path(ns, name, searchKVOwner, searchKVKey), body, token)
		code := resp.StatusCode
		_ = resp.Body.Close()
		require.Equal(t, http.StatusNoContent, code, "PUT stats for %s", name)
	}

	// views_total: a=3, b=30, d=10, c=none   → desc b, d, a, c
	// views_last_7_days: a=20, b=5, d=1      → desc a, b, d, c (differs, so the
	// sort must use the requested field, not views_total)
	putStats(plA, 3, 20)
	putStats(plB, 30, 5)
	putStats(plD, 10, 1)

	byField := func(field, dir string) searchQueryBody {
		return searchQueryBody{
			Sort:   []searchSort{{Field: field, Direction: dir}},
			Fields: []string{"title", field},
		}
	}

	t.Run("views_total desc orders by KV value with absent last", func(t *testing.T) {
		res := eventuallyOrder(t, h, "v1", byField("views_total", "desc"),
			[]string{plB, plD, plA, plC}, "playlists sorted by views_total desc must be b, d, a, c")

		want := map[string]float64{plB: 30, plD: 10, plA: 3}
		for name, v := range want {
			it, ok := itemByName(res, name)
			require.True(t, ok)
			assert.EqualValues(t, v, it.Fields["views_total"], "views_total for %s", name)
			assert.Equal(t, "playlist.grafana.app", it.Resource.Group)
			assert.Equal(t, "playlists", it.Resource.Resource)
			assert.Equal(t, "Playlist", it.Resource.Kind)
		}
		c, ok := itemByName(res, plC)
		require.True(t, ok, "a playlist without stats must still be returned")
		_, has := c.Fields["views_total"]
		assert.False(t, has, "views_total must be absent for a playlist with no stats document")
		assert.Equal(t, "Playlist C", c.Fields["title"])
	})

	t.Run("all created playlists appear in search (system of record, not dual-write)", func(t *testing.T) {
		code, res := postPlaylistSearch(t, h, h.Org1.Admin, "v1", byField("views_total", "desc"))
		require.Equal(t, http.StatusOK, code)
		assert.ElementsMatch(t, allSearchPlaylists, onlyNames(res, allSearchPlaylists))
	})

	t.Run("views_last_7_days desc uses that field", func(t *testing.T) {
		res := eventuallyOrder(t, h, "v1", byField("views_last_7_days", "desc"),
			[]string{plA, plB, plD, plC}, "playlists sorted by views_last_7_days desc must be a, b, d, c")
		c, _ := itemByName(res, plC)
		_, has := c.Fields["views_last_7_days"]
		assert.False(t, has)
	})

	t.Run("views_total asc keeps absent last", func(t *testing.T) {
		eventuallyOrder(t, h, "v1", byField("views_total", "asc"),
			[]string{plA, plD, plB, plC}, "playlists sorted by views_total asc must be a, d, b, c")
	})

	t.Run("views_last_7_days asc keeps absent last", func(t *testing.T) {
		eventuallyOrder(t, h, "v1", byField("views_last_7_days", "asc"),
			[]string{plD, plB, plA, plC}, "playlists sorted by views_last_7_days asc must be d, b, a, c")
	})

	t.Run("v0alpha1 behaves the same as v1", func(t *testing.T) {
		eventuallyOrder(t, h, "v0alpha1", byField("views_total", "desc"),
			[]string{plB, plD, plA, plC}, "v0alpha1 playlists sorted by views_total desc must be b, d, a, c")
	})

	t.Run("sorting by an undeclared field returns 422", func(t *testing.T) {
		code, _ := postPlaylistSearch(t, h, h.Org1.Admin, "v1", byField("queries_total", "desc"))
		assert.Equal(t, http.StatusUnprocessableEntity, code)
	})

	t.Run("a KV-only change is picked up and counted as a changed refresh", func(t *testing.T) {
		// Flip: a=100, d=50, b=1 → desc a, d, b, c. No playlist is modified.
		putStats(plA, 100, 20)
		putStats(plD, 50, 1)
		putStats(plB, 1, 5)

		res := eventuallyOrder(t, h, "v1", byField("views_total", "desc"),
			[]string{plA, plD, plB, plC}, "after a KV-only change the order must become a, d, b, c")
		a, _ := itemByName(res, plA)
		assert.EqualValues(t, 100, a.Fields["views_total"])

		assert.Greater(t, kvFieldsRefreshChanged(t, h, "playlist.grafana.app"), 0.0,
			`index_server_kv_fields_refresh_total{group="playlist.grafana.app",result="changed"} must be > 0`)
	})
}

// With the KV toggle on but no KV written (the plugin is not installed),
// playlists work as before and the views_* fields are simply absent.
func TestIntegrationPlaylistSearchKV_NoData(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	h := newPlaylistSearchHelper(t, true)
	defer h.Shutdown()
	assertPlaylistsWorkWithoutKV(t, h)
}

// With the KV toggle off the same holds: 200, fields absent, no 5xx.
func TestIntegrationPlaylistSearchKV_ToggleOff(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	h := newPlaylistSearchHelper(t, false)
	defer h.Shutdown()
	assertPlaylistsWorkWithoutKV(t, h)
}

func assertPlaylistsWorkWithoutKV(t *testing.T, h *apis.K8sTestHelper) {
	t.Helper()
	ctx := context.Background()
	adminClient := h.GetResourceClient(apis.ResourceClientArgs{User: h.Org1.Admin, GVR: playlistKVGVR})

	// CRUD works.
	createNamedPlaylist(t, adminClient, plA, "Playlist A")
	createNamedPlaylist(t, adminClient, plB, "Playlist B")

	got, err := adminClient.Resource.Get(ctx, plA, metav1.GetOptions{})
	require.NoError(t, err)
	title, _, _ := unstructured.NestedString(got.Object, "spec", "title")
	assert.Equal(t, "Playlist A", title)

	require.NoError(t, unstructured.SetNestedField(got.Object, "Playlist A renamed", "spec", "title"))
	updated, err := adminClient.Resource.Update(ctx, got, metav1.UpdateOptions{})
	require.NoError(t, err)
	title, _, _ = unstructured.NestedString(updated.Object, "spec", "title")
	assert.Equal(t, "Playlist A renamed", title)

	createNamedPlaylist(t, adminClient, plC, "Playlist C")
	require.NoError(t, adminClient.Resource.Delete(ctx, plC, metav1.DeleteOptions{}))
	_, err = adminClient.Resource.Get(ctx, plC, metav1.GetOptions{})
	require.Error(t, err, "deleted playlist must be gone")

	for _, field := range []string{"views_total", "views_today", "views_last_7_days", "views_last_30_days"} {
		for _, dir := range []string{"desc", "asc"} {
			t.Run(field+"_"+dir, func(t *testing.T) {
				q := searchQueryBody{
					Sort:   []searchSort{{Field: field, Direction: dir}},
					Fields: []string{"title", field},
				}
				var res searchResultsBody
				serverErrors := 0
				require.Eventually(t, func() bool {
					code, r, err := tryPlaylistSearch(h, h.Org1.Admin, "v1", q)
					if code >= 500 {
						serverErrors++
					}
					if err != nil || code != http.StatusOK {
						return false
					}
					res = r
					a, ok := itemByName(r, plA)
					return ok && len(onlyNames(r, []string{plA, plB})) == 2 && a.Fields["title"] == "Playlist A renamed"
				}, searchKVPollBound, searchKVPollTick, "both playlists, with the updated title, must be found with status 200")
				assert.Zero(t, serverErrors, "search must never 5xx without KV data")

				for _, it := range res.Items {
					_, has := it.Fields[field]
					assert.False(t, has, "%s must be absent on %s when no KV is written", field, it.Resource.Name)
				}
			})
		}
	}
}
