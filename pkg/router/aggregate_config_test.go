package router

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/setting"
)

func TestCompileGroupPatterns(t *testing.T) {
	patterns, err := compileGroupPatterns([]string{"*.grafana.app", "*.grafana.com"})
	require.NoError(t, err)

	require.True(t, matchesAnyPattern("dashboard.grafana.app", patterns))
	require.True(t, matchesAnyPattern("billing.grafana.com", patterns))
	require.False(t, matchesAnyPattern("apps", patterns))
	require.False(t, matchesAnyPattern("coordination.k8s.io", patterns))
}

func TestCompileGroupPatterns_DotsAreLiteral(t *testing.T) {
	// Regression test: dots in the pattern must match literal dots, not any character.
	// *.grafana.app should NOT match evilXgrafanaXapp (where X is any non-dot).
	patterns, err := compileGroupPatterns([]string{"*.grafana.app"})
	require.NoError(t, err)

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
	patterns, err := compileGroupPatterns([]string{"*.grafana+app"})
	require.NoError(t, err)

	require.False(t, matchesAnyPattern("dashboard.grafanaaaapp", patterns), "+ must not act as a regex quantifier")
	require.False(t, matchesAnyPattern("dashboard.grafanaapp", patterns), "+ must not act as a regex quantifier")
	require.True(t, matchesAnyPattern("dashboard.grafana+app", patterns), "the literal pattern must still match itself")
}

// TestCompileGroupPatterns_NoPatternFailsToCompile documents the guarantee
// that replaced the old invalid-pattern test: regexp.QuoteMeta always emits a
// valid literal, so glob compilation is total -- input that looks like broken
// regex syntax is just a literal group name, never a compile error.
func TestCompileGroupPatterns_NoPatternFailsToCompile(t *testing.T) {
	patterns, err := compileGroupPatterns([]string{"[unterminated"})
	require.NoError(t, err)
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
group_regex = '*.ext.grafana.app, *.grafana.com'
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
	addAggregateSection(t, cfg, "custom", nil)
	t.Setenv("GF_ROUTER_AGGREGATE_CUSTOM_URL", "https://env.invalid")
	t.Setenv("GF_ROUTER_AGGREGATE_CUSTOM_AUDIENCE", "env-audience")
	t.Setenv("GF_ROUTER_AGGREGATE_CUSTOM_POLL_INTERVAL", "2m")
	t.Setenv("GF_ROUTER_AGGREGATE_CUSTOM_INSECURE", "true")
	targets, err := parseAggregateTargets(cfg)
	require.NoError(t, err)
	require.Equal(t, []aggregateTargetConfig{{Name: "custom", URL: "https://env.invalid", Audience: "env-audience", PollInterval: 2 * time.Minute, InsecureSkipVerify: true}}, targets)
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
