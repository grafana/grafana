package preferences

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/client-go/rest"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"

	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationPreferences_K8sAPIs(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false,
		DisableAnonymous:  true,
		EnableFeatureToggles: append([]string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
		}),
	})

	t.Run("user preferences round-trip", func(t *testing.T) {
		adminUser := "user-" + helper.Org1.Admin.Identity.GetIdentifier()
		putResult := putUserPrefsK8s(t, helper, helper.Org1.Admin, adminUser, fmt.Sprintf(`{"metadata": {"name": "%s"}, "spec": {"theme":"dark","weekStart":"monday","timezone":"Europe/London"}}`, adminUser))
		require.NoError(t, putResult.Error())
		// require.Equal(t, http.StatusOK, putResult)

		got := getUserPrefsK8s(t, helper, helper.Org1.Admin, adminUser)
		require.NotNil(t, got.Spec.Theme)
		require.Equal(t, "dark", *got.Spec.Theme)
		require.NotNil(t, got.Spec.WeekStart)
		require.Equal(t, "monday", *got.Spec.WeekStart)
		require.NotNil(t, got.Spec.Timezone)
		require.Equal(t, "Europe/London", *got.Spec.Timezone)
	})

	t.Run("team preferences write", func(t *testing.T) {
		teamID := helper.Org1.Staff.ID
		putResult := putTeamPrefsK8s(t, helper, teamID, `{"theme":"light","weekStart":"sunday"}`)
		require.Equal(t, http.StatusOK, putResult)
	})

	// Teams permissions are not yet available yet due to https://github.com/grafana/grafana/pull/123657
	// Should be un-skipped once groups are reworked
	// TODO this might fail
	t.Run("team preferences read", func(t *testing.T) {
		teamID := helper.Org1.Staff.ID
		putResult := putTeamPrefsK8s(t, helper, teamID, `{"theme":"light","weekStart":"sunday"}`)
		require.Equal(t, http.StatusOK, putResult)

		got := getTeamPrefsK8s(t, helper, teamID)
		require.NotNil(t, got.Theme)
		require.Equal(t, "light", *got.Theme)
		require.NotNil(t, got.WeekStart)
		require.Equal(t, "sunday", *got.WeekStart)
	})

	t.Run("org preferences round-trip", func(t *testing.T) {
		putResult := putOrgPrefsK8s(t, helper, `{"theme":"dark","timezone":"UTC"}`)
		require.Equal(t, http.StatusOK, putResult)

		got := getOrgPrefsK8s(t, helper)
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

		patchResult := patchUserPrefsK8s(t, helper, editor, `{"theme":"dark"}`)
		require.Equal(t, http.StatusOK, patchResult, "PATCH on missing should upsert")

		editorName := "user-" + editor.Identity.GetIdentifier()
		got := getUserPrefsK8s(t, helper, editor, editorName)
		require.NotNil(t, got.Spec.Theme)
		require.Equal(t, "dark", *got.Spec.Theme)
	})

	t.Run("PUT replaces, PATCH merges", func(t *testing.T) {
		// Seed full prefs for the org, then PATCH only one field — others must remain.
		putResult := putOrgPrefsK8s(t, helper,
			`{"theme":"dark","weekStart":"monday","timezone":"UTC"}`)
		require.Equal(t, http.StatusOK, putResult)

		patchResult := patchOrgPrefsK8s(t, helper, `{"theme":"light"}`)
		require.Equal(t, http.StatusOK, patchResult)
		merged := getOrgPrefsK8s(t, helper)
		require.NotNil(t, merged.Theme)
		require.Equal(t, "light", *merged.Theme, "PATCH must update theme")
		require.NotNil(t, merged.WeekStart)
		require.Equal(t, "monday", *merged.WeekStart, "PATCH must leave weekStart untouched (merge semantics)")
		require.NotNil(t, merged.Timezone)
		require.Equal(t, "UTC", *merged.Timezone, "PATCH must leave timezone untouched")

		// PUT now with a sparse body — fields the request omits should clear.
		require.Equal(t, http.StatusOK, putOrgPrefsK8s(t, helper, `{"theme":"dark"}`))
		replaced := getOrgPrefsK8s(t, helper)
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
}

func putUserPrefsK8s(t *testing.T, helper *apis.K8sTestHelper, user apis.User, name string, body string) rest.Result {
	t.Helper()
	ctx := context.Background()
	client := user.RESTClient(t, &preferences.GroupVersion)
	resp := client.Put().AbsPath("apis", "preferences.grafana.app", "v1alpha1",
		"namespaces", "default",
		"preferences", name).Body([]byte(body)).Do(ctx)

	return resp
}

func patchUserPrefsK8s(t *testing.T, helper *apis.K8sTestHelper, user apis.User, body string) int {
	t.Helper()
	resp := apis.DoRequest(helper, apis.RequestParams{
		User:   user,
		Method: http.MethodPatch,
		Path:   "/api/user/preferences",
		Body:   []byte(body),
	}, &map[string]any{})
	return resp.Response.StatusCode
}

func getUserPrefsK8s(t *testing.T, helper *apis.K8sTestHelper, user apis.User, name string) *preferences.Preferences {
	t.Helper()
	ctx := context.Background()
	client := user.RESTClient(t, &preferences.GroupVersion)
	resp := client.Get().AbsPath("apis", "preferences.grafana.app", "v1alpha1",
		"namespaces", "default",
		"preferences", name).Do(ctx)

	raw, err := resp.Raw()
	require.NoError(t, err, "GET preferences/%s: %s", name, string(raw))

	out := &preferences.Preferences{}
	require.NoError(t, json.Unmarshal(raw, out))
	return out
}

func putOrgPrefsK8s(t *testing.T, helper *apis.K8sTestHelper, body string) int {
	t.Helper()
	resp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodPut,
		Path:   "/api/org/preferences",
		Body:   []byte(body),
	}, &map[string]any{})
	return resp.Response.StatusCode
}

func patchOrgPrefsK8s(t *testing.T, helper *apis.K8sTestHelper, body string) int {
	t.Helper()
	resp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodPatch,
		Path:   "/api/org/preferences",
		Body:   []byte(body),
	}, &map[string]any{})
	return resp.Response.StatusCode
}

func getOrgPrefsK8s(t *testing.T, helper *apis.K8sTestHelper) preferences.PreferencesSpec {
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

func putTeamPrefsK8s(t *testing.T, helper *apis.K8sTestHelper, teamID int64, body string) int {
	t.Helper()
	resp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodPut,
		Path:   fmt.Sprintf("/api/teams/%d/preferences", teamID),
		Body:   []byte(body),
	}, &map[string]any{})
	return resp.Response.StatusCode
}

func getTeamPrefsK8s(t *testing.T, helper *apis.K8sTestHelper, teamID int64) preferences.PreferencesSpec {
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
