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
	dashsvc "github.com/grafana/grafana/pkg/services/dashboards/service"
)

func TestGetDashboardPreferencesScope(t *testing.T) {
	tests := []struct {
		name, folder string
		user         *string
		want         dashboardPreferencesScope
		wantErr      string
	}{
		{name: "no scope is org", want: dashboardPreferencesScope{Tier: dashboardPreferencesTierOrg}},
		{name: "general folder is org", folder: "general", want: dashboardPreferencesScope{Tier: dashboardPreferencesTierOrg}},
		{name: "folder", folder: "f1", want: dashboardPreferencesScope{Tier: dashboardPreferencesTierFolder, FolderUID: "f1"}},
		{name: "user", user: new("u1"), want: dashboardPreferencesScope{Tier: dashboardPreferencesTierUser, UserUID: "u1"}},
		{name: "user with general annotation stays user", folder: "general", user: new("u1"), want: dashboardPreferencesScope{Tier: dashboardPreferencesTierUser, UserUID: "u1"}},
		{name: "both scopes", folder: "f1", user: new("u1"), wantErr: "not both"},
		{name: "empty user", user: new(""), wantErr: "spec.userUID"},
		{name: "shared with me", folder: "sharedwithme", wantErr: "sharedwithme"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := getDashboardPreferencesScope(tt.folder, tt.user)
			if tt.wantErr != "" {
				require.ErrorContains(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.want, got)
		})
	}
}

func TestDashboardPreferencesScopeOf(t *testing.T) {
	newObj := func(folderUID string, userUID *string) *dashv2beta1.DashboardPreferences {
		obj := &dashv2beta1.DashboardPreferences{Spec: dashv2beta1.DashboardPreferencesSpec{UserUID: userUID}}
		if folderUID != "" {
			obj.SetAnnotations(map[string]string{utils.AnnoKeyFolder: folderUID})
		}
		return obj
	}

	tests := []struct {
		name    string
		obj     *dashv2beta1.DashboardPreferences
		want    dashboardPreferencesScope
		wantErr string
	}{
		{name: "no scope is org", obj: newObj("", nil), want: dashboardPreferencesScope{Tier: dashboardPreferencesTierOrg}},
		{name: "general annotation is org", obj: newObj("general", nil), want: dashboardPreferencesScope{Tier: dashboardPreferencesTierOrg}},
		{name: "folder annotation is folder", obj: newObj("f1", nil), want: dashboardPreferencesScope{Tier: dashboardPreferencesTierFolder, FolderUID: "f1"}},
		{name: "spec.userUID is user", obj: newObj("", new("u1")), want: dashboardPreferencesScope{Tier: dashboardPreferencesTierUser, UserUID: "u1"}},
		{name: "general annotation with spec.userUID stays user", obj: newObj("general", new("u1")), want: dashboardPreferencesScope{Tier: dashboardPreferencesTierUser, UserUID: "u1"}},
		{name: "both scopes", obj: newObj("f1", new("u1")), wantErr: "not both"},
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
			if ok {
				require.Equal(t, tt.name, deriveDashboardPreferencesMetadataName(got))
				require.NoError(t, validateDashboardPreferencesMetadataName(tt.name, got))
			}
		})
	}

	for _, prefix := range []string{dashboardPreferencesFolderNamePrefix, dashboardPreferencesUserNamePrefix} {
		t.Run("name length limit for "+prefix, func(t *testing.T) {
			atLimit := prefix + strings.Repeat("x", dashboardPreferencesMetadataNameMaxLength-len(prefix))
			got, ok := dashboardPreferencesScopeFromName(atLimit)
			require.True(t, ok)
			require.NoError(t, validateDashboardPreferencesMetadataName(atLimit, got))

			got, ok = dashboardPreferencesScopeFromName(atLimit + "x")
			require.False(t, ok)
			require.Equal(t, dashboardPreferencesScope{}, got)
		})
	}
}

func TestDeriveDashboardPreferencesMetadataName(t *testing.T) {
	tests := []struct {
		name  string
		scope dashboardPreferencesScope
		want  string
	}{
		{name: "org", scope: dashboardPreferencesScope{Tier: dashboardPreferencesTierOrg}, want: "namespace"},
		{name: "folder", scope: dashboardPreferencesScope{Tier: dashboardPreferencesTierFolder, FolderUID: "f1"}, want: "folder-f1"},
		{name: "user", scope: dashboardPreferencesScope{Tier: dashboardPreferencesTierUser, UserUID: "u1"}, want: "user-u1"},
		{name: "uid with dashes is kept whole", scope: dashboardPreferencesScope{Tier: dashboardPreferencesTierFolder, FolderUID: "a--b"}, want: "folder-a--b"},
		{name: "unset tier has no name", scope: dashboardPreferencesScope{}, want: ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, deriveDashboardPreferencesMetadataName(tt.scope))
		})
	}

	t.Run("name prefixes match the API package name helpers", func(t *testing.T) {
		require.Equal(t, dashv2beta1.DashboardPreferencesFolderName("x"), dashboardPreferencesFolderNamePrefix+"x")
		require.Equal(t, dashv2beta1.DashboardPreferencesUserName("x"), dashboardPreferencesUserNamePrefix+"x")
		require.Equal(t, dashv2beta1.DashboardPreferencesOrgName, deriveDashboardPreferencesMetadataName(dashboardPreferencesScope{Tier: dashboardPreferencesTierOrg}))
	})
}

func TestValidateDashboardPreferencesMetadataName(t *testing.T) {
	orgScope := dashboardPreferencesScope{Tier: dashboardPreferencesTierOrg}
	folderScope := dashboardPreferencesScope{Tier: dashboardPreferencesTierFolder, FolderUID: "f1"}
	userScope := dashboardPreferencesScope{Tier: dashboardPreferencesTierUser, UserUID: "u1"}
	userScopeAtLimit := dashboardPreferencesScope{
		Tier:    dashboardPreferencesTierUser,
		UserUID: strings.Repeat("u", dashboardPreferencesMetadataNameMaxLength-len(dashboardPreferencesUserNamePrefix)),
	}

	tests := []struct {
		name    string
		gotName string
		scope   dashboardPreferencesScope
		wantErr string
	}{
		{name: "empty name is allowed", gotName: "", scope: folderScope},
		{name: "matching org name", gotName: "namespace", scope: orgScope},
		{name: "matching folder name", gotName: "folder-f1", scope: folderScope},
		{name: "matching user name", gotName: "user-u1", scope: userScope},
		{name: "name at the length limit", gotName: "", scope: userScopeAtLimit},
		{
			name:    "mismatch names the tier and the expected name",
			gotName: "namespace",
			scope:   folderScope,
			wantErr: `metadata.name "namespace" does not match the name required for this folder tier: expected "folder-f1" (omit metadata.name to let the server set it)`,
		},
		{
			name:    "another user's name",
			gotName: "user-u2",
			scope:   userScope,
			wantErr: `does not match the name required for this user tier: expected "user-u1"`,
		},
		{
			name:    "org tier rejects a folder name",
			gotName: "folder-f1",
			scope:   orgScope,
			wantErr: `does not match the name required for this org tier: expected "namespace"`,
		},
		{
			name:    "name over the length limit",
			gotName: "",
			scope:   dashboardPreferencesScope{Tier: dashboardPreferencesTierUser, UserUID: strings.Repeat("u", 250)}, // "user-" + 250 > 253
			wantErr: "exceeds maximum length",
		},
		{
			name:    "uid with characters a name can't hold",
			gotName: "",
			scope:   dashboardPreferencesScope{Tier: dashboardPreferencesTierFolder, FolderUID: "a/b"},
			wantErr: `derived metadata.name "folder-a/b" is invalid`,
		},
		{name: "unset tier has no valid name", gotName: "", scope: dashboardPreferencesScope{}, wantErr: "is invalid"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateDashboardPreferencesMetadataName(tt.gotName, tt.scope)
			if tt.wantErr != "" {
				require.ErrorContains(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
		})
	}
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
		return newDashboardPreferences("user-u1", "", new("u1"))
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

	tests := []struct {
		name      string
		attrs     admission.Attributes
		requester identity.Requester
		// Runs Mutate before Validate, as the admission chain does.
		mutate        bool
		folderMissing bool
		wantErr       func(error) bool
		wantErrMsg    string
	}{
		{name: "org create by admin", attrs: create(newDashboardPreferences("namespace", "", nil)), requester: admin},
		// The authorizer can't see the name of a POST, so admission has to authorize the name Mutate derives.
		{name: "org create by editor", attrs: create(newDashboardPreferences("", "", nil)), mutate: true, requester: editor, wantErr: apierrors.IsForbidden, wantErrMsg: "only org admins can change org dashboard preferences"},
		{name: "user create for someone else", attrs: create(newDashboardPreferences("user-u2", "", new("u2"))), requester: u1, wantErr: apierrors.IsForbidden, wantErrMsg: "only the owner can access user dashboard preferences"},
		{name: "folder create by folder admin", attrs: create(newDashboardPreferences("folder-f1", "f1", nil)), requester: editor},
		{name: "missing folder", attrs: create(newDashboardPreferences("folder-missing", "missing", nil)), requester: editor, folderMissing: true, wantErr: isMissingFolder},
		{name: "missing folder in dry-run", attrs: dryRunCreate(newDashboardPreferences("folder-missing", "missing", nil)), requester: editor, folderMissing: true},
		// Authorizing before the lookup keeps a caller without access from learning whether the folder exists.
		{name: "missing folder without folder admin", attrs: create(newDashboardPreferences("folder-nope", "nope", nil)), requester: editor, folderMissing: true, wantErr: apierrors.IsForbidden, wantErrMsg: "only folder admins can change folder dashboard preferences"},
		{name: "dry-run still applies the tier rules", attrs: dryRunCreate(newDashboardPreferences("namespace", "", nil)), requester: editor, wantErr: apierrors.IsForbidden, wantErrMsg: "only org admins can change org dashboard preferences"},
		// The tier rules would deny it, so only skipping them lets this through.
		{name: "service identity skips the tier rules", attrs: create(u1Preferences()), requester: service},
		// Each would be allowed in the admin's own stack, so only judging the request's namespace denies it.
		{name: "org create from another stack", attrs: create(newDashboardPreferences("namespace", "", nil)), requester: otherStackAdmin, wantErr: apierrors.IsForbidden, wantErrMsg: "only org members can access org dashboard preferences"},
		{name: "user create from another stack", attrs: create(newDashboardPreferences("user-admin", "", new("admin"))), requester: otherStackAdmin, wantErr: apierrors.IsForbidden, wantErrMsg: "only the owner can access user dashboard preferences"},
		{name: "folder create from another stack", attrs: create(newDashboardPreferences("folder-f1", "f1", nil)), requester: otherStackAdmin, wantErr: apierrors.IsForbidden, wantErrMsg: "only folder admins can change folder dashboard preferences"},
		{name: "name mismatch", attrs: create(newDashboardPreferences("folder-f1", "", new("u1"))), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: `expected "user-u1"`},
		// Mutate rejects this first, but Validate must not rely on it.
		{name: "both scopes", attrs: create(newDashboardPreferences("folder-f1", "f1", new("u1"))), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: "not both"},
		{name: "repository-managed", attrs: create(withAnnotations(u1Preferences(), map[string]string{utils.AnnoKeyManagerKind: "repo"})), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: repositoryManaged},
		{name: "repository manager identity", attrs: create(withAnnotations(u1Preferences(), map[string]string{utils.AnnoKeyManagerIdentity: "repo-1"})), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: repositoryManaged},
		{name: "legacy repository annotation", attrs: create(withAnnotations(u1Preferences(), map[string]string{"grafana.app/repoName": "repo-1"})), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: repositoryManaged},
		{name: "invalid spec", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"fiscalYearStartMonth":12}}`)), requester: u1, wantErr: apierrors.IsInvalid},
		{name: "refresh below minimum", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"autoRefresh":"5s"}}`)), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: "spec.dashboard.autoRefresh: Dashboard refresh interval is too low"},
		{name: "refresh off", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"autoRefresh":""}}`)), requester: u1},
		{name: "refresh auto", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"autoRefresh":"auto"}}`)), requester: u1},
		{name: "refresh intervals", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"autoRefreshIntervals":["10s","1m","1d"]}}`)), requester: u1},
		// JSON [] would be stored as no list at all and read back as inherit, so it must not get that far.
		{name: "empty refresh interval list", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"autoRefreshIntervals":[]}}`)), mutate: true, requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: "spec.dashboard.autoRefreshIntervals must not be empty; send null to clear it"},
		{name: "refresh interval below minimum", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"autoRefreshIntervals":["1m","5s"]}}`)), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: "spec.dashboard.autoRefreshIntervals[1]: Dashboard refresh interval is too low"},
		{name: "refresh interval that isn't a duration", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"autoRefreshIntervals":["soon"]}}`)), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: `spec.dashboard.autoRefreshIntervals[0]: parsing refresh duration "soon" failed`},
		// The refresh check passes it as a dashboard's refresh value, but it is not an interval to list.
		{name: "auto refresh interval", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"autoRefreshIntervals":["1m","auto"]}}`)), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: `spec.dashboard.autoRefreshIntervals[1] must be a duration such as 30s or 1m, not "auto"`},
		{name: "empty refresh interval", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"autoRefreshIntervals":[""]}}`)), requester: u1, wantErr: apierrors.IsInvalid},
		{name: "now delay", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"nowDelay":"30s"}}`)), requester: u1},
		{name: "now delay in days", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"nowDelay":"1d"}}`)), requester: u1},
		{name: "now delay that isn't a duration", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"nowDelay":"soon"}}`)), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: `spec.dashboard.nowDelay must be one amount and unit such as 30s or 1m, not "soon"`},
		// Dashboards apply it as "now-" + nowDelay.
		{name: "negative now delay", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"nowDelay":"-1m"}}`)), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: `spec.dashboard.nowDelay must be one amount and unit such as 30s or 1m, not "-1m"`},
		{name: "auto grid at the editor's minimums", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"autoGrid":{"maxColumnCount":1,"columnWidth":50,"rowHeight":50}}}`)), requester: u1},
		{name: "max column count below the editor's minimum", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"autoGrid":{"maxColumnCount":0}}}`)), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: "spec.dashboard.autoGrid.maxColumnCount must be at least 1"},
		{name: "column width below the editor's minimum", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"autoGrid":{"columnWidth":49}}}`)), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: "spec.dashboard.autoGrid.columnWidth must be at least 50"},
		{name: "row height below the editor's minimum", attrs: create(withSpec(u1Preferences(), `{"dashboard":{"autoGrid":{"rowHeight":49}}}`)), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: "spec.dashboard.autoGrid.rowHeight must be at least 50"},
		{name: "point size below the editor's minimum", attrs: create(withSpec(u1Preferences(), `{"panels":{"graph":{"pointSize":0}}}`)), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: "spec.panels.graph.pointSize must be at least 1"},
		{name: "panel preferences", attrs: create(withSpec(u1Preferences(), `{"panels":{"legend":{"showLegend":true}}}`)), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: "panel preferences are not supported yet"},
		// A merge-patch that nulls the last panel value leaves the groups, which Mutate drops.
		{name: "panels with no value set", attrs: create(withSpec(u1Preferences(), `{"panels":{"graph":{}}}`)), mutate: true, requester: u1},
		{name: "wrong type", attrs: create(&dashv2beta1.Notebook{}), requester: u1, wantErr: isPlainError, wantErrMsg: "unsupported dashboard preferences version"},

		{name: "scope change", attrs: update(newDashboardPreferences("folder-f1", "f2", nil), newDashboardPreferences("folder-f1", "f1", nil)), requester: editor, wantErr: apierrors.IsBadRequest, wantErrMsg: "cannot be changed"},
		// Root-parented objects can carry the general sentinel, which means the same as no annotation.
		{name: "general vs empty is no change", attrs: update(newDashboardPreferences("user-u1", "general", new("u1")), u1Preferences()), requester: u1},
		{name: "general vs empty is no change on the org tier", attrs: update(newDashboardPreferences("namespace", "general", nil), newDashboardPreferences("namespace", "", nil)), requester: admin},
		{name: "update with both scopes", attrs: update(newDashboardPreferences("user-u1", "f1", new("u1")), u1Preferences()), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: "not both"},
		{name: "repository-managed update", attrs: update(withAnnotations(u1Preferences(), map[string]string{utils.AnnoKeyManagerKind: "repo"}), u1Preferences()), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: repositoryManaged},
		{name: "legacy repository annotation on update", attrs: update(withAnnotations(u1Preferences(), map[string]string{"grafana.app/repoName": "repo-1"}), u1Preferences()), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: repositoryManaged},
		// The stored object has the same name, so only the check against the scope rejects it.
		{name: "update name mismatch", attrs: update(newDashboardPreferences("folder-f1", "", new("u1")), newDashboardPreferences("folder-f1", "", new("u1"))), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: `expected "user-u1"`},
		{name: "update with invalid spec", attrs: update(withSpec(u1Preferences(), `{"dashboard":{"fiscalYearStartMonth":12}}`), u1Preferences()), requester: u1, wantErr: apierrors.IsInvalid},
		{name: "update with refresh below minimum", attrs: update(withSpec(u1Preferences(), `{"dashboard":{"autoRefresh":"5s"}}`), u1Preferences()), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: "spec.dashboard.autoRefresh: Dashboard refresh interval is too low"},
		{name: "update changing the refresh to below minimum", attrs: update(withSpec(u1Preferences(), `{"dashboard":{"autoRefresh":"5s"}}`), withSpec(u1Preferences(), `{"dashboard":{"autoRefresh":"1m"}}`)), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: "spec.dashboard.autoRefresh: Dashboard refresh interval is too low"},
		{name: "update changing refresh intervals to below minimum", attrs: update(withSpec(u1Preferences(), `{"dashboard":{"autoRefreshIntervals":["5s","1m"]}}`), withSpec(u1Preferences(), `{"dashboard":{"autoRefreshIntervals":["1m"]}}`)), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: "spec.dashboard.autoRefreshIntervals[0]: Dashboard refresh interval is too low"},
		// Saved before min_refresh_interval was raised to 10s: an edit of another field must still go through.
		{name: "update keeping a refresh below minimum", attrs: update(withSpec(u1Preferences(), `{"dashboard":{"autoRefresh":"5s","preload":true}}`), withSpec(u1Preferences(), `{"dashboard":{"autoRefresh":"5s"}}`)), requester: u1},
		{name: "update keeping refresh intervals below minimum", attrs: update(withSpec(u1Preferences(), `{"dashboard":{"autoRefreshIntervals":["5s"],"preload":true}}`), withSpec(u1Preferences(), `{"dashboard":{"autoRefreshIntervals":["5s"]}}`)), requester: u1},
		// An empty list and no list compare equal, so this check can't depend on a change.
		{name: "update with an empty refresh interval list", attrs: update(withSpec(u1Preferences(), `{"dashboard":{"autoRefreshIntervals":[]}}`), u1Preferences()), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: "spec.dashboard.autoRefreshIntervals must not be empty; send null to clear it"},
		{name: "update with a negative now delay", attrs: update(withSpec(u1Preferences(), `{"dashboard":{"nowDelay":"-1m"}}`), u1Preferences()), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: "spec.dashboard.nowDelay"},
		{name: "update with a row height below the editor's minimum", attrs: update(withSpec(u1Preferences(), `{"dashboard":{"autoGrid":{"rowHeight":49}}}`), u1Preferences()), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: "spec.dashboard.autoGrid.rowHeight must be at least 50"},
		{name: "update with panel preferences", attrs: update(withSpec(u1Preferences(), `{"panels":{"legend":{"showLegend":true}}}`), u1Preferences()), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: "panel preferences are not supported yet"},
		{name: "update without an old object", attrs: update(u1Preferences(), nil), requester: u1, wantErr: isPlainError, wantErrMsg: "old dashboard preferences"},

		{name: "delete", attrs: dashboardPreferencesAttributesForOp(admission.Delete, nil, u1Preferences()), requester: u1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			builder := &DashboardsAPIBuilder{
				dashboardService:   &dashsvc.DashboardServiceImpl{},
				minRefreshInterval: "10s",
				accessClient: &dashboardPreferencesAccessClient{grants: map[string][]string{
					"f1":      {utils.VerbSetPermissions},
					"missing": {utils.VerbSetPermissions},
				}},
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
