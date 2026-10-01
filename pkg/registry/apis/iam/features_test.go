package iam

import (
	"context"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
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

func TestProvideFeatures(t *testing.T) {
	legacyProvider := func() memprovider.InMemoryProvider {
		return memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
			featuremgmt.FlagKubernetesAuthzGlobalRolesApi: {
				Key:            featuremgmt.FlagKubernetesAuthzGlobalRolesApi,
				DefaultVariant: "enabled",
				Variants:       map[string]any{"enabled": true},
			},
			featuremgmt.FlagKubernetesAuthzZanzanaSync: {
				Key:            featuremgmt.FlagKubernetesAuthzZanzanaSync,
				DefaultVariant: "enabled",
				Variants:       map[string]any{"enabled": true},
			},
		})
	}

	tests := []struct {
		name    string
		values  map[string]string
		want    Features
		wantErr string
	}{
		{
			name: "absent configuration resolves legacy flags",
			want: Features{GlobalRolesAPI: true, ZanzanaSync: true},
		},
		{
			name: "explicit configuration replaces legacy flags",
			values: map[string]string{
				"api":                  "roles, rolebindings, resourcepermissions",
				"zanzana_sync_enabled": "false",
				"service_account_resource_permissions_enabled": "true",
			},
			want: Features{
				RolesAPI:                          true,
				RoleBindingsAPI:                   true,
				ResourcePermissionsAPI:            true,
				ServiceAccountResourcePermissions: true,
			},
		},
		{
			name:   "explicit none disables legacy flags",
			values: map[string]string{"api": "none"},
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
			require.NoError(t, openfeature.SetProviderAndWait(legacyProvider()))
			t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })

			raw := ini.Empty()
			for key, value := range tt.values {
				raw.Section("iam").Key(key).SetValue(value)
			}

			got, err := ProvideFeatures(&setting.Cfg{Raw: raw})
			if tt.wantErr != "" {
				require.ErrorContains(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.want, got)
		})
	}
}

func TestProvideFeaturesUsesEnvironmentOverrides(t *testing.T) {
	t.Setenv("GF_IAM_API", "users,resourcepermissions")
	t.Setenv("GF_IAM_ZANZANA_SYNC_ENABLED", "true")
	t.Setenv("GF_IAM_SERVICE_ACCOUNT_RESOURCE_PERMISSIONS_ENABLED", "true")

	got, err := ProvideFeatures(setting.NewCfg())
	require.NoError(t, err)
	require.Equal(t, Features{
		UsersAPI:                          true,
		ResourcePermissionsAPI:            true,
		ServiceAccountResourcePermissions: true,
		ZanzanaSync:                       true,
	}, got)
}

func TestFeaturesFromFlags(t *testing.T) {
	tests := []struct {
		name string
		flag string
		want Features
	}{
		{name: "all disabled", want: Features{}},
		{name: "roles", flag: featuremgmt.FlagKubernetesAuthzRolesApi, want: Features{RolesAPI: true}},
		{name: "role bindings", flag: featuremgmt.FlagKubernetesAuthzRoleBindingsApi, want: Features{RoleBindingsAPI: true}},
		{name: "global roles", flag: featuremgmt.FlagKubernetesAuthzGlobalRolesApi, want: Features{GlobalRolesAPI: true}},
		{name: "resource permissions", flag: featuremgmt.FlagKubernetesAuthzResourcePermissionApis, want: Features{ResourcePermissionsAPI: true}},
		{name: "team LBAC rules", flag: featuremgmt.FlagKubernetesAuthzTeamLBACRuleApi, want: Features{TeamLBACRulesAPI: true}},
		{name: "teams", flag: featuremgmt.FlagKubernetesTeamsApi, want: Features{TeamsAPI: true}},
		{name: "users", flag: featuremgmt.FlagKubernetesUsersApi, want: Features{UsersAPI: true}},
		{name: "service accounts", flag: featuremgmt.FlagKubernetesServiceAccountsApi, want: Features{ServiceAccountsAPI: true}},
		{name: "service account tokens", flag: featuremgmt.FlagKubernetesServiceAccountTokensApi, want: Features{ServiceAccountTokensAPI: true}},
		{name: "SSO settings", flag: featuremgmt.FlagKubernetesSsoSettingsApi, want: Features{SSOSettingsAPI: true}},
		{name: "auth info", flag: featuremgmt.FlagKubernetesAuthInfoApi, want: Features{AuthInfoAPI: true}},
		{name: "user permissions", flag: featuremgmt.FlagAuthzUserPermissions, want: Features{UserPermissionsAPI: true}},
		{name: "service account resource permissions", flag: featuremgmt.FlagKubernetesAuthzServiceAccountResourcePermissions, want: Features{ServiceAccountResourcePermissions: true}},
		{name: "Zanzana sync", flag: featuremgmt.FlagKubernetesAuthzZanzanaSync, want: Features{ZanzanaSync: true}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			flags := map[string]memprovider.InMemoryFlag{}
			if tt.flag != "" {
				flags[tt.flag] = memprovider.InMemoryFlag{Key: tt.flag, DefaultVariant: "enabled", Variants: map[string]any{"enabled": true}}
			}
			require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(flags)))
			t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })

			require.Equal(t, tt.want, FeaturesFromFlags(context.Background(), openfeature.NewDefaultClient()))
		})
	}
}

func TestFeaturesFromFlagsResolvesOnce(t *testing.T) {
	flag := featuremgmt.FlagKubernetesAuthzRolesApi
	provider := memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		flag: {Key: flag, DefaultVariant: "enabled", Variants: map[string]any{"enabled": true}},
	})
	require.NoError(t, openfeature.SetProviderAndWait(provider))
	t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })

	got := FeaturesFromFlags(context.Background(), openfeature.NewDefaultClient())
	require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{}))
	require.True(t, got.RolesAPI)
}

func TestResolveFeaturesExplicitConfigurationDoesNotEvaluateLegacyFlags(t *testing.T) {
	configured := Features{UsersAPI: true}

	// A nil client would panic if ResolveFeatures attempted legacy evaluation.
	got := ResolveFeatures(context.Background(), &configured, nil)

	require.Equal(t, configured, got)
}

func TestFeaturesFromFlagsExcludesRuntimeFlags(t *testing.T) {
	flags := map[string]memprovider.InMemoryFlag{}
	for _, flag := range []string{
		featuremgmt.FlagKubernetesTeamsRedirect,
		featuremgmt.FlagTeamHttpHeadersTempo,
	} {
		flags[flag] = memprovider.InMemoryFlag{
			Key:            flag,
			DefaultVariant: "enabled",
			Variants:       map[string]any{"enabled": true},
		}
	}
	require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(flags)))
	t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })

	require.Equal(t, Features{}, FeaturesFromFlags(context.Background(), openfeature.NewDefaultClient()))
}
