package dashboard

import (
	"context"
	"encoding/json"
	"errors"
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

func TestGetDashboardSettingsScope(t *testing.T) {
	tests := []struct {
		name, folder string
		user         *string
		want         dashboardSettingsScope
		wantErr      string
	}{
		{name: "no scope is org", want: dashboardSettingsScope{Tier: dashboardSettingsTierOrg}},
		{name: "general folder is org", folder: "general", want: dashboardSettingsScope{Tier: dashboardSettingsTierOrg}},
		{name: "folder", folder: "f1", want: dashboardSettingsScope{Tier: dashboardSettingsTierFolder, FolderUID: "f1"}},
		{name: "user", user: new("u1"), want: dashboardSettingsScope{Tier: dashboardSettingsTierUser, UserUID: "u1"}},
		{name: "user with general annotation stays user", folder: "general", user: new("u1"), want: dashboardSettingsScope{Tier: dashboardSettingsTierUser, UserUID: "u1"}},
		{name: "both scopes", folder: "f1", user: new("u1"), wantErr: "not both"},
		{name: "empty user", user: new(""), wantErr: "spec.userUID"},
		{name: "shared with me", folder: "sharedwithme", wantErr: "sharedwithme"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := getDashboardSettingsScope(tt.folder, tt.user)
			if tt.wantErr != "" {
				require.ErrorContains(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.want, got)
		})
	}
}

func TestDashboardSettingsScopeOf(t *testing.T) {
	newObj := func(folderUID string, userUID *string) *dashv2beta1.DashboardSettings {
		obj := &dashv2beta1.DashboardSettings{Spec: dashv2beta1.DashboardSettingsSpec{UserUID: userUID}}
		if folderUID != "" {
			obj.SetAnnotations(map[string]string{utils.AnnoKeyFolder: folderUID})
		}
		return obj
	}

	tests := []struct {
		name    string
		obj     *dashv2beta1.DashboardSettings
		want    dashboardSettingsScope
		wantErr string
	}{
		{name: "no scope is org", obj: newObj("", nil), want: dashboardSettingsScope{Tier: dashboardSettingsTierOrg}},
		{name: "general annotation is org", obj: newObj("general", nil), want: dashboardSettingsScope{Tier: dashboardSettingsTierOrg}},
		{name: "folder annotation is folder", obj: newObj("f1", nil), want: dashboardSettingsScope{Tier: dashboardSettingsTierFolder, FolderUID: "f1"}},
		{name: "spec.userUID is user", obj: newObj("", new("u1")), want: dashboardSettingsScope{Tier: dashboardSettingsTierUser, UserUID: "u1"}},
		{name: "general annotation with spec.userUID stays user", obj: newObj("general", new("u1")), want: dashboardSettingsScope{Tier: dashboardSettingsTierUser, UserUID: "u1"}},
		{name: "both scopes", obj: newObj("f1", new("u1")), wantErr: "not both"},
		{name: "nil object", obj: nil, wantErr: "payload is required"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := dashboardSettingsScopeOf(tt.obj)
			if tt.wantErr != "" {
				require.ErrorContains(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.want, got)
		})
	}
}

func TestDashboardSettingsScopeFromName(t *testing.T) {
	tests := []struct {
		name   string
		want   dashboardSettingsScope
		wantOK bool
	}{
		{name: "namespace", want: dashboardSettingsScope{Tier: dashboardSettingsTierOrg}, wantOK: true},
		{name: "folder-abc", want: dashboardSettingsScope{Tier: dashboardSettingsTierFolder, FolderUID: "abc"}, wantOK: true},
		{name: "folder-a--b", want: dashboardSettingsScope{Tier: dashboardSettingsTierFolder, FolderUID: "a--b"}, wantOK: true},
		{name: "user-u1", want: dashboardSettingsScope{Tier: dashboardSettingsTierUser, UserUID: "u1"}, wantOK: true},
		{name: "user-u-1--2", want: dashboardSettingsScope{Tier: dashboardSettingsTierUser, UserUID: "u-1--2"}, wantOK: true},
		{name: "folder-"},
		{name: "folder-general"},
		{name: "folder-sharedwithme"},
		{name: "folder-a b"},
		{name: "user-"},
		{name: "user-a b"},
		{name: dashboardSettingsMergedName},
		{name: "Namespace"},
		{name: "foo"},
		{name: ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := dashboardSettingsScopeFromName(tt.name)
			require.Equal(t, tt.wantOK, ok)
			require.Equal(t, tt.want, got)
			if ok {
				require.Equal(t, tt.name, deriveDashboardSettingsMetadataName(got))
				require.NoError(t, validateDashboardSettingsMetadataName(tt.name, got))
			}
		})
	}

	for _, prefix := range []string{dashboardSettingsFolderNamePrefix, dashboardSettingsUserNamePrefix} {
		t.Run("name length limit for "+prefix, func(t *testing.T) {
			atLimit := prefix + strings.Repeat("x", dashboardSettingsMetadataNameMaxLength-len(prefix))
			got, ok := dashboardSettingsScopeFromName(atLimit)
			require.True(t, ok)
			require.NoError(t, validateDashboardSettingsMetadataName(atLimit, got))

			got, ok = dashboardSettingsScopeFromName(atLimit + "x")
			require.False(t, ok)
			require.Equal(t, dashboardSettingsScope{}, got)
		})
	}
}

func TestDeriveDashboardSettingsMetadataName(t *testing.T) {
	tests := []struct {
		name  string
		scope dashboardSettingsScope
		want  string
	}{
		{name: "org", scope: dashboardSettingsScope{Tier: dashboardSettingsTierOrg}, want: "namespace"},
		{name: "folder", scope: dashboardSettingsScope{Tier: dashboardSettingsTierFolder, FolderUID: "f1"}, want: "folder-f1"},
		{name: "user", scope: dashboardSettingsScope{Tier: dashboardSettingsTierUser, UserUID: "u1"}, want: "user-u1"},
		{name: "uid with dashes is kept whole", scope: dashboardSettingsScope{Tier: dashboardSettingsTierFolder, FolderUID: "a--b"}, want: "folder-a--b"},
		{name: "unset tier has no name", scope: dashboardSettingsScope{}, want: ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, deriveDashboardSettingsMetadataName(tt.scope))
		})
	}

	t.Run("name prefixes match the API package name helpers", func(t *testing.T) {
		require.Equal(t, dashv2beta1.DashboardSettingsFolderName("x"), dashboardSettingsFolderNamePrefix+"x")
		require.Equal(t, dashv2beta1.DashboardSettingsUserName("x"), dashboardSettingsUserNamePrefix+"x")
		require.Equal(t, dashv2beta1.DashboardSettingsOrgName, deriveDashboardSettingsMetadataName(dashboardSettingsScope{Tier: dashboardSettingsTierOrg}))
	})
}

func TestValidateDashboardSettingsMetadataName(t *testing.T) {
	orgScope := dashboardSettingsScope{Tier: dashboardSettingsTierOrg}
	folderScope := dashboardSettingsScope{Tier: dashboardSettingsTierFolder, FolderUID: "f1"}
	userScope := dashboardSettingsScope{Tier: dashboardSettingsTierUser, UserUID: "u1"}
	userScopeAtLimit := dashboardSettingsScope{
		Tier:    dashboardSettingsTierUser,
		UserUID: strings.Repeat("u", dashboardSettingsMetadataNameMaxLength-len(dashboardSettingsUserNamePrefix)),
	}

	tests := []struct {
		name    string
		gotName string
		scope   dashboardSettingsScope
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
			scope:   dashboardSettingsScope{Tier: dashboardSettingsTierUser, UserUID: strings.Repeat("u", 250)}, // "user-" + 250 > 253
			wantErr: "exceeds maximum length",
		},
		{
			name:    "uid with characters a name can't hold",
			gotName: "",
			scope:   dashboardSettingsScope{Tier: dashboardSettingsTierFolder, FolderUID: "a/b"},
			wantErr: `derived metadata.name "folder-a/b" is invalid`,
		},
		{name: "unset tier has no valid name", gotName: "", scope: dashboardSettingsScope{}, wantErr: "is invalid"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateDashboardSettingsMetadataName(tt.gotName, tt.scope)
			if tt.wantErr != "" {
				require.ErrorContains(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestDashboardsAPIBuilderValidateDashboardSettings(t *testing.T) {
	const repositoryManaged = "dashboard settings can't be managed by a repository"

	admin := dashboardSettingsRequester(authlib.TypeUser, "admin", identity.RoleAdmin)
	// The access client in the loop makes every caller an admin of the folders f1 and missing.
	editor := dashboardSettingsRequester(authlib.TypeUser, "editor", identity.RoleEditor)
	u1 := dashboardSettingsRequester(authlib.TypeUser, "u1", identity.RoleViewer)
	// Grafana admins pass the namespace authorizer for every namespace.
	otherStackAdmin := dashboardSettingsRequester(authlib.TypeUser, "admin", identity.RoleAdmin)
	otherStackAdmin.Namespace = "stacks-2"
	otherStackAdmin.IsGrafanaAdmin = true
	_, service := identity.WithServiceIdentity(context.Background(), 1)

	create := func(obj runtime.Object) admission.Attributes {
		return dashboardSettingsAttributesForOp(admission.Create, obj, nil)
	}
	update := func(newObj, oldObj runtime.Object) admission.Attributes {
		return dashboardSettingsAttributesForOp(admission.Update, newObj, oldObj)
	}
	dryRunCreate := func(obj *dashv2beta1.DashboardSettings) admission.Attributes {
		return admission.NewAttributesRecord(
			obj,
			nil,
			dashv2beta1.DashboardSettingsResourceInfo.GroupVersionKind(),
			"stacks-1",
			obj.GetName(),
			dashv2beta1.DashboardSettingsResourceInfo.GroupVersionResource(),
			"",
			admission.Create,
			&metav1.CreateOptions{DryRun: []string{metav1.DryRunAll}},
			true,
			nil,
		)
	}
	u1Settings := func() *dashv2beta1.DashboardSettings {
		return newDashboardSettings("user-u1", "", new("u1"))
	}
	withSpec := func(obj *dashv2beta1.DashboardSettings, spec string) *dashv2beta1.DashboardSettings {
		require.NoError(t, json.Unmarshal([]byte(spec), &obj.Spec))
		return obj
	}
	withAnnotations := func(obj *dashv2beta1.DashboardSettings, annotations map[string]string) *dashv2beta1.DashboardSettings {
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
		{name: "org create by admin", attrs: create(newDashboardSettings("namespace", "", nil)), requester: admin},
		// The authorizer can't see the name of a POST, so admission has to authorize the name Mutate derives.
		{name: "org create by editor", attrs: create(newDashboardSettings("", "", nil)), mutate: true, requester: editor, wantErr: apierrors.IsForbidden, wantErrMsg: "only org admins can change org dashboard settings"},
		{name: "user create for someone else", attrs: create(newDashboardSettings("user-u2", "", new("u2"))), requester: u1, wantErr: apierrors.IsForbidden, wantErrMsg: "only the owner can access user dashboard settings"},
		{name: "folder create by folder admin", attrs: create(newDashboardSettings("folder-f1", "f1", nil)), requester: editor},
		{name: "missing folder", attrs: create(newDashboardSettings("folder-missing", "missing", nil)), requester: editor, folderMissing: true, wantErr: isMissingFolder},
		{name: "missing folder in dry-run", attrs: dryRunCreate(newDashboardSettings("folder-missing", "missing", nil)), requester: editor, folderMissing: true},
		// Authorizing before the lookup keeps a caller without access from learning whether the folder exists.
		{name: "missing folder without folder admin", attrs: create(newDashboardSettings("folder-nope", "nope", nil)), requester: editor, folderMissing: true, wantErr: apierrors.IsForbidden, wantErrMsg: "only folder admins can change folder dashboard settings"},
		{name: "dry-run still applies the tier rules", attrs: dryRunCreate(newDashboardSettings("namespace", "", nil)), requester: editor, wantErr: apierrors.IsForbidden, wantErrMsg: "only org admins can change org dashboard settings"},
		// The tier rules would deny it, so only skipping them lets this through.
		{name: "service identity skips the tier rules", attrs: create(u1Settings()), requester: service},
		// Each would be allowed in the admin's own stack, so only judging the request's namespace denies it.
		{name: "org create from another stack", attrs: create(newDashboardSettings("namespace", "", nil)), requester: otherStackAdmin, wantErr: apierrors.IsForbidden, wantErrMsg: "only org members can access org dashboard settings"},
		{name: "user create from another stack", attrs: create(newDashboardSettings("user-admin", "", new("admin"))), requester: otherStackAdmin, wantErr: apierrors.IsForbidden, wantErrMsg: "only the owner can access user dashboard settings"},
		{name: "folder create from another stack", attrs: create(newDashboardSettings("folder-f1", "f1", nil)), requester: otherStackAdmin, wantErr: apierrors.IsForbidden, wantErrMsg: "only folder admins can change folder dashboard settings"},
		{name: "name mismatch", attrs: create(newDashboardSettings("folder-f1", "", new("u1"))), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: `expected "user-u1"`},
		// Mutate rejects this first, but Validate must not rely on it.
		{name: "both scopes", attrs: create(newDashboardSettings("folder-f1", "f1", new("u1"))), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: "not both"},
		{name: "repository-managed", attrs: create(withAnnotations(u1Settings(), map[string]string{utils.AnnoKeyManagerKind: "repo"})), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: repositoryManaged},
		{name: "repository manager identity", attrs: create(withAnnotations(u1Settings(), map[string]string{utils.AnnoKeyManagerIdentity: "repo-1"})), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: repositoryManaged},
		{name: "invalid spec", attrs: create(withSpec(u1Settings(), `{"panels":{"decimals":99}}`)), requester: u1, wantErr: apierrors.IsInvalid},
		{name: "refresh below minimum", attrs: create(withSpec(u1Settings(), `{"autoRefresh":"5s"}`)), requester: u1, wantErr: apierrors.IsBadRequest},
		{name: "refresh off", attrs: create(withSpec(u1Settings(), `{"autoRefresh":""}`)), requester: u1},
		{name: "refresh auto", attrs: create(withSpec(u1Settings(), `{"autoRefresh":"auto"}`)), requester: u1},
		{name: "wrong type", attrs: create(&dashv2beta1.Notebook{}), requester: u1, wantErr: isPlainError, wantErrMsg: "unsupported dashboard settings version"},

		{name: "scope change", attrs: update(newDashboardSettings("folder-f1", "f2", nil), newDashboardSettings("folder-f1", "f1", nil)), requester: editor, wantErr: apierrors.IsBadRequest, wantErrMsg: "cannot be changed"},
		// Root-parented objects can carry the general sentinel, which means the same as no annotation.
		{name: "general vs empty is no change", attrs: update(newDashboardSettings("user-u1", "general", new("u1")), u1Settings()), requester: u1},
		{name: "general vs empty is no change on the org tier", attrs: update(newDashboardSettings("namespace", "general", nil), newDashboardSettings("namespace", "", nil)), requester: admin},
		{name: "update with both scopes", attrs: update(newDashboardSettings("user-u1", "f1", new("u1")), u1Settings()), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: "not both"},
		{name: "repository-managed update", attrs: update(withAnnotations(u1Settings(), map[string]string{utils.AnnoKeyManagerKind: "repo"}), u1Settings()), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: repositoryManaged},
		// The stored object has the same name, so only the check against the scope rejects it.
		{name: "update name mismatch", attrs: update(newDashboardSettings("folder-f1", "", new("u1")), newDashboardSettings("folder-f1", "", new("u1"))), requester: u1, wantErr: apierrors.IsBadRequest, wantErrMsg: `expected "user-u1"`},
		{name: "update with invalid spec", attrs: update(withSpec(u1Settings(), `{"panels":{"decimals":99}}`), u1Settings()), requester: u1, wantErr: apierrors.IsInvalid},
		{name: "update with refresh below minimum", attrs: update(withSpec(u1Settings(), `{"autoRefresh":"5s"}`), u1Settings()), requester: u1, wantErr: apierrors.IsBadRequest},
		{name: "update without an old object", attrs: update(u1Settings(), nil), requester: u1, wantErr: isPlainError, wantErrMsg: "old dashboard settings"},

		{name: "delete", attrs: dashboardSettingsAttributesForOp(admission.Delete, nil, u1Settings()), requester: u1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			builder := &DashboardsAPIBuilder{
				dashboardService:   &dashsvc.DashboardServiceImpl{},
				minRefreshInterval: "10s",
				accessClient: &dashboardSettingsAccessClient{grants: map[string][]string{
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
