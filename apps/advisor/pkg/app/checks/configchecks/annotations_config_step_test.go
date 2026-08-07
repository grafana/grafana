package configchecks

import (
	"context"
	"slices"
	"testing"

	"github.com/grafana/grafana-app-sdk/logging"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestAnnotationsConfigStepRetentionTuned(t *testing.T) {
	// Explicitly set to a non-default value - no advisory.
	step := newAnnotationsStep(t, "720h")

	checkReportFailures, err := step.Run(context.Background(), logging.DefaultLogger, nil, annotationsRetentionTTLItem)
	require.NoError(t, err)
	require.Len(t, checkReportFailures, 0)
}

func TestAnnotationsConfigStepRetentionAtDefault(t *testing.T) {
	// Left at the shipped default (2160h) - advisory fires.
	step := newAnnotationsStep(t, "2160h")

	checkReportFailures, err := step.Run(context.Background(), logging.DefaultLogger, nil, annotationsRetentionTTLItem)
	require.NoError(t, err)
	requireRetentionAdvisory(t, checkReportFailures)
}

func TestAnnotationsConfigStepRetentionUnset(t *testing.T) {
	// Unset reads back as the default in the merged config - advisory fires.
	step := newAnnotationsStep(t, "")

	checkReportFailures, err := step.Run(context.Background(), logging.DefaultLogger, nil, annotationsRetentionTTLItem)
	require.NoError(t, err)
	requireRetentionAdvisory(t, checkReportFailures)
}

func TestAnnotationsConfigStepOtherItem(t *testing.T) {
	// Items other than the retention TTL are ignored by this step.
	step := newAnnotationsStep(t, "")

	checkReportFailures, err := step.Run(context.Background(), logging.DefaultLogger, nil, "security.secret_key")
	require.NoError(t, err)
	require.Len(t, checkReportFailures, 0)
}

func TestConfigCheckGatesAnnotationsStepWhenDisabled(t *testing.T) {
	// When the app platform annotations API is disabled, the step and item are not registered.
	cfg := setting.NewCfg()
	cfg.SectionWithEnvOverrides("annotations.app_platform").Key("enabled").SetValue("false")
	c := New(cfg)

	require.False(t, hasAnnotationsStep(c.Steps()))

	items, err := c.Items(context.Background())
	require.NoError(t, err)
	require.NotContains(t, items, annotationsRetentionTTLItem)
}

func TestConfigCheckIncludesAnnotationsStepWhenEnabled(t *testing.T) {
	// When the app platform annotations API is enabled, the step and item are registered.
	cfg := setting.NewCfg()
	cfg.SectionWithEnvOverrides("annotations.app_platform").Key("enabled").SetValue("true")
	c := New(cfg)

	require.True(t, hasAnnotationsStep(c.Steps()))

	items, err := c.Items(context.Background())
	require.NoError(t, err)
	require.Contains(t, items, annotationsRetentionTTLItem)
}

func newAnnotationsStep(t *testing.T, retention string) *annotationsConfigStep {
	t.Helper()
	cfg := setting.NewCfg()
	section := cfg.SectionWithEnvOverrides("annotations.app_platform")
	if retention != "" {
		section.Key("retention_ttl").SetValue(retention)
	}
	return &annotationsConfigStep{appPlatformSection: section}
}

// requireRetentionAdvisory asserts that exactly one retention advisory and its contents.
func requireRetentionAdvisory(t *testing.T, checkReportFailures []advisor.CheckReportFailure) {
	t.Helper()
	require.Len(t, checkReportFailures, 1)
	failure := checkReportFailures[0]
	require.Equal(t, advisor.CheckReportFailureSeverityLow, failure.Severity)
	require.Equal(t, "annotations_config", failure.StepID)
	require.Equal(t, "retention_ttl", failure.Item)
	require.Equal(t, annotationsRetentionTTLItem, failure.ItemID)
	require.Equal(t, []advisor.CheckErrorLink{
		{
			Message: "Evaluate default value",
			Url:     "https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#annotations",
		},
	}, failure.Links)
}

func hasAnnotationsStep(steps []checks.Step) bool {
	return slices.ContainsFunc(steps, func(s checks.Step) bool {
		_, ok := s.(*annotationsConfigStep)
		return ok
	})
}
