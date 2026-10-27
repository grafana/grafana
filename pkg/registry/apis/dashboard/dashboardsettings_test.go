package dashboard

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
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
