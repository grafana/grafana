package iam

import (
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/setting"
)

func TestParseAPIs(t *testing.T) {
	tests := []struct {
		name    string
		values  []string
		want    []API
		wantErr string
	}{
		{
			name:   "parses and deduplicates APIs",
			values: []string{"roles", "teams", "roles"},
			want:   []API{APIRoles, APITeams},
		},
		{
			name:   "none disables every API",
			values: []string{"none"},
		},
		{
			name:    "none cannot be combined",
			values:  []string{"none", "roles"},
			wantErr: "cannot be combined",
		},
		{
			name:    "rejects unknown API",
			values:  []string{"coreroles"},
			wantErr: "unknown iam api",
		},
		{
			name:    "rejects empty configuration",
			wantErr: "at least one iam api",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseAPIs(tt.values)
			if tt.wantErr != "" {
				require.ErrorContains(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.want, got)
		})
	}
}

func TestFeaturesSetAPIsReplacesAPISurface(t *testing.T) {
	features := Features{
		RolesAPI:       true,
		GlobalRolesAPI: true,
		ZanzanaSync:    true,
	}

	features.SetAPIs([]API{APITeams, APIUsers})

	require.Equal(t, []API{APITeams, APIUsers}, features.EnabledAPIs())
	require.True(t, features.ZanzanaSync)
}

func TestFeaturesValidate(t *testing.T) {
	t.Run("service account tokens require service accounts", func(t *testing.T) {
		err := (Features{ServiceAccountTokensAPI: true}).Validate()
		require.ErrorContains(t, err, "requires")
	})

	t.Run("service account resource permissions require resource permissions", func(t *testing.T) {
		err := (Features{ServiceAccountResourcePermissions: true}).Validate()
		require.ErrorContains(t, err, "resource permissions")
	})

	t.Run("accepts valid dependencies", func(t *testing.T) {
		err := (Features{
			ServiceAccountsAPI:                true,
			ServiceAccountTokensAPI:           true,
			ResourcePermissionsAPI:            true,
			ServiceAccountResourcePermissions: true,
		}).Validate()
		require.NoError(t, err)
	})
}

func TestProvideStartupFeatures(t *testing.T) {
	tests := []struct {
		name       string
		values     map[string]string
		configured bool
		want       Features
		wantErr    string
	}{
		{
			name: "uses legacy fallback when api is empty",
		},
		{
			name: "resolves API and behavior settings",
			values: map[string]string{
				"api":                  "roles, rolebindings, resourcepermissions",
				"zanzana_sync_enabled": "true",
				"service_account_resource_permissions_enabled": "true",
			},
			configured: true,
			want: Features{
				RolesAPI:                          true,
				RoleBindingsAPI:                   true,
				ResourcePermissionsAPI:            true,
				ZanzanaSync:                       true,
				ServiceAccountResourcePermissions: true,
			},
		},
		{
			name:       "none configures an empty API surface",
			values:     map[string]string{"api": "none"},
			configured: true,
		},
		{
			name:    "rejects behavior settings without APIs",
			values:  map[string]string{"zanzana_sync_enabled": "true"},
			wantErr: "iam.api must be configured",
		},
		{
			name:    "rejects unknown APIs",
			values:  map[string]string{"api": "teams,unknown"},
			wantErr: "unknown iam api",
		},
		{
			name:    "rejects invalid behavior settings",
			values:  map[string]string{"zanzana_sync_enabled": "sometimes"},
			wantErr: "invalid iam.zanzana_sync_enabled",
		},
		{
			name: "validates dependencies",
			values: map[string]string{
				"api": "teams",
				"service_account_resource_permissions_enabled": "true",
			},
			wantErr: "resource permissions",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			raw := ini.Empty()
			for key, value := range tt.values {
				raw.Section("iam").Key(key).SetValue(value)
			}

			got, err := ProvideStartupFeatures(&setting.Cfg{Raw: raw})
			if tt.wantErr != "" {
				require.ErrorContains(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
			features := got.Snapshot()
			if !tt.configured {
				require.Nil(t, features)
				return
			}
			require.Equal(t, tt.want, *features)
		})
	}
}
