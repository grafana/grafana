package schemavalidation_test

import (
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	v1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	manifestdata "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/manifestdata"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/schemavalidation"
)

var gv = schema.GroupVersion{Group: "rules.alerting.grafana.app", Version: "v0alpha1"}

func buildValidators(t *testing.T) map[string]*schemavalidation.SpecValidator {
	t.Helper()
	validators, err := schemavalidation.BuildAll(*manifestdata.LocalManifest().ManifestData, gv)
	require.NoError(t, err)
	return validators
}

// causeFields asserts err is a 422 Invalid error and returns its cause field paths.
func causeFields(t *testing.T, err error) []string {
	t.Helper()
	require.Error(t, err)
	require.True(t, apierrors.IsInvalid(err), "expected Invalid error, got %v", err)
	var se *apierrors.StatusError
	require.ErrorAs(t, err, &se)
	require.Equal(t, int32(422), se.ErrStatus.Code)
	require.NotNil(t, se.ErrStatus.Details)
	fields := make([]string, 0, len(se.ErrStatus.Details.Causes))
	for _, c := range se.ErrStatus.Details.Causes {
		fields = append(fields, c.Field)
	}
	return fields
}

func validAlertRuleSpec() v1.AlertRuleSpec {
	return v1.AlertRuleSpec{
		Title:        "ok",
		Trigger:      v1.AlertRuleIntervalTrigger{Interval: v1.AlertRulePromDuration("60s")},
		Expressions:  v1.AlertRuleExpressionMap{"A": v1.AlertRuleExpression{Model: map[string]any{"expr": "1"}, Source: new(true)}},
		NoDataState:  v1.DefaultNoDataState,
		ExecErrState: v1.DefaultExecErrState,
	}
}

func TestBuildAll(t *testing.T) {
	validators := buildValidators(t)
	for _, kind := range []string{"AlertRule", "RecordingRule", "RuleSequence"} {
		require.NotNil(t, validators[kind], "missing validator for %s", kind)
	}
}

func TestValidateSpec_AlertRule(t *testing.T) {
	v := buildValidators(t)["AlertRule"]
	require.NotNil(t, v)

	t.Run("valid", func(t *testing.T) {
		require.NoError(t, v.ValidateOpenAPISpec("r1", validAlertRuleSpec()))
	})

	t.Run("invalid noDataState enum", func(t *testing.T) {
		spec := validAlertRuleSpec()
		spec.NoDataState = v1.AlertRuleNoDataState("Bogus")
		require.Contains(t, causeFields(t, v.ValidateOpenAPISpec("r1", spec)), "spec.noDataState")
	})

	t.Run("invalid execErrState enum", func(t *testing.T) {
		spec := validAlertRuleSpec()
		spec.ExecErrState = v1.AlertRuleExecErrState("Bogus")
		require.Contains(t, causeFields(t, v.ValidateOpenAPISpec("r1", spec)), "spec.execErrState")
	})

	t.Run("invalid datasourceUID pattern", func(t *testing.T) {
		spec := validAlertRuleSpec()
		badUID := v1.AlertRuleDatasourceUID("bad uid!")
		spec.Expressions = v1.AlertRuleExpressionMap{
			"A": v1.AlertRuleExpression{Model: map[string]any{"expr": "1"}, Source: new(true), DatasourceUID: &badUID},
		}
		require.Contains(t, causeFields(t, v.ValidateOpenAPISpec("r1", spec)), "spec.expressions.A.datasourceUID")
	})

	t.Run("invalid panelRef dashboardUID pattern", func(t *testing.T) {
		spec := validAlertRuleSpec()
		spec.PanelRef = &v1.AlertRulePanelRef{DashboardUID: "bad uid!", PanelID: 1}
		require.Contains(t, causeFields(t, v.ValidateOpenAPISpec("r1", spec)), "spec.panelRef.dashboardUID")
	})

	t.Run("negative missingSeriesEvalsToResolve", func(t *testing.T) {
		spec := validAlertRuleSpec()
		spec.MissingSeriesEvalsToResolve = new(int64(-1))
		require.Contains(t, causeFields(t, v.ValidateOpenAPISpec("r1", spec)), "spec.missingSeriesEvalsToResolve")
	})

	t.Run("multiple violations produce multiple causes", func(t *testing.T) {
		spec := validAlertRuleSpec()
		spec.NoDataState = v1.AlertRuleNoDataState("Bogus")
		spec.ExecErrState = v1.AlertRuleExecErrState("Bogus")
		fields := causeFields(t, v.ValidateOpenAPISpec("r1", spec))
		require.Contains(t, fields, "spec.noDataState")
		require.Contains(t, fields, "spec.execErrState")
	})
}

func TestValidateSpec_RecordingRule(t *testing.T) {
	v := buildValidators(t)["RecordingRule"]
	require.NotNil(t, v)

	validSpec := func() v1.RecordingRuleSpec {
		return v1.RecordingRuleSpec{
			Title:               "ok",
			Trigger:             v1.RecordingRuleIntervalTrigger{Interval: v1.RecordingRulePromDuration("60s")},
			Metric:              v1.RecordingRuleMetricName("my_metric"),
			Expressions:         v1.RecordingRuleExpressionMap{"A": v1.RecordingRuleExpression{Model: map[string]any{"expr": "1"}, Source: new(true)}},
			TargetDatasourceUID: v1.RecordingRuleDatasourceUID("ds-1"),
		}
	}

	t.Run("valid", func(t *testing.T) {
		require.NoError(t, v.ValidateOpenAPISpec("r1", validSpec()))
	})

	t.Run("invalid metric name pattern", func(t *testing.T) {
		spec := validSpec()
		spec.Metric = v1.RecordingRuleMetricName("1-bad-metric")
		require.Contains(t, causeFields(t, v.ValidateOpenAPISpec("r1", spec)), "spec.metric")
	})

	t.Run("invalid targetDatasourceUID pattern", func(t *testing.T) {
		spec := validSpec()
		spec.TargetDatasourceUID = v1.RecordingRuleDatasourceUID("bad uid!")
		require.Contains(t, causeFields(t, v.ValidateOpenAPISpec("r1", spec)), "spec.targetDatasourceUID")
	})
}

func TestValidateSpec_RuleSequence(t *testing.T) {
	v := buildValidators(t)["RuleSequence"]
	require.NotNil(t, v)

	t.Run("valid", func(t *testing.T) {
		spec := v1.RuleSequenceSpec{
			Trigger:        v1.RuleSequenceIntervalTrigger{Interval: v1.RuleSequencePromDuration("60s")},
			RecordingRules: []v1.RuleSequenceRuleRef{{Name: v1.RuleSequenceRuleUID("rule-1")}},
		}
		require.NoError(t, v.ValidateOpenAPISpec("seq1", spec))
	})

	t.Run("invalid rule ref name pattern", func(t *testing.T) {
		spec := v1.RuleSequenceSpec{
			Trigger:        v1.RuleSequenceIntervalTrigger{Interval: v1.RuleSequencePromDuration("60s")},
			RecordingRules: []v1.RuleSequenceRuleRef{{Name: v1.RuleSequenceRuleUID("bad uid!")}},
		}
		require.Contains(t, causeFields(t, v.ValidateOpenAPISpec("seq1", spec)), "spec.recordingRules.0.name")
	})
}
