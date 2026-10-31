package pluginauth

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestSubjectPolicies(t *testing.T) {
	settings := func() map[string]string {
		return map[string]string{
			"allow_subject_signing":       "true",
			"subject_signing_permissions": "datasources:read datasources:write",
		}
	}
	parse := func(s map[string]string) error {
		_, err := subjectPolicies(&setting.Cfg{PluginSettings: config.PluginSettings{"obo-app": s}})
		return err
	}
	policies, err := subjectPolicies(&setting.Cfg{PluginSettings: config.PluginSettings{"obo-app": settings(), "other-app": {}}})
	require.NoError(t, err)
	require.Len(t, policies, 1)
	require.Equal(t, []string{"datasources:read", "datasources:write"}, policies["obo-app"].DelegatedPermissions)
	require.Zero(t, policies["obo-app"].MaxTokenLifetime)
	for _, value := range []string{"5m", "1h", "300s", "5m1s"} {
		s := settings()
		s["subject_signing_max_token_lifetime"] = value
		policies, err := subjectPolicies(&setting.Cfg{PluginSettings: config.PluginSettings{"obo-app": s}})
		require.NoError(t, err)
		want, err := time.ParseDuration(value)
		require.NoError(t, err)
		require.Equal(t, want, policies["obo-app"].MaxTokenLifetime)
	}
	for _, value := range []string{"0", "-1h", "4m59s", "300", "5m0.5s", "nonsense", "9223372036854775807s"} {
		s := settings()
		s["subject_signing_max_token_lifetime"] = value
		require.ErrorContains(t, parse(s), "subject_signing_max_token_lifetime", value)
	}
	for name, mutate := range map[string]func(map[string]string){
		"invalid bool":    func(s map[string]string) { s["allow_subject_signing"] = "typo" },
		"missing actions": func(s map[string]string) { delete(s, "subject_signing_permissions") },
		"wildcard action": func(s map[string]string) { s["subject_signing_permissions"] = "datasources:*" },
		"invalid action":  func(s map[string]string) { s["subject_signing_permissions"] = "read" },
	} {
		t.Run(name, func(t *testing.T) { s := settings(); mutate(s); require.Error(t, parse(s)) })
	}
	require.NoError(t, parse(map[string]string{"allow_subject_signing": "false"}))
	require.NoError(t, parse(nil))
}

func TestSubjectSigningRequiresLocalExchange(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagApppluginsLoadAppManifest)
	cfg := &setting.Cfg{
		Protocol: setting.HTTPScheme, HTTPPort: "33017",
		ExtJWTAuth: setting.ExtJWTSettings{Audiences: []string{"grafana"}},
		PluginSettings: config.PluginSettings{"obo-app": {
			"allow_subject_signing":       "true",
			"subject_signing_permissions": "datasources:read",
		}},
	}
	_, err := ProvideConfig(cfg)
	require.NoError(t, err)
	cfg.ExtJWTAuth.JWKSUrl = "https://example.test/keys"
	_, err = ProvideConfig(cfg)
	require.ErrorContains(t, err, "requires local plugin authentication")
	cfg.ExtJWTAuth.JWKSUrl = ""
	cfg.Protocol = setting.SocketScheme
	_, err = ProvideConfig(cfg)
	require.ErrorContains(t, err, "requires a reachable local exchange")
}
