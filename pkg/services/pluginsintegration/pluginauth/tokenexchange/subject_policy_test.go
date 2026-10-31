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

func TestConfigureSubjectSigning(t *testing.T) {
	for _, tc := range []struct {
		name, enabled, permissions, maximum string
		wantEnabled                         bool
		wantMaximum                         time.Duration
		wantError                           string
	}{
		{name: "unset"},
		{name: "disabled", enabled: "false", permissions: "invalid", maximum: "invalid"},
		{name: "enabled", enabled: "true", permissions: "datasources:read datasources:write", wantEnabled: true},
		{name: "custom maximum", enabled: "true", permissions: "datasources:read datasources:write", maximum: "1h", wantEnabled: true, wantMaximum: time.Hour},
		{name: "invalid bool", enabled: "typo", wantError: "allow_subject_signing"},
		{name: "missing grant", enabled: "true", wantError: "requires delegated permissions"},
		{name: "wildcard grant", enabled: "true", permissions: "datasources:*", wantError: "concrete actions"},
		{name: "comma separated grant", enabled: "true", permissions: "datasources:read,datasources:write", wantError: "space-separated"},
		{name: "missing action verb", enabled: "true", permissions: "datasources:", wantError: "concrete actions"},
		{name: "missing action prefix", enabled: "true", permissions: ":read", wantError: "concrete actions"},
		{name: "missing colon", enabled: "true", permissions: "read", wantError: "concrete actions"},
		{name: "invalid maximum", enabled: "true", permissions: "datasources:read", maximum: "invalid", wantError: "subject_signing_max_token_lifetime"},
		{name: "maximum below default", enabled: "true", permissions: "datasources:read", maximum: "4m59s", wantError: "at least 5m0s"},
		{name: "fractional maximum", enabled: "true", permissions: "datasources:read", maximum: "5m0.5s", wantError: "whole seconds"},
		{name: "overflowing maximum", enabled: "true", permissions: "datasources:read", maximum: "9223372036854775807s", wantError: "subject_signing_max_token_lifetime"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			policy := policyFor("example-app", []string{"grafana"}, testManifest)
			original := policy
			err := configureSubjectSigning(&policy, map[string]string{
				"allow_subject_signing":              tc.enabled,
				"subject_signing_permissions":        tc.permissions,
				"subject_signing_max_token_lifetime": tc.maximum,
			})
			if tc.wantError != "" {
				require.ErrorContains(t, err, tc.wantError)
				require.Equal(t, original, policy, "invalid configuration must not grant subject signing")
				return
			}
			require.NoError(t, err)
			require.Equal(t, tc.wantEnabled, policy.AllowSubjectSigning)
			if !tc.wantEnabled {
				require.Equal(t, original, policy)
				return
			}
			require.Equal(t, []string{"datasources:read", "datasources:write"}, policy.DelegatedPermissions)
			require.Equal(t, tc.wantMaximum, policy.MaxSubjectTokenLifetime)
			require.Equal(t, original.Permissions, policy.Permissions)
			require.Equal(t, original.Audiences, policy.Audiences)
			require.Equal(t, "example-app", policy.PluginID)
		})
	}
}

func TestSubjectSettingsDoNotChangeLocalAuthAvailability(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagApppluginsLoadAppManifest)
	for _, tc := range []struct {
		name, jwksURL, enabled string
		protocol               setting.Scheme
		want                   pluginauth.Config
	}{
		{name: "external signer", jwksURL: "https://example.test/keys", protocol: setting.HTTPScheme, enabled: "true"},
		{name: "no exchange URL", protocol: setting.SocketScheme, enabled: "true", want: pluginauth.Config{Enabled: true}},
		{name: "invalid subject settings", protocol: setting.HTTPScheme, enabled: "invalid", want: pluginauth.Config{Enabled: true, APIURL: "http://127.0.0.1:33017", LoopbackOnly: true}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := &setting.Cfg{
				Protocol: tc.protocol, HTTPPort: "33017",
				ExtJWTAuth: setting.ExtJWTSettings{JWKSUrl: tc.jwksURL, Audiences: []string{"grafana"}},
				PluginSettings: config.PluginSettings{"example-app": {
					"allow_subject_signing":       tc.enabled,
					"subject_signing_permissions": "datasources:read",
				}},
			}
			got, err := pluginauth.ProvideConfig(cfg)
			require.NoError(t, err)
			require.Equal(t, &tc.want, got)
		})
	}
}
