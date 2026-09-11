package router

import (
	"testing"

	"github.com/stretchr/testify/require"
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

func TestCompileGroupPatterns_InvalidPattern(t *testing.T) {
	_, err := compileGroupPatterns([]string{"[unterminated"})
	require.Error(t, err)
}

func TestParseAggregateTargets(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{
		"baas_apiserver.url":                    "https://baas.example.invalid",
		"baas_apiserver.group_regex":            "*.grafana.app, *.grafana.com",
		"baas_apiserver.audience":               "baas",
		"cloud_app_platform_apiserver.url":      "https://cap.example.invalid",
		"cloud_app_platform_apiserver.audience": "cloud-app-platform",
	})
	section := cfg.SectionWithEnvOverrides(cloudRouterSection)

	targets, err := parseAggregateTargets(section)
	require.NoError(t, err)
	require.Len(t, targets, 2)

	byName := map[string]aggregateTargetConfig{}
	for _, target := range targets {
		byName[target.Name] = target
	}

	require.Equal(t, "https://baas.example.invalid", byName["baas_apiserver"].URL)
	require.Equal(t, "baas", byName["baas_apiserver"].Audience)
	require.Equal(t, []string{"*.grafana.app", "*.grafana.com"}, byName["baas_apiserver"].GroupPatterns)

	require.Equal(t, "https://cap.example.invalid", byName["cloud_app_platform_apiserver"].URL)
	require.Empty(t, byName["cloud_app_platform_apiserver"].GroupPatterns)
}

func TestParseAggregateTargets_NoneConfigured(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{})
	section := cfg.SectionWithEnvOverrides(cloudRouterSection)

	targets, err := parseAggregateTargets(section)
	require.NoError(t, err)
	require.Empty(t, targets)
}
