package palettes

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationPalettes_K8sAPIs(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false,
		DisableAnonymous:  false,
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
		},
	})

	ns := helper.Namespacer(helper.Org1.OrgID)
	alice := helper.Org1.Editor
	carol := helper.Org1.Viewer
	bob := helper.Org1.Admin

	base := func() string {
		return fmt.Sprintf("/apis/palettes.grafana.app/v0alpha1/namespaces/%s/palettes", ns)
	}

	putPalette := func(t *testing.T, user apis.User, name string, body []byte) apis.K8sResponse[map[string]any] {
		t.Helper()
		path := fmt.Sprintf("%s/%s", base(), name)
		return apis.DoRequest(helper, apis.RequestParams{
			User:   user,
			Method: http.MethodPut,
			Path:   path,
			Body:   body,
		}, &map[string]any{})
	}

	getPaletteRaw := func(t *testing.T, user apis.User, name string) (int, []byte) {
		t.Helper()
		path := fmt.Sprintf("%s/%s", base(), name)
		rsp := apis.DoRequest(helper, apis.RequestParams{User: user, Path: path}, &map[string]any{})
		return rsp.Response.StatusCode, rsp.Body
	}

	deletePalette := func(t *testing.T, user apis.User, name string) int {
		t.Helper()
		path := fmt.Sprintf("%s/%s", base(), name)
		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   user,
			Method: http.MethodDelete,
			Path:   path,
		}, &map[string]any{})
		return rsp.Response.StatusCode
	}

	listNames := func(t *testing.T, user apis.User, querySuffix string) ([]string, int, []byte) {
		t.Helper()
		path := base()
		if querySuffix != "" {
			path += querySuffix
		}
		rsp := apis.DoRequest(helper, apis.RequestParams{User: user, Path: path}, &apis.AnyResourceList{})
		if rsp.Response.StatusCode != http.StatusOK {
			return nil, rsp.Response.StatusCode, rsp.Body
		}
		names := make([]string, 0, len(rsp.Result.Items))
		for _, item := range rsp.Result.Items {
			meta, ok := item["metadata"].(map[string]any)
			require.True(t, ok, "item metadata: %v", item)
			n, ok := meta["name"].(string)
			require.True(t, ok)
			names = append(names, n)
		}
		return names, rsp.Response.StatusCode, rsp.Body
	}

	paletteJSON := func(name, id, displayName, colorsJSON, shareWithJSON string) []byte {
		return []byte(fmt.Sprintf(`{
			"apiVersion": "palettes.grafana.app/v0alpha1",
			"kind": "Palette",
			"metadata": {"name": %q, "namespace": %q},
			"spec": {
				"id": %q,
				"displayName": %q,
				"colors": %s,
				"shareWith": %s
			}
		}`, name, ns, id, displayName, colorsJSON, shareWithJSON))
	}

	t.Run("org admin creates org-corporate and reads it back", func(t *testing.T) {
		name := "org-corporate"
		body := paletteJSON(name, "corporate", "Corporate", `["#112233"]`, `[]`)
		put := putPalette(t, bob, name, body)
		require.Contains(t, []int{http.StatusOK, http.StatusCreated}, put.Response.StatusCode,
			"PUT org palette: %s", string(put.Body))

		code, raw := getPaletteRaw(t, bob, name)
		require.Equal(t, http.StatusOK, code, string(raw))
		var obj map[string]any
		require.NoError(t, json.Unmarshal(raw, &obj))
		spec := obj["spec"].(map[string]any)
		require.Equal(t, "corporate", spec["id"])

		names, status, listBody := listNames(t, bob, "")
		require.Equal(t, http.StatusOK, status, string(listBody))
		require.Contains(t, names, name)
	})

	aliceUID := alice.Identity.GetIdentifier()
	sunsetName := fmt.Sprintf("user-%s-sunset", aliceUID)

	t.Run("Alice creates private user palette; Carol does not list it", func(t *testing.T) {
		body := paletteJSON(sunsetName, "sunset", "Sunset", `["#ff0000","#00ff00"]`, `[]`)
		put := putPalette(t, alice, sunsetName, body)
		require.Contains(t, []int{http.StatusOK, http.StatusCreated}, put.Response.StatusCode, string(put.Body))

		code, raw := getPaletteRaw(t, alice, sunsetName)
		require.Equal(t, http.StatusOK, code, string(raw))

		carolNames, status, listBody := listNames(t, carol, "")
		require.Equal(t, http.StatusOK, status, string(listBody))
		require.NotContains(t, carolNames, sunsetName)
	})

	t.Run("Alice shares with org; Carol lists it; Carol cannot update; Carol GET succeeds", func(t *testing.T) {
		code, raw := getPaletteRaw(t, alice, sunsetName)
		require.Equal(t, http.StatusOK, code, string(raw))
		var cur map[string]any
		require.NoError(t, json.Unmarshal(raw, &cur))
		spec := cur["spec"].(map[string]any)
		spec["shareWith"] = []any{"org"}
		cur["spec"] = spec
		updated, err := json.Marshal(cur)
		require.NoError(t, err)

		put := putPalette(t, alice, sunsetName, updated)
		require.Contains(t, []int{http.StatusOK, http.StatusCreated}, put.Response.StatusCode, string(put.Body))

		carolNames, status, listBody := listNames(t, carol, "")
		require.Equal(t, http.StatusOK, status, string(listBody))
		require.Contains(t, carolNames, sunsetName)

		hijackCode, hijackRaw := getPaletteRaw(t, carol, sunsetName)
		require.Equal(t, http.StatusOK, hijackCode, string(hijackRaw))
		var hijackObj map[string]any
		require.NoError(t, json.Unmarshal(hijackRaw, &hijackObj))
		hijSpec := hijackObj["spec"].(map[string]any)
		hijSpec["displayName"] = "Hijacked"
		hijackObj["spec"] = hijSpec
		hijack, err := json.Marshal(hijackObj)
		require.NoError(t, err)
		carolPut := putPalette(t, carol, sunsetName, hijack)
		require.Equal(t, http.StatusForbidden, carolPut.Response.StatusCode, string(carolPut.Body))

		getCode, getBody := getPaletteRaw(t, carol, sunsetName)
		require.Equal(t, http.StatusOK, getCode, string(getBody))
	})

	t.Run("anonymous GET succeeds; anonymous LIST is rejected", func(t *testing.T) {
		addr := helper.GetEnv().Server.HTTPServer.Listener.Addr()
		client := &http.Client{
			Timeout: 30 * time.Second,
			CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
				return http.ErrUseLastResponse
			},
		}
		getPath := fmt.Sprintf("%s/%s", base(), sunsetName)
		req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("http://%s%s", addr, getPath), nil)
		require.NoError(t, err)
		getRsp, err := client.Do(req)
		require.NoError(t, err)
		t.Cleanup(func() { _ = getRsp.Body.Close() })
		getBody, _ := io.ReadAll(getRsp.Body)
		require.Equal(t, http.StatusOK, getRsp.StatusCode, string(getBody))

		listReq, err := http.NewRequest(http.MethodGet, fmt.Sprintf("http://%s%s", addr, base()), nil)
		require.NoError(t, err)
		listRsp, err := client.Do(listReq)
		require.NoError(t, err)
		t.Cleanup(func() { _ = listRsp.Body.Close() })
		require.GreaterOrEqual(t, listRsp.StatusCode, 400,
			"anonymous LIST should be rejected (got %d)", listRsp.StatusCode)
	})

	t.Run("org admin lists all palettes and can update and delete another user's palette", func(t *testing.T) {
		bobNames, status, listBody := listNames(t, bob, "")
		require.Equal(t, http.StatusOK, status, string(listBody))
		require.Contains(t, bobNames, sunsetName)

		code, raw := getPaletteRaw(t, bob, sunsetName)
		require.Equal(t, http.StatusOK, code, string(raw))
		var cur map[string]any
		require.NoError(t, json.Unmarshal(raw, &cur))
		spec := cur["spec"].(map[string]any)
		spec["displayName"] = "Admin touched"
		cur["spec"] = spec
		updated, err := json.Marshal(cur)
		require.NoError(t, err)
		put := putPalette(t, bob, sunsetName, updated)
		require.Contains(t, []int{http.StatusOK, http.StatusCreated}, put.Response.StatusCode, string(put.Body))

		delCode := deletePalette(t, bob, sunsetName)
		require.Contains(t, []int{http.StatusOK, http.StatusAccepted, http.StatusNoContent}, delCode)

		after, _ := getPaletteRaw(t, carol, sunsetName)
		require.Equal(t, http.StatusNotFound, after)
	})

	t.Run("viewer cannot update team-owned palette", func(t *testing.T) {
		// Staff has Admin + Editor only (not Viewer). Org admin creates the team-owned palette
		// (same pattern as preferences team prefs integration).
		staffUID := helper.Org1.Staff.UID
		teamPalette := fmt.Sprintf("team-%s-warm", staffUID)
		body := paletteJSON(teamPalette, "warm", "Warm", `["#abcdef"]`, `[]`)
		put := putPalette(t, bob, teamPalette, body)
		require.Contains(t, []int{http.StatusOK, http.StatusCreated}, put.Response.StatusCode, string(put.Body))

		code, raw := getPaletteRaw(t, bob, teamPalette)
		require.Equal(t, http.StatusOK, code, string(raw))
		var cur map[string]any
		require.NoError(t, json.Unmarshal(raw, &cur))
		spec := cur["spec"].(map[string]any)
		spec["displayName"] = "Carol cannot hijack"
		cur["spec"] = spec
		updated, err := json.Marshal(cur)
		require.NoError(t, err)
		carolPut := putPalette(t, carol, teamPalette, updated)
		require.Equal(t, http.StatusForbidden, carolPut.Response.StatusCode, string(carolPut.Body))
	})

	t.Run("list with continue token is rejected", func(t *testing.T) {
		_, status, body := listNames(t, alice, "?continue=opaque")
		require.GreaterOrEqual(t, status, 400, "expected error status, got %d: %s", status, string(body))
	})

	t.Run("validation rejects bad hex color", func(t *testing.T) {
		name := "org-badcolor"
		body := paletteJSON(name, "badcolor", "Bad", `["#gggggg"]`, `[]`)
		put := putPalette(t, bob, name, body)
		require.Equal(t, http.StatusBadRequest, put.Response.StatusCode, string(put.Body))
	})

	t.Run("validation rejects spec.id not matching name suffix", func(t *testing.T) {
		name := "org-mismatch"
		body := paletteJSON(name, "wrongslug", "Mismatch", `["#010203"]`, `[]`)
		put := putPalette(t, bob, name, body)
		require.Equal(t, http.StatusBadRequest, put.Response.StatusCode, string(put.Body))
	})
}
