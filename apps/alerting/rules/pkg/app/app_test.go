package app_test

import (
	"context"
	"testing"
	"time"

	appsdk "github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	v1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/alertrule"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/config"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/recordingrule"
)

func makeDefaultRuntimeConfig() config.RuntimeConfig {
	return config.RuntimeConfig{
		FolderValidator:               func(ctx context.Context, folderUID string) (bool, error) { return folderUID == "f1", nil },
		BaseEvaluationInterval:        60 * time.Second, // seconds
		ReservedLabelKeys:             map[string]struct{}{"__reserved__": {}, "grafana_folder": {}},
		NotificationSettingsValidator: func(ctx context.Context, receiver string) (bool, error) { return receiver == "notif-ok", nil },
	}
}

func TestAlertRuleValidation_Success(t *testing.T) {
	r := &v1.AlertRule{}
	r.SetGroupVersionKind(v1.AlertRuleKind().GroupVersionKind())
	r.Name = "uid-1"
	r.Namespace = "ns1"
	r.Annotations = map[string]string{v1.FolderAnnotationKey: "f1"}
	r.Labels = map[string]string{}
	r.Spec = v1.AlertRuleSpec{
		Title:                "ok",
		Trigger:              v1.AlertRuleIntervalTrigger{Interval: v1.AlertRulePromDuration("60s")},
		Expressions:          v1.AlertRuleExpressionMap{"A": v1.AlertRuleExpression{Model: map[string]any{"expr": "1"}, Source: boolPtr(true)}},
		NoDataState:          v1.DefaultNoDataState,
		ExecErrState:         v1.DefaultExecErrState,
		NotificationSettings: &v1.AlertRuleV0alpha1SpecNotificationSettings{Receiver: "notif-ok"},
	}

	req := &appsdk.AdmissionRequest{Action: resource.AdmissionActionCreate, Object: r}
	validator := alertrule.NewValidator(makeDefaultRuntimeConfig())
	require.NoError(t, validator.Validate(context.Background(), req))
}

func TestAlertRuleValidation_SuccessWithDatasourceQuery(t *testing.T) {
	dsUID := v1.AlertRuleDatasourceUID("prometheus")
	r := &v1.AlertRule{}
	r.SetGroupVersionKind(v1.AlertRuleKind().GroupVersionKind())
	r.Name = "uid-1"
	r.Namespace = "ns1"
	r.Annotations = map[string]string{v1.FolderAnnotationKey: "f1"}
	r.Labels = map[string]string{}
	r.Spec = v1.AlertRuleSpec{
		Title:   "ok",
		Trigger: v1.AlertRuleIntervalTrigger{Interval: v1.AlertRulePromDuration("60s")},
		Expressions: v1.AlertRuleExpressionMap{
			"A": v1.AlertRuleExpression{
				Model:         map[string]any{"expr": "up"},
				Source:        boolPtr(true),
				DatasourceUID: &dsUID,
				RelativeTimeRange: &v1.AlertRuleRelativeTimeRange{
					From: v1.AlertRulePromDurationWMillis("600s"),
					To:   v1.AlertRulePromDurationWMillis("0s"),
				},
			},
		},
		NoDataState:  v1.DefaultNoDataState,
		ExecErrState: v1.DefaultExecErrState,
	}

	req := &appsdk.AdmissionRequest{Action: resource.AdmissionActionCreate, Object: r}
	validator := alertrule.NewValidator(makeDefaultRuntimeConfig())
	require.NoError(t, validator.Validate(context.Background(), req))
}

func TestAlertRuleValidation_SuccessWithExpressionDatasourceWithoutRelativeTimeRange(t *testing.T) {
	dsUID := v1.AlertRuleDatasourceUID("__expr__")
	r := &v1.AlertRule{}
	r.SetGroupVersionKind(v1.AlertRuleKind().GroupVersionKind())
	r.Name = "uid-1"
	r.Namespace = "ns1"
	r.Annotations = map[string]string{v1.FolderAnnotationKey: "f1"}
	r.Labels = map[string]string{}
	r.Spec = v1.AlertRuleSpec{
		Title:   "ok",
		Trigger: v1.AlertRuleIntervalTrigger{Interval: v1.AlertRulePromDuration("60s")},
		Expressions: v1.AlertRuleExpressionMap{
			"A": v1.AlertRuleExpression{
				Model:         map[string]any{"expr": "1"},
				Source:        boolPtr(true),
				DatasourceUID: &dsUID,
			},
		},
		NoDataState:  v1.DefaultNoDataState,
		ExecErrState: v1.DefaultExecErrState,
	}

	req := &appsdk.AdmissionRequest{Action: resource.AdmissionActionCreate, Object: r}
	validator := alertrule.NewValidator(makeDefaultRuntimeConfig())
	require.NoError(t, validator.Validate(context.Background(), req))
}

func TestAlertRuleValidation_SuccessWithoutDatasourceUIDWithoutRelativeTimeRange(t *testing.T) {
	r := &v1.AlertRule{}
	r.SetGroupVersionKind(v1.AlertRuleKind().GroupVersionKind())
	r.Name = "uid-1"
	r.Namespace = "ns1"
	r.Annotations = map[string]string{v1.FolderAnnotationKey: "f1"}
	r.Labels = map[string]string{}
	r.Spec = v1.AlertRuleSpec{
		Title:   "ok",
		Trigger: v1.AlertRuleIntervalTrigger{Interval: v1.AlertRulePromDuration("60s")},
		Expressions: v1.AlertRuleExpressionMap{
			"A": v1.AlertRuleExpression{
				Model:  map[string]any{"expr": "1"},
				Source: boolPtr(true),
			},
		},
		NoDataState:  v1.DefaultNoDataState,
		ExecErrState: v1.DefaultExecErrState,
	}

	req := &appsdk.AdmissionRequest{Action: resource.AdmissionActionCreate, Object: r}
	validator := alertrule.NewValidator(makeDefaultRuntimeConfig())
	require.NoError(t, validator.Validate(context.Background(), req))
}

func TestAlertRuleValidation_Errors(t *testing.T) {
	mk := func(mut func(r *v1.AlertRule)) error {
		r := baseAlertRule()
		mut(r)
		return alertrule.NewValidator(makeDefaultRuntimeConfig()).Validate(context.Background(), &appsdk.AdmissionRequest{Action: resource.AdmissionActionCreate, Object: r})
	}

	assert.Error(t, mk(func(r *v1.AlertRule) { r.Annotations = nil }), "want folder required error")
	assert.Error(t, mk(func(r *v1.AlertRule) { r.Annotations[v1.FolderAnnotationKey] = "bad" }), "want folder not exist error")
	assert.Error(t, mk(func(r *v1.AlertRule) { r.Spec.Trigger.Interval = v1.AlertRulePromDuration("30s") }), "want base interval multiple error")
	assert.Error(t, mk(func(r *v1.AlertRule) {
		r.Spec.NotificationSettings = &v1.AlertRuleV0alpha1SpecNotificationSettings{Receiver: "bad"}
	}), "want invalid receiver error")
	assert.Error(t, mk(func(r *v1.AlertRule) { r.Labels[v1.GroupLabelKey] = "grp" }), "want group set on create error")
	assert.Error(t, mk(func(r *v1.AlertRule) { r.Spec.For = strPtr("-10s") }), "want for>=0 error")
	assert.Error(t, mk(func(r *v1.AlertRule) {
		if r.Spec.Labels == nil {
			r.Spec.Labels = map[string]v1.AlertRuleTemplateString{}
		}
		r.Spec.Labels["__reserved__"] = v1.AlertRuleTemplateString("x")
	}), "want reserved label key error")
	// Expression validation: no source expression
	assert.Error(t, mk(func(r *v1.AlertRule) {
		r.Spec.Expressions = v1.AlertRuleExpressionMap{
			"A": v1.AlertRuleExpression{Model: map[string]any{"expr": "1"}},
		}
	}), "want no source expression error")
	// Expression validation: multiple source expressions
	assert.Error(t, mk(func(r *v1.AlertRule) {
		r.Spec.Expressions = v1.AlertRuleExpressionMap{
			"A": v1.AlertRuleExpression{Model: map[string]any{"expr": "1"}, Source: boolPtr(true)},
			"B": v1.AlertRuleExpression{Model: map[string]any{"expr": "2"}, Source: boolPtr(true)},
		}
	}), "want multiple source expressions error")
	// Expression validation: non-expression query without relative time range
	assert.Error(t, mk(func(r *v1.AlertRule) {
		dsUID := v1.AlertRuleDatasourceUID("prometheus")
		r.Spec.Expressions = v1.AlertRuleExpressionMap{
			"A": v1.AlertRuleExpression{Model: map[string]any{"expr": "1"}, Source: boolPtr(true), DatasourceUID: &dsUID},
		}
	}), "want query expression requires relative time range error")
}

func baseAlertRule() *v1.AlertRule {
	r := &v1.AlertRule{}
	r.SetGroupVersionKind(v1.AlertRuleKind().GroupVersionKind())
	r.Name = "uid-1"
	r.Namespace = "ns1"
	r.Annotations = map[string]string{v1.FolderAnnotationKey: "f1"}
	r.Labels = map[string]string{}
	r.Spec = v1.AlertRuleSpec{
		Title:        "ok",
		Trigger:      v1.AlertRuleIntervalTrigger{Interval: v1.AlertRulePromDuration("60s")},
		Expressions:  v1.AlertRuleExpressionMap{"A": v1.AlertRuleExpression{Model: map[string]any{"expr": "1"}, Source: boolPtr(true)}},
		NoDataState:  v1.DefaultNoDataState,
		ExecErrState: v1.DefaultExecErrState,
	}
	return r
}

func TestRecordingRuleValidation_Success(t *testing.T) {
	r := &v1.RecordingRule{}
	r.SetGroupVersionKind(v1.RecordingRuleKind().GroupVersionKind())
	r.Name = "uid-2"
	r.Namespace = "ns1"
	r.Annotations = map[string]string{v1.FolderAnnotationKey: "f1"}
	r.Labels = map[string]string{}
	r.Spec = v1.RecordingRuleSpec{
		Title:               "ok",
		Trigger:             v1.RecordingRuleIntervalTrigger{Interval: v1.RecordingRulePromDuration("60s")},
		Expressions:         v1.RecordingRuleExpressionMap{"A": v1.RecordingRuleExpression{Model: map[string]any{"expr": "1"}, Source: boolPtr(true)}},
		Metric:              "test_metric",
		TargetDatasourceUID: "ds1",
	}

	req := &appsdk.AdmissionRequest{Action: resource.AdmissionActionCreate, Object: r}
	validator := recordingrule.NewValidator(makeDefaultRuntimeConfig())
	require.NoError(t, validator.Validate(context.Background(), req))
}

func TestRecordingRuleValidation_SuccessWithDatasourceQuery(t *testing.T) {
	dsUID := v1.RecordingRuleDatasourceUID("prometheus")
	r := &v1.RecordingRule{}
	r.SetGroupVersionKind(v1.RecordingRuleKind().GroupVersionKind())
	r.Name = "uid-2"
	r.Namespace = "ns1"
	r.Annotations = map[string]string{v1.FolderAnnotationKey: "f1"}
	r.Labels = map[string]string{}
	r.Spec = v1.RecordingRuleSpec{
		Title:   "ok",
		Trigger: v1.RecordingRuleIntervalTrigger{Interval: v1.RecordingRulePromDuration("60s")},
		Expressions: v1.RecordingRuleExpressionMap{
			"A": v1.RecordingRuleExpression{
				Model:         map[string]any{"expr": "up"},
				Source:        boolPtr(true),
				DatasourceUID: &dsUID,
				RelativeTimeRange: &v1.RecordingRuleRelativeTimeRange{
					From: v1.RecordingRulePromDurationWMillis("600s"),
					To:   v1.RecordingRulePromDurationWMillis("0s"),
				},
			},
		},
		Metric:              "test_metric",
		TargetDatasourceUID: "ds1",
	}

	req := &appsdk.AdmissionRequest{Action: resource.AdmissionActionCreate, Object: r}
	validator := recordingrule.NewValidator(makeDefaultRuntimeConfig())
	require.NoError(t, validator.Validate(context.Background(), req))
}

func TestRecordingRuleValidation_SuccessWithExpressionDatasourceWithoutRelativeTimeRange(t *testing.T) {
	dsUID := v1.RecordingRuleDatasourceUID("__expr__")
	r := &v1.RecordingRule{}
	r.SetGroupVersionKind(v1.RecordingRuleKind().GroupVersionKind())
	r.Name = "uid-2"
	r.Namespace = "ns1"
	r.Annotations = map[string]string{v1.FolderAnnotationKey: "f1"}
	r.Labels = map[string]string{}
	r.Spec = v1.RecordingRuleSpec{
		Title:   "ok",
		Trigger: v1.RecordingRuleIntervalTrigger{Interval: v1.RecordingRulePromDuration("60s")},
		Expressions: v1.RecordingRuleExpressionMap{
			"A": v1.RecordingRuleExpression{
				Model:         map[string]any{"expr": "1"},
				Source:        boolPtr(true),
				DatasourceUID: &dsUID,
			},
		},
		Metric:              "test_metric",
		TargetDatasourceUID: "ds1",
	}

	req := &appsdk.AdmissionRequest{Action: resource.AdmissionActionCreate, Object: r}
	validator := recordingrule.NewValidator(makeDefaultRuntimeConfig())
	require.NoError(t, validator.Validate(context.Background(), req))
}

func TestRecordingRuleValidation_SuccessWithoutDatasourceUIDWithoutRelativeTimeRange(t *testing.T) {
	r := &v1.RecordingRule{}
	r.SetGroupVersionKind(v1.RecordingRuleKind().GroupVersionKind())
	r.Name = "uid-2"
	r.Namespace = "ns1"
	r.Annotations = map[string]string{v1.FolderAnnotationKey: "f1"}
	r.Labels = map[string]string{}
	r.Spec = v1.RecordingRuleSpec{
		Title:   "ok",
		Trigger: v1.RecordingRuleIntervalTrigger{Interval: v1.RecordingRulePromDuration("60s")},
		Expressions: v1.RecordingRuleExpressionMap{
			"A": v1.RecordingRuleExpression{
				Model:  map[string]any{"expr": "1"},
				Source: boolPtr(true),
			},
		},
		Metric:              "test_metric",
		TargetDatasourceUID: "ds1",
	}

	req := &appsdk.AdmissionRequest{Action: resource.AdmissionActionCreate, Object: r}
	validator := recordingrule.NewValidator(makeDefaultRuntimeConfig())
	require.NoError(t, validator.Validate(context.Background(), req))
}

func TestRecordingRuleValidation_Errors(t *testing.T) {
	mk := func(mut func(r *v1.RecordingRule)) error {
		r := baseRecordingRule()
		mut(r)
		return recordingrule.NewValidator(makeDefaultRuntimeConfig()).Validate(context.Background(), &appsdk.AdmissionRequest{Action: resource.AdmissionActionCreate, Object: r})
	}

	assert.Error(t, mk(func(r *v1.RecordingRule) { r.Annotations = nil }), "want folder required error")
	assert.Error(t, mk(func(r *v1.RecordingRule) { r.Annotations[v1.FolderAnnotationKey] = "bad" }), "want folder not exist error")
	assert.Error(t, mk(func(r *v1.RecordingRule) { r.Spec.Trigger.Interval = v1.RecordingRulePromDuration("30s") }), "want base interval multiple error")
	assert.Error(t, mk(func(r *v1.RecordingRule) { r.Labels[v1.GroupLabelKey] = "grp" }), "want group set on create error")
	assert.Error(t, mk(func(r *v1.RecordingRule) { r.Spec.Metric = "" }), "want metric required error")
	assert.Error(t, mk(func(r *v1.RecordingRule) {
		if r.Spec.Labels == nil {
			r.Spec.Labels = map[string]v1.RecordingRuleTemplateString{}
		}
		r.Spec.Labels["__reserved__"] = v1.RecordingRuleTemplateString("x")
	}), "want reserved label key error")
	// Expression validation: no source expression
	assert.Error(t, mk(func(r *v1.RecordingRule) {
		r.Spec.Expressions = v1.RecordingRuleExpressionMap{
			"A": v1.RecordingRuleExpression{Model: map[string]any{"expr": "1"}},
		}
	}), "want no source expression error")
	// Expression validation: multiple source expressions
	assert.Error(t, mk(func(r *v1.RecordingRule) {
		r.Spec.Expressions = v1.RecordingRuleExpressionMap{
			"A": v1.RecordingRuleExpression{Model: map[string]any{"expr": "1"}, Source: boolPtr(true)},
			"B": v1.RecordingRuleExpression{Model: map[string]any{"expr": "2"}, Source: boolPtr(true)},
		}
	}), "want multiple source expressions error")
	// Expression validation: non-expression query without relative time range
	assert.Error(t, mk(func(r *v1.RecordingRule) {
		dsUID := v1.RecordingRuleDatasourceUID("prometheus")
		r.Spec.Expressions = v1.RecordingRuleExpressionMap{
			"A": v1.RecordingRuleExpression{Model: map[string]any{"expr": "1"}, Source: boolPtr(true), DatasourceUID: &dsUID},
		}
	}), "want query expression requires relative time range error")
}

func baseRecordingRule() *v1.RecordingRule {
	r := &v1.RecordingRule{}
	r.SetGroupVersionKind(v1.RecordingRuleKind().GroupVersionKind())
	r.Name = "uid-1"
	r.Namespace = "ns1"
	r.Annotations = map[string]string{v1.FolderAnnotationKey: "f1"}
	r.Labels = map[string]string{}
	r.Spec = v1.RecordingRuleSpec{
		Title:               "ok",
		Trigger:             v1.RecordingRuleIntervalTrigger{Interval: v1.RecordingRulePromDuration("60s")},
		Expressions:         v1.RecordingRuleExpressionMap{"A": v1.RecordingRuleExpression{Model: map[string]any{"expr": "1"}, Source: boolPtr(true)}},
		Metric:              "test_metric",
		TargetDatasourceUID: "ds1",
	}
	return r
}

func boolPtr(b bool) *bool    { return &b }
func strPtr(s string) *string { return &s }
