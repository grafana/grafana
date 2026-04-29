package preferences

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

// TestIntegrationPreferences_LegacyBridge verifies the legacy /api preferences
// HTTP endpoints behave correctly in both code paths: the original pref.Service
// implementation (flag off) and the new app-platform K8s bridge (flag on). Both
// must round-trip writes through GET, support PATCH-as-upsert, and respect
// PUT-replace vs PATCH-merge semantics for user, team, and org owners.
func TestIntegrationPreferences_LegacyBridge(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	cases := []struct {
		name  string
		flags []string
	}{
		{name: "legacy_path", flags: nil},
		{name: "k8s_bridge", flags: []string{featuremgmt.FlagGrafanaKubernetesPreferences}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction: false,
				DisableAnonymous:  true,
				EnableFeatureToggles: append([]string{
					featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
				}, tc.flags...),
			})

			t.Run("user preferences round-trip", func(t *testing.T) {
				putResult := putUserPrefs(t, helper, `{"theme":"dark","weekStart":"monday","timezone":"Europe/London"}`)
				require.Equal(t, http.StatusOK, putResult)

				got := getUserPrefs(t, helper)
				require.NotNil(t, got.Theme)
				require.Equal(t, "dark", *got.Theme)
				require.NotNil(t, got.WeekStart)
				require.Equal(t, "monday", *got.WeekStart)
				require.NotNil(t, got.Timezone)
				require.Equal(t, "Europe/London", *got.Timezone)
			})

			t.Run("team preferences write", func(t *testing.T) {
				teamID := helper.Org1.Staff.ID
				putResult := putTeamPrefs(t, helper, teamID, `{"theme":"light","weekStart":"sunday"}`)
				require.Equal(t, http.StatusOK, putResult)
			})

			if len(tc.flags) == 0 {
				// The K8s authorizer for team preferences requires membership in
				// user.GetGroups() for reads but uses AccessClient.Check for
				// writes. The test fixture's Admin user passes the write check
				// but not the membership read check, so the bridge GET fails
				// with 403 even though the legacy GET succeeds. Tracking issue
				// for the asymmetry: grafana/grafana#123657.
				t.Run("team preferences read", func(t *testing.T) {
					teamID := helper.Org1.Staff.ID
					putResult := putTeamPrefs(t, helper, teamID, `{"theme":"light","weekStart":"sunday"}`)
					require.Equal(t, http.StatusOK, putResult)

					got := getTeamPrefs(t, helper, teamID)
					require.NotNil(t, got.Theme)
					require.Equal(t, "light", *got.Theme)
					require.NotNil(t, got.WeekStart)
					require.Equal(t, "sunday", *got.WeekStart)
				})
			}

			t.Run("org preferences round-trip", func(t *testing.T) {
				putResult := putOrgPrefs(t, helper, `{"theme":"dark","timezone":"UTC"}`)
				require.Equal(t, http.StatusOK, putResult)

				got := getOrgPrefs(t, helper)
				require.NotNil(t, got.Theme)
				require.Equal(t, "dark", *got.Theme)
				require.NotNil(t, got.Timezone)
				require.Equal(t, "UTC", *got.Timezone)
			})

			t.Run("PATCH on missing upserts", func(t *testing.T) {
				// Use the Editor user — no other subtest writes preferences for them, so
				// the PATCH below is genuinely against a non-existent record. Both the
				// legacy pref.Service and the K8s bridge must upsert here.
				editor := helper.Org1.Editor

				patchResp := apis.DoRequest(helper, apis.RequestParams{
					User:   editor,
					Method: http.MethodPatch,
					Path:   "/api/user/preferences",
					Body:   []byte(`{"theme":"dark"}`),
				}, &map[string]any{})
				require.Equal(t, http.StatusOK, patchResp.Response.StatusCode, "PATCH on missing should upsert: %s", string(patchResp.Body))

				out := preferences.PreferencesSpec{}
				getResp := apis.DoRequest(helper, apis.RequestParams{
					User:   editor,
					Method: http.MethodGet,
					Path:   "/api/user/preferences",
				}, &out)
				require.Equal(t, http.StatusOK, getResp.Response.StatusCode)
				require.NotNil(t, getResp.Result.Theme)
				require.Equal(t, "dark", *getResp.Result.Theme)
			})

			t.Run("PUT replaces, PATCH merges", func(t *testing.T) {
				// Seed full prefs for the org, then PATCH only one field — others must remain.
				putResult := putOrgPrefs(t, helper,
					`{"theme":"dark","weekStart":"monday","timezone":"UTC"}`)
				require.Equal(t, http.StatusOK, putResult)

				patchResult := patchOrgPrefs(t, helper, `{"theme":"light"}`)
				require.Equal(t, http.StatusOK, patchResult)
				merged := getOrgPrefs(t, helper)
				require.NotNil(t, merged.Theme)
				require.Equal(t, "light", *merged.Theme, "PATCH must update theme")
				require.NotNil(t, merged.WeekStart)
				require.Equal(t, "monday", *merged.WeekStart, "PATCH must leave weekStart untouched (merge semantics)")
				require.NotNil(t, merged.Timezone)
				require.Equal(t, "UTC", *merged.Timezone, "PATCH must leave timezone untouched")

				// PUT now with a sparse body — fields the request omits should clear.
				require.Equal(t, http.StatusOK, putOrgPrefs(t, helper, `{"theme":"dark"}`))
				replaced := getOrgPrefs(t, helper)
				require.NotNil(t, replaced.Theme)
				require.Equal(t, "dark", *replaced.Theme)
				// Legacy GET omits empty fields entirely; the K8s bridge stores empty
				// strings explicitly. Either way, weekStart/timezone must no longer carry
				// the previous values.
				if replaced.WeekStart != nil {
					require.Equal(t, "", *replaced.WeekStart, "PUT must clear weekStart it omitted")
				}
				if replaced.Timezone != nil {
					require.Equal(t, "", *replaced.Timezone, "PUT must clear timezone it omitted")
				}
			})
		})
	}
}

// putUserPrefs / patchUserPrefs / getUserPrefs are the legacy /api wrappers
// the bridge tests exercise — same shape regardless of the feature flag.

func putUserPrefs(t *testing.T, helper *apis.K8sTestHelper, body string) int {
	t.Helper()
	resp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodPut,
		Path:   "/api/user/preferences",
		Body:   []byte(body),
	}, &map[string]any{})
	return resp.Response.StatusCode
}

func getUserPrefs(t *testing.T, helper *apis.K8sTestHelper) preferences.PreferencesSpec {
	t.Helper()
	out := preferences.PreferencesSpec{}
	resp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodGet,
		Path:   "/api/user/preferences",
	}, &out)
	require.Equal(t, http.StatusOK, resp.Response.StatusCode, "GET /api/user/preferences: %s", string(resp.Body))
	return *resp.Result
}

func putOrgPrefs(t *testing.T, helper *apis.K8sTestHelper, body string) int {
	t.Helper()
	resp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodPut,
		Path:   "/api/org/preferences",
		Body:   []byte(body),
	}, &map[string]any{})
	return resp.Response.StatusCode
}

func patchOrgPrefs(t *testing.T, helper *apis.K8sTestHelper, body string) int {
	t.Helper()
	resp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodPatch,
		Path:   "/api/org/preferences",
		Body:   []byte(body),
	}, &map[string]any{})
	return resp.Response.StatusCode
}

func getOrgPrefs(t *testing.T, helper *apis.K8sTestHelper) preferences.PreferencesSpec {
	t.Helper()
	out := preferences.PreferencesSpec{}
	resp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodGet,
		Path:   "/api/org/preferences",
	}, &out)
	require.Equal(t, http.StatusOK, resp.Response.StatusCode, "GET /api/org/preferences: %s", string(resp.Body))
	return *resp.Result
}

func putTeamPrefs(t *testing.T, helper *apis.K8sTestHelper, teamID int64, body string) int {
	t.Helper()
	resp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodPut,
		Path:   fmt.Sprintf("/api/teams/%d/preferences", teamID),
		Body:   []byte(body),
	}, &map[string]any{})
	return resp.Response.StatusCode
}

func getTeamPrefs(t *testing.T, helper *apis.K8sTestHelper, teamID int64) preferences.PreferencesSpec {
	t.Helper()
	out := preferences.PreferencesSpec{}
	resp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodGet,
		Path:   fmt.Sprintf("/api/teams/%d/preferences", teamID),
	}, &out)
	require.Equal(t, http.StatusOK, resp.Response.StatusCode, "GET /api/teams/%d/preferences: %s", teamID, string(resp.Body))
	return *resp.Result
}
