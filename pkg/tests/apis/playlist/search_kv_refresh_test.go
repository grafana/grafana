package playlist

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// source.kv fields are filled and periodically refreshed, and a playlist
// with no stats document has the field absent. TestIntegrationPlaylistSearchKV
// writes stats before its first search; this covers the two other
// transitions a real install goes through:
//   - playlists indexed with no KV data at all (plugin installed later),
//     then the first stats are written;
//   - every stats document deleted again (for example dev/reset).

const (
	plX = "kvrefresh-p-x"
	plY = "kvrefresh-p-y"
)

func TestIntegrationPlaylistSearchKV_RefreshFromAndToNoData(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	h := newPlaylistSearchHelper(t, true)
	defer h.Shutdown()

	orgID := h.Org1.Admin.Identity.GetOrgID()
	ns := h.Namespacer(orgID)
	adminClient := h.GetResourceClient(apis.ResourceClientArgs{User: h.Org1.Admin, GVR: playlistKVGVR})
	kv := &kvPlaylistHelper{t: t, helper: h}

	sa := h.CreateServiceAccount(h.Org1.Admin, "kv-refresh-playlist-sa", orgID, org.RoleViewer)
	token := h.CreateServiceAccountToken(h.Org1.Admin, sa.Id, orgID, "kv-refresh-playlist-token", 0)
	grantKVWritePlaylist(t, h, orgID, sa.Id, searchKVOwner)

	createNamedPlaylist(t, adminClient, plX, "Playlist X")
	createNamedPlaylist(t, adminClient, plY, "Playlist Y")
	names := []string{plX, plY}

	q := searchQueryBody{
		Sort:   []searchSort{{Field: "views_total", Direction: "desc"}},
		Fields: []string{"title", "views_total"},
	}

	// 1. Indexed with no KV data: both present, field absent on both.
	code, res := postPlaylistSearch(t, h, h.Org1.Admin, "v1", q)
	require.Equal(t, http.StatusOK, code)
	require.ElementsMatch(t, names, onlyNames(res, names))
	for _, n := range names {
		it, _ := itemByName(res, n)
		_, has := it.Fields["views_total"]
		require.False(t, has, "%s has views_total before any stats document exists", n)
	}

	// 2. The first stats ever written are picked up: y (5) before x (1).
	put := func(name string, total int) {
		t.Helper()
		body := fmt.Appendf(nil,
			`{"views_today":%d,"views_last_1_days":%d,"views_last_7_days":%d,"views_last_30_days":%d,"views_total":%d}`,
			total, total, total, total, total)
		resp := kv.doWithToken(http.MethodPut, kv.path(ns, name, searchKVOwner, searchKVKey), body, token)
		c := resp.StatusCode
		_ = resp.Body.Close()
		require.Equal(t, http.StatusNoContent, c, "PUT stats for %s", name)
	}
	put(plX, 1)
	put(plY, 5)
	res = eventuallyOrder(t, h, "v1", q, []string{plY, plX},
		"the first stats written after an empty baseline must reach the sort: y, x")
	for n, want := range map[string]float64{plX: 1, plY: 5} {
		it, _ := itemByName(res, n)
		assert.EqualValues(t, want, it.Fields["views_total"], "views_total for %s", n)
	}

	// 3. Every stats document deleted: the field goes absent again.
	for _, n := range names {
		resp := kv.doWithToken(http.MethodDelete, kv.path(ns, n, searchKVOwner, searchKVKey), nil, token)
		c := resp.StatusCode
		_ = resp.Body.Close()
		require.Contains(t, []int{http.StatusOK, http.StatusNoContent}, c, "DELETE stats for %s", n)
	}
	var last searchResultsBody
	ok := assert.Eventually(t, func() bool {
		c, r, err := tryPlaylistSearch(h, h.Org1.Admin, "v1", q)
		last = r
		if err != nil || c != http.StatusOK || len(onlyNames(r, names)) != len(names) {
			return false
		}
		for _, n := range names {
			it, _ := itemByName(r, n)
			if _, has := it.Fields["views_total"]; has {
				return false
			}
		}
		return true
	}, searchKVPollBound, searchKVPollTick, "views_total must go absent once every stats document is deleted")
	if !ok {
		for _, it := range last.Items {
			t.Logf("  %s fields=%v", it.Resource.Name, it.Fields)
		}
	}
}
