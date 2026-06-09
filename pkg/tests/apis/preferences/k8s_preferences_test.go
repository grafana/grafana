package preferences

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/types"
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
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
		},
	})

	t.Run("user preferences round-trip", func(t *testing.T) {
		adminUser := "user-" + helper.Org1.Admin.Identity.GetIdentifier()
		putResult := putUserPrefsK8s(t, helper, helper.Org1.Admin, adminUser, fmt.Sprintf(`{"metadata": {"name": "%s"}, "spec": {"theme":"dark","weekStart":"monday","timezone":"Europe/London"}}`, adminUser))
		require.NoError(t, putResult.Error())

		got := getUserPrefsK8s(t, helper, helper.Org1.Admin, adminUser)
		require.NotNil(t, got.Spec.Theme)
		require.Equal(t, "dark", *got.Spec.Theme)
		require.NotNil(t, got.Spec.WeekStart)
		require.Equal(t, "monday", *got.Spec.WeekStart)
		require.NotNil(t, got.Spec.Timezone)
		require.Equal(t, "Europe/London", *got.Spec.Timezone)
	})

	t.Run("team preferences write", func(t *testing.T) {
		teamUID := helper.Org1.Staff.UID
		putResult := putTeamPrefsK8s(t, helper, teamUID, fmt.Sprintf(`{"metadata": {"name": "team-%s"}, "spec": {"theme":"light","weekStart":"sunday"}}`, teamUID))
		require.NoError(t, putResult.Error())
	})

	t.Run("team preferences read", func(t *testing.T) {
		teamUID := helper.Org1.Staff.UID
		putResult := putTeamPrefsK8s(t, helper, teamUID, fmt.Sprintf(`{"metadata": {"name": "team-%s"}, "spec": {"theme":"light","weekStart":"sunday"}}`, teamUID))
		require.NoError(t, putResult.Error())

		got := getTeamPrefsK8s(t, helper, teamUID)
		require.NotNil(t, got.Spec.Theme)
		require.Equal(t, "light", *got.Spec.Theme)
		require.NotNil(t, got.Spec.WeekStart)
		require.Equal(t, "sunday", *got.Spec.WeekStart)
	})

	t.Run("org preferences round-trip", func(t *testing.T) {
		putResult := putOrgPrefsK8s(t, helper, `{"metadata": {"name": "namespace"}, "spec": {"theme":"dark","timezone":"UTC"}}`)
		require.NoError(t, putResult.Error())

		got := getOrgPrefsK8s(t, helper)
		require.NotNil(t, got.Spec.Theme)
		require.Equal(t, "dark", *got.Spec.Theme)
		require.NotNil(t, got.Spec.Timezone)
		require.Equal(t, "UTC", *got.Spec.Timezone)
	})

	t.Run("PATCH on missing upserts", func(t *testing.T) {
		// Use the Editor user — no other subtest writes preferences for them, so
		// the PATCH below is genuinely against a non-existent record. Both the
		// legacy pref.Service and the K8s bridge must upsert here.
		editor := helper.Org1.Editor

		patchResult := patchUserPrefsK8s(t, helper, editor, `{"spec": {"theme":"dark"}}`)
		require.NoError(t, patchResult.Error(), "PATCH on missing should upsert")

		editorName := "user-" + editor.Identity.GetIdentifier()
		got := getUserPrefsK8s(t, helper, editor, editorName)
		require.NotNil(t, got.Spec.Theme)
		require.Equal(t, "dark", *got.Spec.Theme)
	})

	t.Run("PUT replaces, PATCH merges", func(t *testing.T) {
		// Seed full prefs for the org, then PATCH only one field — others must remain.
		putResult := putOrgPrefsK8s(t, helper,
			`{"metadata": {"name": "namespace"}, "spec": {"theme":"dark","weekStart":"monday","timezone":"UTC"}}`)
		require.NoError(t, putResult.Error())

		patchResult := patchOrgPrefsK8s(t, helper, `{"spec": {"theme":"light"}}`)
		require.NoError(t, patchResult.Error())
		merged := getOrgPrefsK8s(t, helper)
		require.NotNil(t, merged.Spec.Theme)
		require.Equal(t, "light", *merged.Spec.Theme, "PATCH must update theme")
		require.NotNil(t, merged.Spec.WeekStart)
		require.Equal(t, "monday", *merged.Spec.WeekStart, "PATCH must leave weekStart untouched (merge semantics)")
		require.NotNil(t, merged.Spec.Timezone)
		require.Equal(t, "UTC", *merged.Spec.Timezone, "PATCH must leave timezone untouched")

		// PUT now with a sparse body — fields the request omits should clear.
		require.NoError(t, putOrgPrefsK8s(t, helper, `{"metadata": {"name": "namespace"}, "spec": {"theme":"dark"}}`).Error())
		replaced := getOrgPrefsK8s(t, helper)
		require.NotNil(t, replaced.Spec.Theme)
		require.Equal(t, "dark", *replaced.Spec.Theme)
		// weekStart/timezone must no longer carry the previous values.
		if replaced.Spec.WeekStart != nil {
			require.Equal(t, "", *replaced.Spec.WeekStart, "PUT must clear weekStart it omitted")
		}
		if replaced.Spec.Timezone != nil {
			require.Equal(t, "", *replaced.Spec.Timezone, "PUT must clear timezone it omitted")
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

func patchUserPrefsK8s(t *testing.T, _ *apis.K8sTestHelper, user apis.User, body string) rest.Result {
	t.Helper()
	ctx := context.Background()
	name := "user-" + user.Identity.GetIdentifier()
	client := user.RESTClient(t, &preferences.GroupVersion)
	return client.Patch(types.MergePatchType).AbsPath("apis", "preferences.grafana.app", "v1alpha1",
		"namespaces", "default",
		"preferences", name).Body([]byte(body)).Do(ctx)
}

func getUserPrefsK8s(t *testing.T, _ *apis.K8sTestHelper, user apis.User, name string) *preferences.Preferences {
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

func putOrgPrefsK8s(t *testing.T, helper *apis.K8sTestHelper, body string) rest.Result {
	t.Helper()
	ctx := context.Background()
	client := helper.Org1.Admin.RESTClient(t, &preferences.GroupVersion)
	return client.Put().AbsPath("apis", "preferences.grafana.app", "v1alpha1",
		"namespaces", "default",
		"preferences", "namespace").Body([]byte(body)).Do(ctx)
}

func patchOrgPrefsK8s(t *testing.T, helper *apis.K8sTestHelper, body string) rest.Result {
	t.Helper()
	ctx := context.Background()
	client := helper.Org1.Admin.RESTClient(t, &preferences.GroupVersion)
	return client.Patch(types.MergePatchType).AbsPath("apis", "preferences.grafana.app", "v1alpha1",
		"namespaces", "default",
		"preferences", "namespace").Body([]byte(body)).Do(ctx)
}

func getOrgPrefsK8s(t *testing.T, helper *apis.K8sTestHelper) *preferences.Preferences {
	t.Helper()
	ctx := context.Background()
	client := helper.Org1.Admin.RESTClient(t, &preferences.GroupVersion)
	resp := client.Get().AbsPath("apis", "preferences.grafana.app", "v1alpha1",
		"namespaces", "default",
		"preferences", "namespace").Do(ctx)
	raw, err := resp.Raw()
	require.NoError(t, err, "GET preferences/namespace: %s", string(raw))
	out := &preferences.Preferences{}
	require.NoError(t, json.Unmarshal(raw, out))
	return out
}

func putTeamPrefsK8s(t *testing.T, helper *apis.K8sTestHelper, teamUID string, body string) rest.Result {
	t.Helper()
	ctx := context.Background()
	client := helper.Org1.Admin.RESTClient(t, &preferences.GroupVersion)
	return client.Put().AbsPath("apis", "preferences.grafana.app", "v1alpha1",
		"namespaces", "default",
		"preferences", "team-"+teamUID).Body([]byte(body)).Do(ctx)
}

func getTeamPrefsK8s(t *testing.T, helper *apis.K8sTestHelper, teamUID string) *preferences.Preferences {
	t.Helper()
	ctx := context.Background()
	client := helper.Org1.Admin.RESTClient(t, &preferences.GroupVersion)
	resp := client.Get().AbsPath("apis", "preferences.grafana.app", "v1alpha1",
		"namespaces", "default",
		"preferences", "team-"+teamUID).Do(ctx)
	raw, err := resp.Raw()
	require.NoError(t, err, "GET preferences/team-%s: %s", teamUID, string(raw))
	out := &preferences.Preferences{}
	require.NoError(t, json.Unmarshal(raw, out))
	return out
}
