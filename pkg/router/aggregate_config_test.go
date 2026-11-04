package router

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/setting"
)

func TestCompileGroupPatterns(t *testing.T) {
	patterns := compileGroupPatterns([]string{"*.grafana.app", "*.grafana.com"})

	require.True(t, matchesAnyPattern("dashboard.grafana.app", patterns))
	require.True(t, matchesAnyPattern("billing.grafana.com", patterns))
	require.False(t, matchesAnyPattern("apps", patterns))
	require.False(t, matchesAnyPattern("coordination.k8s.io", patterns))
}

func TestCompileGroupPatterns_DotsAreLiteral(t *testing.T) {
	// Regression test: dots in the pattern must match literal dots, not any character.
	// *.grafana.app should NOT match evilXgrafanaXapp (where X is any non-dot).
	patterns := compileGroupPatterns([]string{"*.grafana.app"})

	require.True(t, matchesAnyPattern("dashboard.grafana.app", patterns))
	require.False(t, matchesAnyPattern("evilXgrafanaXapp", patterns), "pattern must not treat . as wildcard")
}

func TestMatchesAnyPattern_EmptyMeansMatchAll(t *testing.T) {
	require.True(t, matchesAnyPattern("anything.at.all", nil))
}

func TestCompileGroupPatterns_RegexMetacharactersAreLiteral(t *testing.T) {
	// Regression test: only "*" is special. Escaping just "." left every other
	// regex metacharacter live, so "*.grafana+app" compiled to
	// ^.*\.grafana+app$ and over-matched "x.grafanaaaapp" -- the wrong
	// direction for a narrowing allowlist.
	patterns := compileGroupPatterns([]string{"*.grafana+app"})

	require.False(t, matchesAnyPattern("dashboard.grafanaaaapp", patterns), "+ must not act as a regex quantifier")
	require.False(t, matchesAnyPattern("dashboard.grafanaapp", patterns), "+ must not act as a regex quantifier")
	require.True(t, matchesAnyPattern("dashboard.grafana+app", patterns), "the literal pattern must still match itself")
}

// TestCompileGroupPatterns_NoPatternFailsToCompile documents the guarantee
// that replaced the old invalid-pattern test: regexp.QuoteMeta always emits a
// valid literal, so glob compilation is total -- input that looks like broken
// regex syntax is just a literal group name, never a compile error.
func TestCompileGroupPatterns_NoPatternFailsToCompile(t *testing.T) {
	patterns := compileGroupPatterns([]string{"[unterminated"})
	require.Len(t, patterns, 1)

	require.True(t, matchesAnyPattern("[unterminated", patterns))
	require.False(t, matchesAnyPattern("unterminated", patterns))
	require.False(t, matchesAnyPattern("u", patterns))
}

func addAggregateSection(t *testing.T, cfg *setting.Cfg, name string, values map[string]string) {
	t.Helper()
	section, err := cfg.Raw.NewSection(aggregateSectionPrefix + name)
	require.NoError(t, err)
	for key, value := range values {
		_, err := section.NewKey(key, value)
		require.NoError(t, err)
	}
}

func TestParseAggregateTargets(t *testing.T) {
	cfg := setting.NewCfg()
	var err error
	cfg.Raw, err = ini.Load([]byte(`
[router]
[router.aggregate.z_first]
url = https://first.invalid
audience = first
poll_interval = 10m
group_patterns = '*.ext.grafana.app, *.grafana.com'
ca_file = /etc/certs/first.crt
[unrelated]
url = https://ignored.invalid
[router.aggregate.a_second]
url = https://second.invalid
audience = second
insecure = true
[router.aggregate.disabled]
audience = disabled
`))
	require.NoError(t, err)
	targets, err := parseAggregateTargets(cfg)
	require.NoError(t, err)
	require.Equal(t, []aggregateTargetConfig{
		{Name: "z_first", URL: "https://first.invalid", Audience: "first", PollInterval: 10 * time.Minute, GroupPatterns: []string{"*.ext.grafana.app", "*.grafana.com"}, CAFile: "/etc/certs/first.crt"},
		{Name: "a_second", URL: "https://second.invalid", Audience: "second", PollInterval: defaultAggregatePollInterval, InsecureSkipVerify: true},
	}, targets)
	target, err := newAggregateTarget(targets[0], nil, nil)
	require.NoError(t, err)
	now := time.Now()
	target.cooldown.OnSuccess(now)
	require.Equal(t, 10*time.Minute, target.cooldown.Until(now))
}

func TestParseAggregateTargets_EnvOverrides(t *testing.T) {
	cfg := setting.NewCfg()
	addAggregateSection(t, cfg, "custom", map[string]string{"audience": "configured-audience"})
	t.Setenv("GF_ROUTER_AGGREGATE_CUSTOM_URL", "https://env.invalid")
	t.Setenv("GF_ROUTER_AGGREGATE_CUSTOM_AUDIENCE", "env-audience")
	t.Setenv("GF_ROUTER_AGGREGATE_CUSTOM_POLL_INTERVAL", "2m")
	t.Setenv("GF_ROUTER_AGGREGATE_CUSTOM_INSECURE", "true")
	targets, err := parseAggregateTargets(cfg)
	require.NoError(t, err)
	require.Equal(t, []aggregateTargetConfig{{Name: "custom", URL: "https://env.invalid", Audience: "env-audience", PollInterval: 2 * time.Minute, InsecureSkipVerify: true}}, targets)
}

func TestParseAggregateTargets_Auth(t *testing.T) {
	cfg := setting.NewCfg()
	addAggregateSection(t, cfg, "open", map[string]string{"url": "https://open.invalid", "discovery_auth": "none"})
	addAggregateSection(t, cfg, "signed", map[string]string{"url": "https://signed.invalid", "discovery_auth": "cap_token", "audience": "signed"})
	addAggregateSection(t, cfg, "bearer", map[string]string{"url": "https://bearer.invalid", "discovery_auth": "bearer", "audience": "bearer"})
	targets, err := parseAggregateTargets(cfg)
	require.NoError(t, err)
	require.Equal(t, []aggregateTargetConfig{
		{Name: "open", URL: "https://open.invalid", DiscoveryAuth: discoveryAuthNone, PollInterval: defaultAggregatePollInterval},
		{Name: "signed", URL: "https://signed.invalid", Audience: "signed", DiscoveryAuth: discoveryAuthCAPToken, PollInterval: defaultAggregatePollInterval},
		{Name: "bearer", URL: "https://bearer.invalid", Audience: "bearer", DiscoveryAuth: discoveryAuthBearer, PollInterval: defaultAggregatePollInterval},
	}, targets)
}

func TestParseAggregateTargets_GroupPatterns(t *testing.T) {
	for name, tc := range map[string]struct {
		values map[string]string
		want   []string
	}{
		"group_patterns":            {values: map[string]string{"group_patterns": "*.ext.grafana.app"}, want: []string{"*.ext.grafana.app"}},
		"deprecated group_regex":    {values: map[string]string{"group_regex": "*.ext.grafana.app"}, want: []string{"*.ext.grafana.app"}},
		"both, group_patterns wins": {values: map[string]string{"group_patterns": "*.a", "group_regex": "*.b"}, want: []string{"*.a"}},
	} {
		t.Run(name, func(t *testing.T) {
			cfg := setting.NewCfg()
			tc.values["url"] = "https://example.invalid"
			tc.values["discovery_auth"] = "none"
			addAggregateSection(t, cfg, "custom", tc.values)
			targets, err := parseAggregateTargets(cfg)
			require.NoError(t, err)
			require.Len(t, targets, 1)
			require.Equal(t, tc.want, targets[0].GroupPatterns)
		})
	}
}

func TestParseAggregateTargets_InvalidAuth(t *testing.T) {
	for name, values := range map[string]map[string]string{
		"unknown value":      {"url": "https://example.invalid", "discovery_auth": "basic"},
		"none with audience": {"url": "https://example.invalid", "discovery_auth": "none", "audience": "x"},
	} {
		t.Run(name, func(t *testing.T) {
			cfg := setting.NewCfg()
			addAggregateSection(t, cfg, "custom", values)
			_, err := parseAggregateTargets(cfg)
			require.ErrorContains(t, err, "router.aggregate.custom: ")
			require.ErrorContains(t, err, "discovery_auth")
		})
	}
}

func TestParseAggregateTargets_InvalidPollInterval(t *testing.T) {
	for _, value := range []string{"invalid", "0s", "-1m"} {
		t.Run(value, func(t *testing.T) {
			cfg := setting.NewCfg()
			addAggregateSection(t, cfg, "custom", map[string]string{"url": "https://example.invalid", "poll_interval": value})
			_, err := parseAggregateTargets(cfg)
			require.ErrorContains(t, err, "router.aggregate.custom: poll_interval must be a positive duration")
		})
	}
}

func TestParseAggregateTargets_NoneConfigured(t *testing.T) {
	targets, err := parseAggregateTargets(setting.NewCfg())
	require.NoError(t, err)
	require.Empty(t, targets)
}

func TestParseAggregateTargets_EmptyName(t *testing.T) {
	cfg := setting.NewCfg()
	addAggregateSection(t, cfg, "", map[string]string{"url": "https://example.invalid"})
	_, err := parseAggregateTargets(cfg)
	require.ErrorContains(t, err, "target name is required")
}
