package tokenexchange

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginauth"
	"github.com/grafana/grafana/pkg/setting"
)

func TestConfigureUnattendedDelegation(t *testing.T) {
	for _, tc := range []struct {
		name, enabled, permissions, maximum string
		wantEnabled                         bool
		wantPermissions                     []string
		wantMaximum                         time.Duration
		wantError                           string
	}{
		{name: "unset"},
		{name: "disabled", enabled: "false", permissions: "invalid", maximum: "invalid"},
		{name: "enabled", enabled: "true", permissions: "dashboard.grafana.app/dashboards:get", wantEnabled: true, wantPermissions: []string{"dashboard.grafana.app/dashboards:get"}},
		{name: "custom maximum", enabled: "true", maximum: "1h", wantEnabled: true, wantMaximum: time.Hour},
		{name: "invalid bool", enabled: "typo", wantError: "allow_unattended_delegation"},
		{name: "omitted restriction retains manifest grant", enabled: "true", wantEnabled: true},
		{name: "blank restriction retains manifest grant", enabled: "true", permissions: " \t\n", wantEnabled: true},
		{name: "select existing wildcard grant", enabled: "true", permissions: "example.ext.grafana.app:*", wantEnabled: true, wantPermissions: []string{"example.ext.grafana.app:*"}},
		{name: "cannot add actions", enabled: "true", permissions: "users:write dashboard.grafana.app/dashboards:get", wantEnabled: true, wantPermissions: []string{"dashboard.grafana.app/dashboards:get"}},
		{name: "no overlap delegates nothing", enabled: "true", permissions: "users:write", wantEnabled: true, wantPermissions: []string{}},
		{name: "cannot broaden a resource grant", enabled: "true", permissions: "dashboard.grafana.app/dashboards:*", wantEnabled: true, wantPermissions: []string{}},
		{name: "comma separated grant", enabled: "true", permissions: "datasources:read,datasources:write", wantError: "space-separated"},
		{name: "missing action verb", enabled: "true", permissions: "datasources:", wantError: "space-separated actions"},
		{name: "missing action prefix", enabled: "true", permissions: ":read", wantError: "space-separated actions"},
		{name: "missing colon", enabled: "true", permissions: "read", wantError: "space-separated actions"},
		{name: "bare wildcard is not a grant", enabled: "true", permissions: "*", wantError: "space-separated actions"},
		{name: "invalid maximum", enabled: "true", permissions: "datasources:read", maximum: "invalid", wantError: "unattended_delegation_max_token_lifetime"},
		{name: "maximum below default", enabled: "true", permissions: "datasources:read", maximum: "4m59s", wantError: "at least 5m0s"},
		{name: "fractional maximum", enabled: "true", permissions: "datasources:read", maximum: "5m0.5s", wantError: "whole seconds"},
		{name: "overflowing maximum", enabled: "true", permissions: "datasources:read", maximum: "9223372036854775807s", wantError: "unattended_delegation_max_token_lifetime"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			policy := policyFor("example-app", []string{"grafana"}, testManifest)
			original := policy
			err := configureUnattendedDelegation(&policy, map[string]string{
				"allow_unattended_delegation":              tc.enabled,
				"unattended_delegation_permissions":        tc.permissions,
				"unattended_delegation_max_token_lifetime": tc.maximum,
			})
			if tc.wantError != "" {
				require.ErrorContains(t, err, tc.wantError)
				require.Equal(t, original, policy, "invalid configuration must not grant unattended delegation")
				return
			}
			require.NoError(t, err)
			require.Equal(t, tc.wantEnabled, policy.AllowUnattendedDelegation)
			if !tc.wantEnabled {
				require.Equal(t, original, policy)
				return
			}
			wantPermissions := tc.wantPermissions
			if wantPermissions == nil {
				wantPermissions = original.DelegatedPermissions
			}
			require.Equal(t, wantPermissions, policy.DelegatedPermissions)
			require.Equal(t, []string{
				"plugins.app:access", "example.ext.grafana.app:*",
				"dashboard.grafana.app/dashboards:get", "dashboard.grafana.app/dashboards:list", "folder.grafana.app/folders:get",
			}, original.DelegatedPermissions, "restriction must not mutate the original grant")
			require.Equal(t, tc.wantMaximum, policy.MaxUnattendedDelegationTokenLifetime)
			require.Equal(t, original.Permissions, policy.Permissions)
			require.Equal(t, original.Audiences, policy.Audiences)
			require.Equal(t, "example-app", policy.PluginID)
		})
	}
}

func TestUnattendedDelegationSettingsDoNotChangeLocalAuthAvailability(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagApppluginsLoadAppManifest)
	for _, tc := range []struct {
		name, jwksURL, enabled string
		protocol               setting.Scheme
		want                   pluginauth.Config
	}{
		{name: "external signer", jwksURL: "https://example.test/keys", protocol: setting.HTTPScheme, enabled: "true"},
		{name: "no exchange URL", protocol: setting.SocketScheme, enabled: "true", want: pluginauth.Config{Enabled: true}},
		{name: "invalid unattended delegation settings", protocol: setting.HTTPScheme, enabled: "invalid", want: pluginauth.Config{Enabled: true, APIURL: "http://127.0.0.1:33017", LoopbackOnly: true}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := &setting.Cfg{
				Protocol: tc.protocol, HTTPPort: "33017",
				ExtJWTAuth: setting.ExtJWTSettings{JWKSUrl: tc.jwksURL, Audiences: []string{"grafana"}},
				PluginSettings: config.PluginSettings{"example-app": {
					"allow_unattended_delegation":       tc.enabled,
					"unattended_delegation_permissions": "datasources:read",
				}},
			}
			got, err := pluginauth.ProvideConfig(cfg)
			require.NoError(t, err)
			require.Equal(t, &tc.want, got)
		})
	}
}
