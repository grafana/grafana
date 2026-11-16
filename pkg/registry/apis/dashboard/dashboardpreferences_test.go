package dashboard

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/admission"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"

	authlib "github.com/grafana/authlib/types"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	dashsvc "github.com/grafana/grafana/pkg/services/dashboards/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func TestDashboardPreferencesScopeOf(t *testing.T) {
	const folderAnnotation = "dashboard preferences can't have the grafana.app/folder annotation"
	tests := []struct {
		name    string
		obj     *dashv2beta1.DashboardPreferences
		want    dashboardPreferencesScope
		wantErr string
	}{
		{name: "no name is org", obj: newDashboardPreferences(""), want: dashboardPreferencesScope{Tier: dashboardPreferencesTierOrg}},
		{name: "org name is org", obj: newDashboardPreferences("namespace"), want: dashboardPreferencesScope{Tier: dashboardPreferencesTierOrg}},
		{name: "folder name is folder", obj: newDashboardPreferences("folder-f1"), want: dashboardPreferencesScope{Tier: dashboardPreferencesTierFolder, FolderUID: "f1"}},
		{name: "user name is user", obj: newDashboardPreferences("user-u1"), want: dashboardPreferencesScope{Tier: dashboardPreferencesTierUser, UserUID: "u1"}},
		{name: "user name without a user", obj: newDashboardPreferences("user-"), wantErr: `metadata.name "user-" is not a dashboard preferences name`},
		{name: "a name that isn't a tier's", obj: newDashboardPreferences("foo"), wantErr: `metadata.name "foo" is not a dashboard preferences name`},
		{name: "folder annotation without a name", obj: withFolderAnnotation(newDashboardPreferences(""), "f1"), wantErr: folderAnnotation},
		{name: "folder annotation on the folder tier", obj: withFolderAnnotation(newDashboardPreferences("folder-f1"), "f1"), wantErr: folderAnnotation},
		{name: "folder annotation on the user tier", obj: withFolderAnnotation(newDashboardPreferences("user-u1"), "f1"), wantErr: folderAnnotation},
		{name: "general folder annotation", obj: withFolderAnnotation(newDashboardPreferences("namespace"), "general"), wantErr: folderAnnotation},
		{name: "nil object", obj: nil, wantErr: "payload is required"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := dashboardPreferencesScopeOf(tt.obj)
			if tt.wantErr != "" {
				require.ErrorContains(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.want, got)
		})
	}
}

func TestDashboardPreferencesScopeFromName(t *testing.T) {
	tests := []struct {
		name   string
		want   dashboardPreferencesScope
		wantOK bool
	}{
		{name: "namespace", want: dashboardPreferencesScope{Tier: dashboardPreferencesTierOrg}, wantOK: true},
		{name: "folder-abc", want: dashboardPreferencesScope{Tier: dashboardPreferencesTierFolder, FolderUID: "abc"}, wantOK: true},
		{name: "folder-a--b", want: dashboardPreferencesScope{Tier: dashboardPreferencesTierFolder, FolderUID: "a--b"}, wantOK: true},
		{name: "user-u1", want: dashboardPreferencesScope{Tier: dashboardPreferencesTierUser, UserUID: "u1"}, wantOK: true},
		{name: "user-u-1--2", want: dashboardPreferencesScope{Tier: dashboardPreferencesTierUser, UserUID: "u-1--2"}, wantOK: true},
		{name: "folder-"},
		{name: "folder-general"},
		{name: "folder-sharedwithme"},
		{name: "folder-a b"},
		{name: "user-"},
		{name: "user-a b"},
		{name: dashboardPreferencesMergedName},
		{name: "Namespace"},
		{name: "foo"},
		{name: ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := dashboardPreferencesScopeFromName(tt.name)
			require.Equal(t, tt.wantOK, ok)
			require.Equal(t, tt.want, got)
		})
	}

	// 253 is the longest name validation.IsValidGrafanaName accepts.
	t.Run("name length limit", func(t *testing.T) {
		folderUID := strings.Repeat("x", 253-len("folder-"))
		userUID := strings.Repeat("x", 253-len("user-"))
		for _, tt := range []struct {
			name string
			want dashboardPreferencesScope
		}{
			{name: "folder-" + folderUID, want: dashboardPreferencesScope{Tier: dashboardPreferencesTierFolder, FolderUID: folderUID}},
			{name: "user-" + userUID, want: dashboardPreferencesScope{Tier: dashboardPreferencesTierUser, UserUID: userUID}},
		} {
			got, ok := dashboardPreferencesScopeFromName(tt.name)
			require.True(t, ok)
			require.Equal(t, tt.want, got)

			got, ok = dashboardPreferencesScopeFromName(tt.name + "x")
			require.False(t, ok)
			require.Equal(t, dashboardPreferencesScope{}, got)
		}
	})

	// Other code builds tier names with the API package's helpers.
	t.Run("name prefixes match the API package name helpers", func(t *testing.T) {
		require.Equal(t, dashv2beta1.DashboardPreferencesFolderName("x"), dashboardPreferencesFolderNamePrefix+"x")
		require.Equal(t, dashv2beta1.DashboardPreferencesUserName("x"), dashboardPreferencesUserNamePrefix+"x")
	})
}

// Dashboards apply the value as the date math "now-" + nowDelay, so it is valid only if the frontend can apply it.
func TestIsValidDashboardPreferencesNowDelay(t *testing.T) {
	valid := []string{"1m", "5m", "30s", "1h", "1d", "1w", "1M", "1Q", "1y", "99999m"}
	invalid := []struct{ value, why string }{
		{"0", "no unit"},
		{"-0", "a sign"},
		{"0m", "valid date math, but it delays nothing"},
		{"-1m", "a sign"},
		{"+5m", "a sign"},
		{"1h30m", "two units"},
		{"1.5h", "a fraction"},
		{"100ms", "not a unit of date math"},
		{"1us", "not a unit of date math"},
		{"abc", "not date math"},
		{"1 m", "whitespace, which the frontend would strip"},
		{"1m\n", "a control character"},
		{"1m\x00abc", "a control character"},
		{"1b", "business days, which the frontend doesn't know"},
		{"1H", "capital H, which the frontend doesn't know"},
		{"100000m", "more digits than the frontend reads"},
		{"1h-30m", "compound date math"},
		{"1m+1h", "compound date math that ends the range after now"},
		{"m", "no amount"},
	}

	for _, value := range valid {
		t.Run(fmt.Sprintf("valid %q", value), func(t *testing.T) {
			require.True(t, isValidDashboardPreferencesNowDelay(value))
		})
	}
	for _, tt := range invalid {
		t.Run(fmt.Sprintf("invalid %q", tt.value), func(t *testing.T) {
			require.False(t, isValidDashboardPreferencesNowDelay(tt.value), tt.why)
		})
	}
}

func TestDashboardsAPIBuilderValidateDashboardPreferences(t *testing.T) {
	const repositoryManaged = "dashboard preferences can't be managed by a repository"
	const folderAnnotation = "dashboard preferences can't have the grafana.app/folder annotation"

	admin := dashboardPreferencesRequester(authlib.TypeUser, "admin", identity.RoleAdmin)
	// The access client in the loop makes every caller an admin of the folders f1 and missing.
	editor := dashboardPreferencesRequester(authlib.TypeUser, "editor", identity.RoleEditor)
	u1 := dashboardPreferencesRequester(authlib.TypeUser, "u1", identity.RoleViewer)
	// Grafana admins pass the namespace authorizer for every namespace.
	otherStackAdmin := dashboardPreferencesRequester(authlib.TypeUser, "admin", identity.RoleAdmin)
	otherStackAdmin.Namespace = "stacks-2"
	otherStackAdmin.IsGrafanaAdmin = true
	_, service := identity.WithServiceIdentity(context.Background(), 1)

	create := func(obj runtime.Object) admission.Attributes {
		return dashboardPreferencesAttributesForOp(admission.Create, obj, nil)
	}
	update := func(newObj, oldObj runtime.Object) admission.Attributes {
		return dashboardPreferencesAttributesForOp(admission.Update, newObj, oldObj)
	}
	dryRunCreate := func(obj *dashv2beta1.DashboardPreferences) admission.Attributes {
		return admission.NewAttributesRecord(
			obj,
			nil,
			dashv2beta1.DashboardPreferencesResourceInfo.GroupVersionKind(),
			"stacks-1",
			obj.GetName(),
			dashv2beta1.DashboardPreferencesResourceInfo.GroupVersionResource(),
			"",
			admission.Create,
			&metav1.CreateOptions{DryRun: []string{metav1.DryRunAll}},
			true,
			nil,
		)
	}
	u1Preferences := func() *dashv2beta1.DashboardPreferences {
		return newDashboardPreferences("user-u1")
	}
	withSpec := func(obj *dashv2beta1.DashboardPreferences, spec string) *dashv2beta1.DashboardPreferences {
		require.NoError(t, json.Unmarshal([]byte(spec), &obj.Spec))
		return obj
	}
	withAnnotations := func(obj *dashv2beta1.DashboardPreferences, annotations map[string]string) *dashv2beta1.DashboardPreferences {
		obj.SetAnnotations(annotations)
		return obj
	}
	isMissingFolder := func(err error) bool {
		var se *apierrors.StatusError
		return apierrors.IsNotFound(err) && errors.As(err, &se) && se.ErrStatus.Details != nil && se.ErrStatus.Details.Group == "folder.grafana.app"
	}
	// Not an API status, so the apiserver serves it as a 500.
	isPlainError := func(err error) bool {
		var status apierrors.APIStatus
		return err != nil && !errors.As(err, &status)
	}
	folderCheckErr := errors.New("folder check failed")

	tests := []struct {
		name      string
		attrs     admission.Attributes
		requester identity.Requester
		// Runs Mutate before Validate, as the admission chain does.
		mutate        bool
		folderMissing bool
		// Failed folder checks, by folder UID.
		checkErrs  map[string]error
		wantErr    func(error) bool
		wantErrMsg string
	}{
		{name: "org create by admin", attrs: create(newDashboardPreferences("namespace")), requester: admin},
		// The authorizer can't see the name of a POST, so admission has to authorize the name Mutate derives.
		{name: "org create by editor", attrs: create(newDashboardPreferences("")), mutate: true, requester: editor, wantErr: apierrors.IsForbidden, wantErrMsg: "only org admins can change org dashboard preferences"},
		{name: "user create for someone else", attrs: create(newDashboardPreferences("user-u2")), requester: u1, wantErr: apierrors.IsForbidden, wantErrMsg: "only the owner can access user dashboard preferences"},
		{name: "folder create by folder admin", attrs: create(newDashboardPreferences("folder-f1")), requester: editor},
		{name: "missing folder", attrs: create(newDashboardPreferences("folder-missing")), requester: editor, folderMissing: true, wantErr: isMissingFolder},
		{name: "missing folder in dry-run", attrs: dryRunCreate(newDashboardPreferences("folder-missing")), requester: editor, folderMissing: true},
		// Authorizing before the lookup keeps a caller without access from learning whether the folder exists.
		{name: "missing folder without folder admin", attrs: create(newDashboardPreferences("folder-nope")), requester: editor, folderMissing: true, wantErr: apierrors.IsForbidden, wantErrMsg: "only folder admins can change folder dashboard preferences"},
		// A check that failed must not pass for a denial.
		{name: "folder check failure", attrs: create(newDashboardPreferences("folder-f1")), requester: editor, checkErrs: map[string]error{"f1": folderCheckErr}, wantErr: func(err error) bool { return errors.Is(err, folderCheckErr) }},
		{name: "dry-run still applies the tier rules", attrs: dryRunCreate(newDashboardPreferences("namespace")), requester: editor, wantErr: apierrors.IsForbidden, wantErrMsg: "only org admins can change org dashboard preferences"},
		// The tier rules would deny it, so only skipping them lets this through.
		{name: "service identity skips the tier rules", attrs: create(u1Preferences()), requester: service},
		// Each would be allowed in the admin's own stack, so only judging the request's namespace denies it.
		{name: "org create from another stack", attrs: create(newDashboardPreferences("namespace")), requester: otherStackAdmin, wantErr: apierrors.IsForbidden, wantErrMsg: "only org members can access org dashboard preferences"},
		{name: "user create from another stack", attrs: create(newDashboardPreferences("user-admin")), requester: otherStackAdmin, wantErr: apierrors.IsForbidden, wantErrMsg: "only the owner can access user dashboard preferences"},
		{name: "folder create from another stack", attrs: create(newDashboardPreferences("folder-f1")), requester: otherStackAdmin, wantErr: apierrors.IsForbidden, wantErrMsg: "only folder admins can change folder dashboard preferences"},
		// Mutate rejects these first, but Validate must not rely on it.
		{name: "folder annotation on the folder tier", attrs: create(withFolderAnnotation(newDashboardPreferences("folder-f1"), "f1")), requester: editor, wantErr: apierrors.IsBadRequest, wantErrMsg: folderAnnotation},
		{name: "folder annotation without a name", attrs: create(withFolderAnnotation(newDashboardPreferences(""), "f1")), requester: admin, wantErr: apierrors.IsBadRequest, wantErrMsg: folderAnnotation},
		{name: "a name that isn't a tier's", attrs: create(newDashboardPreferences("foo")), requester: admin, wantErr: apierrors.IsBadRequest, wantErrMsg: `metadata.name "foo" is not a dashboard preferences name`},
		{name: "repository-managed", attrs: create(withAnnotations(u1Preferences(), map[string]string{utils.AnnoKeyManagerKind: "repo"})), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: repositoryManaged},
		{name: "repository manager identity", attrs: create(withAnnotations(u1Preferences(), map[string]string{utils.AnnoKeyManagerIdentity: "repo-1"})), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: repositoryManaged},
		{name: "legacy repository annotation", attrs: create(withAnnotations(u1Preferences(), map[string]string{"grafana.app/repoName": "repo-1"})), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: repositoryManaged},
		{name: "invalid spec", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"fiscalYearStartMonth":12}}`)), requester: u1, wantErr: apierrors.IsInvalid},
		// A PUT is denied before admission reads the payload, so a POST must not report on it either.
		{name: "invalid spec for a tier the caller can't write", attrs: create(withSpec(newDashboardPreferences("user-u2"), `{"dashboard":{"fiscalYearStartMonth":12}}`)), requester: u1, wantErr: apierrors.IsForbidden, wantErrMsg: "only the owner can access user dashboard preferences"},
		{name: "invalid value for a tier the caller can't write", attrs: create(withSpec(newDashboardPreferences("namespace"), `{"dashboard":{"autoGrid":{"rowHeight":49}}}`)), requester: editor, wantErr: apierrors.IsForbidden, wantErrMsg: "only org admins can change org dashboard preferences"},
		{name: "refresh below minimum", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"autoRefresh":"5s"}}`)), requester: u1, wantErr: apierrors.IsInvalid, wantErrMsg: `spec.dashboard.autoRefresh: Invalid value: "5s": Dashboard refresh interval is too low`},
		{name: "refresh off", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"autoRefresh":""}}`)), requester: u1},
		{name: "refresh auto", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"autoRefresh":"auto"}}`)), requester: u1},
		{name: "refresh intervals", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"autoRefreshIntervals":["10s","1m","1d"]}}`)), requester: u1},
		// JSON [] would be stored as no list at all and read back as inherit, so it must not get that far.
		{name: "empty refresh interval list", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"autoRefreshIntervals":[]}}`)), mutate: true, requester: u1, wantErr: apierrors.IsInvalid, wantErrMsg: "spec.dashboard.autoRefreshIntervals: Invalid value: []: must not be empty; send null to clear it"},
		{name: "refresh interval below minimum", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"autoRefreshIntervals":["1m","5s"]}}`)), requester: u1, wantErr: apierrors.IsInvalid, wantErrMsg: `spec.dashboard.autoRefreshIntervals.1: Invalid value: "5s": Dashboard refresh interval is too low`},
		{name: "refresh interval that isn't a duration", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"autoRefreshIntervals":["soon"]}}`)), requester: u1, wantErr: apierrors.IsInvalid, wantErrMsg: `spec.dashboard.autoRefreshIntervals.0: Invalid value: "soon": parsing refresh duration "soon" failed`},
		// The refresh check passes it as a dashboard's refresh value, but it is not an interval to list.
		{name: "auto refresh interval", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"autoRefreshIntervals":["1m","auto"]}}`)), requester: u1, wantErr: apierrors.IsInvalid, wantErrMsg: `spec.dashboard.autoRefreshIntervals.1: Invalid value: "auto": must be a duration such as 30s or 1m`},
		{name: "empty refresh interval", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"autoRefreshIntervals":[""]}}`)), requester: u1, wantErr: apierrors.IsInvalid},
		{name: "now delay", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"nowDelay":"30s"}}`)), requester: u1},
		{name: "now delay in days", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"nowDelay":"1d"}}`)), requester: u1},
		{name: "now delay that isn't a duration", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"nowDelay":"soon"}}`)), requester: u1, wantErr: apierrors.IsInvalid, wantErrMsg: `spec.dashboard.nowDelay: Invalid value: "soon": must be one amount and unit such as 30s or 1m`},
		// Dashboards apply it as "now-" + nowDelay.
		{name: "negative now delay", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"nowDelay":"-1m"}}`)), requester: u1, wantErr: apierrors.IsInvalid, wantErrMsg: `spec.dashboard.nowDelay: Invalid value: "-1m": must be one amount and unit such as 30s or 1m`},
		{name: "auto grid at the editor's minimums", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"autoGrid":{"maxColumnCount":1,"columnWidth":50,"rowHeight":50}}}`)), requester: u1},
		{name: "max column count below the editor's minimum", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"autoGrid":{"maxColumnCount":0}}}`)), requester: u1, wantErr: apierrors.IsInvalid, wantErrMsg: "spec.dashboard.autoGrid.maxColumnCount: Invalid value: 0: must be at least 1"},
		{name: "column width below the editor's minimum", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"autoGrid":{"columnWidth":49}}}`)), requester: u1, wantErr: apierrors.IsInvalid, wantErrMsg: "spec.dashboard.autoGrid.columnWidth: Invalid value: 49: must be at least 50"},
		{name: "row height below the editor's minimum", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"autoGrid":{"rowHeight":49}}}`)), requester: u1, wantErr: apierrors.IsInvalid, wantErrMsg: "spec.dashboard.autoGrid.rowHeight: Invalid value: 49: must be at least 50"},
		{name: "panel preferences", attrs: create(withSpec(u1Preferences(), `{"panels":{"legend":{"showLegend":true}}}`)), requester: u1, wantErr: apierrors.IsInvalid, wantErrMsg: "spec.panels: Forbidden: panel preferences are not supported yet"},
		// A merge-patch that nulls the last panel value leaves the groups, which Mutate drops.
		{name: "panels with no value set", attrs: create(withSpec(u1Preferences(), `{"panels":{"graph":{}}}`)), mutate: true, requester: u1},
		{name: "reset", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"preload":true},"reset":["dashboard.nowDelay","dashboard.autoGrid.rowHeight"]}`)), requester: u1},
		{name: "reset listed twice", attrs: create(withSpec(u1Preferences(), `{"reset":["dashboard.nowDelay","dashboard.nowDelay"]}`)), requester: u1, wantErr: apierrors.IsInvalid},
		{name: "reset of a set field", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"nowDelay":"1m"},"reset":["dashboard.nowDelay"]}`)), requester: u1, wantErr: apierrors.IsInvalid},
		// Like spec.panels, a panel reset would be stored and ignored.
		{name: "panel reset", attrs: create(withSpec(u1Preferences(), `{"reset":["dashboard.nowDelay","panels.legend.placement"]}`)), requester: u1, wantErr: apierrors.IsInvalid, wantErrMsg: "spec.reset.1: Forbidden: panel preferences are not supported yet"},
		{name: "wrong type", attrs: create(&dashv2beta1.Notebook{}), requester: u1, wantErr: isPlainError, wantErrMsg: "unsupported dashboard preferences version"},

		{name: "folder tier update", attrs: update(newDashboardPreferences("folder-f1"), newDashboardPreferences("folder-f1")), requester: editor},
		{name: "update adding a folder annotation to the folder tier", attrs: update(withFolderAnnotation(newDashboardPreferences("folder-f1"), "f1"), newDashboardPreferences("folder-f1")), requester: editor, wantErr: apierrors.IsBadRequest, wantErrMsg: folderAnnotation},
		{name: "update adding a folder annotation to the org tier", attrs: update(withFolderAnnotation(newDashboardPreferences("namespace"), "f1"), newDashboardPreferences("namespace")), requester: admin, wantErr: apierrors.IsBadRequest, wantErrMsg: folderAnnotation},
		// Storage refuses any folder annotation for this resource, the root's general included.
		{name: "update adding the general folder annotation", attrs: update(withFolderAnnotation(u1Preferences(), "general"), u1Preferences()), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: folderAnnotation},
		{name: "repository-managed update", attrs: update(withAnnotations(u1Preferences(), map[string]string{utils.AnnoKeyManagerKind: "repo"}), u1Preferences()), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: repositoryManaged},
		{name: "legacy repository annotation on update", attrs: update(withAnnotations(u1Preferences(), map[string]string{"grafana.app/repoName": "repo-1"}), u1Preferences()), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: repositoryManaged},
		// Nothing stored has such a name, so only the scope check rejects it.
		{name: "update of a name that isn't a tier's", attrs: update(newDashboardPreferences("foo"), newDashboardPreferences("foo")), requester: admin, wantErr: apierrors.IsBadRequest, wantErrMsg: `metadata.name "foo" is not a dashboard preferences name`},
		{name: "update with invalid spec", attrs: update(withSpec(u1Preferences(), `{"dashboard":{"fiscalYearStartMonth":12}}`), u1Preferences()), requester: u1, wantErr: apierrors.IsInvalid},
		{name: "update with refresh below minimum", attrs: update(withSpec(u1Preferences(), `{"dashboard":{"autoRefresh":"5s"}}`), u1Preferences()), requester: u1, wantErr: apierrors.IsInvalid, wantErrMsg: `spec.dashboard.autoRefresh: Invalid value: "5s": Dashboard refresh interval is too low`},
		{name: "update changing the refresh to below minimum", attrs: update(withSpec(u1Preferences(), `{"dashboard":{"autoRefresh":"5s"}}`), withSpec(u1Preferences(), `{"dashboard":{"autoRefresh":"1m"}}`)), requester: u1, wantErr: apierrors.IsInvalid, wantErrMsg: `spec.dashboard.autoRefresh: Invalid value: "5s": Dashboard refresh interval is too low`},
		{name: "update changing refresh intervals to below minimum", attrs: update(withSpec(u1Preferences(), `{"dashboard":{"autoRefreshIntervals":["5s","1m"]}}`), withSpec(u1Preferences(), `{"dashboard":{"autoRefreshIntervals":["1m"]}}`)), requester: u1, wantErr: apierrors.IsInvalid, wantErrMsg: `spec.dashboard.autoRefreshIntervals.0: Invalid value: "5s": Dashboard refresh interval is too low`},
		// Saved before min_refresh_interval was raised to 10s: an edit of another field must still go through.
		{name: "update keeping a refresh below minimum", attrs: update(withSpec(u1Preferences(), `{"dashboard":{"autoRefresh":"5s","preload":true}}`), withSpec(u1Preferences(), `{"dashboard":{"autoRefresh":"5s"}}`)), requester: u1},
		{name: "update keeping refresh intervals below minimum", attrs: update(withSpec(u1Preferences(), `{"dashboard":{"autoRefreshIntervals":["5s"],"preload":true}}`), withSpec(u1Preferences(), `{"dashboard":{"autoRefreshIntervals":["5s"]}}`)), requester: u1},
		// Only an entry the stored list didn't have is new, so adding or reordering doesn't judge the rest.
		{name: "update adding an interval next to one below minimum", attrs: update(withSpec(u1Preferences(), `{"dashboard":{"autoRefreshIntervals":["5s","1m","1h"]}}`), withSpec(u1Preferences(), `{"dashboard":{"autoRefreshIntervals":["5s","1m"]}}`)), requester: u1},
		{name: "update reordering intervals below minimum", attrs: update(withSpec(u1Preferences(), `{"dashboard":{"autoRefreshIntervals":["1m","5s"]}}`), withSpec(u1Preferences(), `{"dashboard":{"autoRefreshIntervals":["5s","1m"]}}`)), requester: u1},
		{name: "update adding an interval below minimum", attrs: update(withSpec(u1Preferences(), `{"dashboard":{"autoRefreshIntervals":["1m","5s"]}}`), withSpec(u1Preferences(), `{"dashboard":{"autoRefreshIntervals":["1m"]}}`)), requester: u1, wantErr: apierrors.IsInvalid, wantErrMsg: `spec.dashboard.autoRefreshIntervals.1: Invalid value: "5s": Dashboard refresh interval is too low`},
		// An empty list and no list compare equal, so this check can't depend on a change.
		{name: "update with an empty refresh interval list", attrs: update(withSpec(u1Preferences(), `{"dashboard":{"autoRefreshIntervals":[]}}`), u1Preferences()), requester: u1, wantErr: apierrors.IsInvalid, wantErrMsg: "spec.dashboard.autoRefreshIntervals: Invalid value: []: must not be empty; send null to clear it"},
		{name: "update with a negative now delay", attrs: update(withSpec(u1Preferences(), `{"dashboard":{"nowDelay":"-1m"}}`), u1Preferences()), requester: u1, wantErr: apierrors.IsInvalid, wantErrMsg: `spec.dashboard.nowDelay: Invalid value: "-1m"`},
		{name: "update with a row height below the editor's minimum", attrs: update(withSpec(u1Preferences(), `{"dashboard":{"autoGrid":{"rowHeight":49}}}`), u1Preferences()), requester: u1, wantErr: apierrors.IsInvalid, wantErrMsg: "spec.dashboard.autoGrid.rowHeight: Invalid value: 49: must be at least 50"},
		{name: "update with panel preferences", attrs: update(withSpec(u1Preferences(), `{"panels":{"legend":{"showLegend":true}}}`), u1Preferences()), requester: u1, wantErr: apierrors.IsInvalid, wantErrMsg: "spec.panels: Forbidden: panel preferences are not supported yet"},
		{name: "update with a panel reset", attrs: update(withSpec(u1Preferences(), `{"reset":["panels.field.decimals"]}`), u1Preferences()), requester: u1, wantErr: apierrors.IsInvalid, wantErrMsg: "spec.reset.0: Forbidden: panel preferences are not supported yet"},
		// A merge-patch that sets a reset field keeps the stored list, so the set and the reset meet here.
		{name: "update setting a reset field", attrs: update(withSpec(u1Preferences(), `{"dashboard":{"nowDelay":"1m"},"reset":["dashboard.nowDelay"]}`), withSpec(u1Preferences(), `{"reset":["dashboard.nowDelay"]}`)), requester: u1, wantErr: apierrors.IsInvalid},
		{name: "update without an old object", attrs: update(u1Preferences(), nil), requester: u1, wantErr: isPlainError, wantErrMsg: "old dashboard preferences"},

		{name: "delete", attrs: dashboardPreferencesAttributesForOp(admission.Delete, nil, u1Preferences()), requester: u1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			builder := &DashboardsAPIBuilder{
				dashboardService:   &dashsvc.DashboardServiceImpl{},
				minRefreshInterval: "10s",
				accessClient: &dashboardPreferencesAccessClient{
					grants: map[string][]string{
						"f1":      {utils.VerbSetPermissions},
						"missing": {utils.VerbSetPermissions},
					},
					checkErrs: tt.checkErrs,
				},
				folderClientProvider: &staticHandlerProvider{handler: &variableFolderAccessHandler{notFoundAccessSubresource: tt.folderMissing}},
			}
			ctx := identity.WithRequester(k8srequest.WithNamespace(context.Background(), "stacks-1"), tt.requester)
			if tt.mutate {
				require.NoError(t, builder.Mutate(ctx, tt.attrs, nil))
			}

			err := builder.Validate(ctx, tt.attrs, nil)

			if tt.wantErr == nil {
				require.NoError(t, err)
				return
			}
			require.True(t, tt.wantErr(err), "unexpected error: %v", err)
			if tt.wantErrMsg != "" {
				require.ErrorContains(t, err, tt.wantErrMsg)
			}
		})
	}
}

// A POST reaches the authorizer without a name, so admission must check the org tier's permission too.
func TestDashboardsAPIBuilderValidateDashboardPreferencesCreateTakesTheOrgPreferencesPermission(t *testing.T) {
	builder := &DashboardsAPIBuilder{
		dashboardService: &dashsvc.DashboardServiceImpl{},
		accessControl:    acimpl.ProvideAccessControl(featuremgmt.WithFeatures()),
	}
	tests := []struct {
		name      string
		requester identity.Requester
		wantErr   string
	}{
		{name: "an editor with the permission", requester: dashboardPreferencesRequesterWith(authlib.TypeUser, identity.RoleEditor, "orgs.preferences:write")},
		{name: "an admin without the permission", requester: dashboardPreferencesRequesterWith(authlib.TypeUser, identity.RoleAdmin), wantErr: "only org admins can change org dashboard preferences"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := identity.WithRequester(k8srequest.WithNamespace(context.Background(), "stacks-1"), tt.requester)
			attrs := dashboardPreferencesAttributesForOp(admission.Create, newDashboardPreferences(""), nil)
			require.NoError(t, builder.Mutate(ctx, attrs, nil))

			err := builder.Validate(ctx, attrs, nil)

			if tt.wantErr == "" {
				require.NoError(t, err)
				return
			}
			require.True(t, apierrors.IsForbidden(err), "expected Forbidden, got %v", err)
			require.ErrorContains(t, err, tt.wantErr)
		})
	}
}

// The builder's minimum is 10s, so only the stack's own minimum from the settings service can decide these.
func TestDashboardsAPIBuilderValidateDashboardPreferencesUsesTheStackMinRefreshInterval(t *testing.T) {
	u1 := dashboardPreferencesRequester(authlib.TypeUser, "u1", identity.RoleViewer)
	withSpec := func(spec string) *dashv2beta1.DashboardPreferences {
		obj := newDashboardPreferences("user-u1")
		require.NoError(t, json.Unmarshal([]byte(spec), &obj.Spec))
		return obj
	}

	tests := []struct {
		name       string
		attrs      admission.Attributes
		floor      string
		wantErrMsg string
		// The settings service is read at most once per write, and only for a value the minimum applies to.
		wantLookups int
	}{
		{name: "refresh below the stack's minimum", attrs: dashboardPreferencesAttributesForOp(admission.Create, withSpec(`{"dashboard":{"autoRefresh":"30s"}}`), nil), floor: "1m", wantErrMsg: `spec.dashboard.autoRefresh: Invalid value: "30s": Dashboard refresh interval is too low`, wantLookups: 1},
		{name: "refresh above the stack's minimum", attrs: dashboardPreferencesAttributesForOp(admission.Create, withSpec(`{"dashboard":{"autoRefresh":"5s"}}`), nil), floor: "1s", wantLookups: 1},
		{name: "refresh interval below the stack's minimum", attrs: dashboardPreferencesAttributesForOp(admission.Create, withSpec(`{"dashboard":{"autoRefreshIntervals":["5m","30s"]}}`), nil), floor: "1m", wantErrMsg: `spec.dashboard.autoRefreshIntervals.1: Invalid value: "30s": Dashboard refresh interval is too low`, wantLookups: 1},
		{name: "refresh and intervals read the minimum once", attrs: dashboardPreferencesAttributesForOp(admission.Create, withSpec(`{"dashboard":{"autoRefresh":"5s","autoRefreshIntervals":["5s","10s","1m"]}}`), nil), floor: "1s", wantLookups: 1},
		{name: "refresh off", attrs: dashboardPreferencesAttributesForOp(admission.Create, withSpec(`{"dashboard":{"autoRefresh":""}}`), nil), floor: "1m"},
		{name: "refresh auto", attrs: dashboardPreferencesAttributesForOp(admission.Create, withSpec(`{"dashboard":{"autoRefresh":"auto"}}`), nil), floor: "1m"},
		{name: "update keeping a refresh below the stack's minimum", attrs: dashboardPreferencesAttributesForOp(admission.Update, withSpec(`{"dashboard":{"autoRefresh":"30s","preload":true}}`), withSpec(`{"dashboard":{"autoRefresh":"30s"}}`)), floor: "1m"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			settings := &fakeSettingService{settings: minRefreshIntervalSetting(tt.floor)}
			builder := &DashboardsAPIBuilder{
				dashboardService:   &dashsvc.DashboardServiceImpl{},
				minRefreshInterval: "10s",
				settingService:     settings,
				accessClient:       &dashboardPreferencesAccessClient{},
			}
			ctx := identity.WithRequester(k8srequest.WithNamespace(context.Background(), "stacks-1"), u1)

			err := builder.Validate(ctx, tt.attrs, nil)

			if tt.wantErrMsg == "" {
				require.NoError(t, err)
			} else {
				require.True(t, apierrors.IsInvalid(err), "unexpected error: %v", err)
				require.ErrorContains(t, err, tt.wantErrMsg)
			}
			require.Equal(t, tt.wantLookups, settings.calls)
			if tt.wantLookups > 0 {
				require.Equal(t, "stacks-1", settings.namespace)
			}
		})
	}
}

// With no minimum set, the minimum check accepts any value without parsing it.
func TestDashboardsAPIBuilderValidateDashboardPreferencesParsesRefreshWithoutAMinimum(t *testing.T) {
	u1 := dashboardPreferencesRequester(authlib.TypeUser, "u1", identity.RoleViewer)
	builder := &DashboardsAPIBuilder{
		dashboardService: &dashsvc.DashboardServiceImpl{},
		accessClient:     &dashboardPreferencesAccessClient{},
	}
	ctx := identity.WithRequester(k8srequest.WithNamespace(context.Background(), "stacks-1"), u1)

	tests := []struct{ name, spec, wantErrMsg string }{
		{name: "refresh that isn't a duration", spec: `{"dashboard":{"autoRefresh":"soon"}}`, wantErrMsg: `spec.dashboard.autoRefresh: Invalid value: "soon": parsing refresh duration "soon" failed`},
		{name: "refresh interval that isn't a duration", spec: `{"dashboard":{"autoRefreshIntervals":["1m","soon"]}}`, wantErrMsg: `spec.dashboard.autoRefreshIntervals.1: Invalid value: "soon": parsing refresh duration "soon" failed`},
		{name: "any duration", spec: `{"dashboard":{"autoRefresh":"1s","autoRefreshIntervals":["1s","1d"]}}`},
		// Dashboards accept the same values.
		{name: "compound duration", spec: `{"dashboard":{"autoRefresh":"1h30m"}}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			obj := newDashboardPreferences("user-u1")
			require.NoError(t, json.Unmarshal([]byte(tt.spec), &obj.Spec))

			err := builder.Validate(ctx, dashboardPreferencesAttributesForOp(admission.Create, obj, nil), nil)

			if tt.wantErrMsg == "" {
				require.NoError(t, err)
				return
			}
			require.True(t, apierrors.IsInvalid(err), "unexpected error: %v", err)
			require.ErrorContains(t, err, tt.wantErrMsg)
		})
	}
}

// The value checks join the schema's 422, so one response names every problem.
func TestDashboardsAPIBuilderValidateDashboardPreferencesReportsEveryProblem(t *testing.T) {
	u1 := dashboardPreferencesRequester(authlib.TypeUser, "u1", identity.RoleViewer)
	builder := &DashboardsAPIBuilder{
		dashboardService:   &dashsvc.DashboardServiceImpl{},
		minRefreshInterval: "10s",
		accessClient:       &dashboardPreferencesAccessClient{},
	}
	ctx := identity.WithRequester(k8srequest.WithNamespace(context.Background(), "stacks-1"), u1)

	tests := []struct {
		name, spec string
		wantCauses []string
	}{
		{
			name:       "schema, reset and value problems",
			spec:       `{"dashboard":{"fiscalYearStartMonth":12,"autoRefresh":"5s","nowDelay":"soon","autoGrid":{"columnWidth":49,"rowHeight":49}},"panels":{"frame":{"transparent":true}},"reset":["dashboard.preload","dashboard.preload"]}`,
			wantCauses: []string{"spec.dashboard.fiscalYearStartMonth", "spec.reset.1", "spec.dashboard.autoRefresh", "spec.dashboard.nowDelay", "spec.dashboard.autoGrid.columnWidth", "spec.dashboard.autoGrid.rowHeight", "spec.panels"},
		},
		// The schema already rejects an empty value, and a second cause would restate the field.
		{name: "a field the schema rejected", spec: `{"dashboard":{"nowDelay":""}}`, wantCauses: []string{"spec.dashboard.nowDelay"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			obj := newDashboardPreferences("user-u1")
			require.NoError(t, json.Unmarshal([]byte(tt.spec), &obj.Spec))

			err := builder.Validate(ctx, dashboardPreferencesAttributesForOp(admission.Create, obj, nil), nil)

			require.True(t, apierrors.IsInvalid(err), "unexpected error: %v", err)
			var status apierrors.APIStatus
			require.True(t, errors.As(err, &status))
			details := status.Status().Details
			require.NotNil(t, details)
			causes := make([]string, 0, len(details.Causes))
			for _, cause := range details.Causes {
				causes = append(causes, cause.Field)
			}
			require.Equal(t, tt.wantCauses, causes)
		})
	}
}
