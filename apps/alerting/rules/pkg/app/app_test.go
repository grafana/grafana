package app_test

import (
	"context"
	"testing"
	"time"

	appsdk "github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"

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
	if err := validator.Validate(context.Background(), req); err != nil {
		t.Fatalf("expected success, got error: %v", err)
	}
}

func TestAlertRuleValidation_Errors(t *testing.T) {
	mk := func(mut func(r *v1.AlertRule)) error {
		r := baseAlertRule()
		mut(r)
		return alertrule.NewValidator(makeDefaultRuntimeConfig()).Validate(context.Background(), &appsdk.AdmissionRequest{Action: resource.AdmissionActionCreate, Object: r})
	}

	if err := mk(func(r *v1.AlertRule) { r.Annotations = nil }); err == nil {
		t.Errorf("want folder required error")
	}
	if err := mk(func(r *v1.AlertRule) { r.Annotations[v1.FolderAnnotationKey] = "bad" }); err == nil {
		t.Errorf("want folder not exist error")
	}
	if err := mk(func(r *v1.AlertRule) { r.Spec.Trigger.Interval = v1.AlertRulePromDuration("30s") }); err == nil {
		t.Errorf("want base interval multiple error")
	}
	if err := mk(func(r *v1.AlertRule) {
		r.Spec.NotificationSettings = &v1.AlertRuleV0alpha1SpecNotificationSettings{Receiver: "bad"}
	}); err == nil {
		t.Errorf("want invalid receiver error")
	}
	if err := mk(func(r *v1.AlertRule) { r.Labels[v1.GroupLabelKey] = "grp" }); err == nil {
		t.Errorf("want group set on create error")
	}
	if err := mk(func(r *v1.AlertRule) { r.Spec.For = strPtr("-10s") }); err == nil {
		t.Errorf("want for>=0 error")
	}
	if err := mk(func(r *v1.AlertRule) {
		if r.Spec.Labels == nil {
			r.Spec.Labels = map[string]v1.AlertRuleTemplateString{}
		}
		r.Spec.Labels["__reserved__"] = v1.AlertRuleTemplateString("x")
	}); err == nil {
		t.Errorf("want reserved label key error")
	}
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
	if err := validator.Validate(context.Background(), req); err != nil {
		t.Fatalf("expected success, got error: %v", err)
	}
}

func TestRecordingRuleValidation_Errors(t *testing.T) {
	mk := func(mut func(r *v1.RecordingRule)) error {
		r := baseRecordingRule()
		mut(r)
		return recordingrule.NewValidator(makeDefaultRuntimeConfig()).Validate(context.Background(), &appsdk.AdmissionRequest{Action: resource.AdmissionActionCreate, Object: r})
	}

	if err := mk(func(r *v1.RecordingRule) { r.Annotations = nil }); err == nil {
		t.Errorf("want folder required error")
	}
	if err := mk(func(r *v1.RecordingRule) { r.Annotations[v1.FolderAnnotationKey] = "bad" }); err == nil {
		t.Errorf("want folder not exist error")
	}
	if err := mk(func(r *v1.RecordingRule) { r.Spec.Trigger.Interval = v1.RecordingRulePromDuration("30s") }); err == nil {
		t.Errorf("want base interval multiple error")
	}
	if err := mk(func(r *v1.RecordingRule) { r.Labels[v1.GroupLabelKey] = "grp" }); err == nil {
		t.Errorf("want group set on create error")
	}
	if err := mk(func(r *v1.RecordingRule) { r.Spec.Metric = "" }); err == nil {
		t.Errorf("want metric required error")
	}
	if err := mk(func(r *v1.RecordingRule) {
		if r.Spec.Labels == nil {
			r.Spec.Labels = map[string]v1.RecordingRuleTemplateString{}
		}
		r.Spec.Labels["__reserved__"] = v1.RecordingRuleTemplateString("x")
	}); err == nil {
		t.Errorf("want reserved label key error")
	}
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
