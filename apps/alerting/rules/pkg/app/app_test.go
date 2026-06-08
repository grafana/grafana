package app_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appsdk "github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"

	v1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/alertrule"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/config"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/recordingrule"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/rulesequence"
)

// funcMembershipResolver adapts a function to the RuleSequenceMembershipResolver
// interface for use in tests.
type funcMembershipResolver func(ctx context.Context, uids []string) (map[string]config.RuleSequenceMembership, error)

func (f funcMembershipResolver) Resolve(ctx context.Context, uids []string) (map[string]config.RuleSequenceMembership, error) {
	return f(ctx, uids)
}

func makeDefaultRuntimeConfig() config.RuntimeConfig {
	return config.RuntimeConfig{
		FolderValidator:        func(ctx context.Context, folderUID string) (bool, error) { return folderUID == "f1", nil },
		BaseEvaluationInterval: 60 * time.Second, // seconds
		ReservedLabelKeys:      map[string]struct{}{"__reserved__": {}, "grafana_folder": {}},
		NotificationSettingsValidator: func(ctx context.Context, notificationSettings v1.AlertRuleNotificationSettings) error {
			if notificationSettings.NamedRoutingTree != nil && notificationSettings.NamedRoutingTree.RoutingTree == "policy-ok" {
				return nil
			}

			if notificationSettings.SimplifiedRouting != nil && notificationSettings.SimplifiedRouting.Receiver == "notif-ok" {
				return nil
			}

			return errors.New("validation error")
		},
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
		Title:        "ok",
		Trigger:      v1.AlertRuleIntervalTrigger{Interval: v1.AlertRulePromDuration("60s")},
		Expressions:  v1.AlertRuleExpressionMap{"A": v1.AlertRuleExpression{Model: map[string]any{"expr": "1"}, Source: new(true)}},
		NoDataState:  v1.DefaultNoDataState,
		ExecErrState: v1.DefaultExecErrState,
		NotificationSettings: &v1.AlertRuleNotificationSettings{
			SimplifiedRouting: &v1.AlertRuleSimplifiedRouting{
				Type:     v1.AlertRuleNotificationSettingsTypeSimplifiedRouting,
				Receiver: "notif-ok",
			},
		},
	}

	req := &appsdk.AdmissionRequest{Action: resource.AdmissionActionCreate, Object: r}
	validator := alertrule.NewValidator(makeDefaultRuntimeConfig())
	require.NoError(t, validator.Validate(context.Background(), req))
}

func TestAlertRuleValidation_SuccessWithNamedRoutingTree(t *testing.T) {
	r := baseAlertRule()
	r.Spec.NotificationSettings = &v1.AlertRuleNotificationSettings{
		NamedRoutingTree: &v1.AlertRuleNamedRoutingTree{
			Type:        v1.AlertRuleNotificationSettingsTypeNamedRoutingTree,
			RoutingTree: "policy-ok",
		},
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
				Source:        new(true),
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
				Source:        new(true),
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
				Source: new(true),
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
		r.Spec.NotificationSettings = &v1.AlertRuleNotificationSettings{
			SimplifiedRouting: &v1.AlertRuleSimplifiedRouting{
				Type:     v1.AlertRuleNotificationSettingsTypeSimplifiedRouting,
				Receiver: "bad",
			},
		}
	}), "want invalid receiver error")
	assert.Error(t, mk(func(r *v1.AlertRule) {
		r.Spec.NotificationSettings = &v1.AlertRuleNotificationSettings{
			NamedRoutingTree: &v1.AlertRuleNamedRoutingTree{
				Type:        v1.AlertRuleNotificationSettingsTypeNamedRoutingTree,
				RoutingTree: "bad-policy",
			},
		}
	}), "want invalid routing tree error")
	assert.Error(t, mk(func(r *v1.AlertRule) {
		r.Spec.NotificationSettings = &v1.AlertRuleNotificationSettings{
			NamedRoutingTree: &v1.AlertRuleNamedRoutingTree{
				Type:        v1.AlertRuleNotificationSettingsTypeNamedRoutingTree,
				RoutingTree: "",
			},
		}
	}), "want empty routing tree error")
	assert.Error(t, mk(func(r *v1.AlertRule) { r.Labels[v1.GroupLabelKey] = "grp" }), "want group set on create error")
	assert.Error(t, mk(func(r *v1.AlertRule) { r.Spec.For = new("-10s") }), "want for>=0 error")
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
			"A": v1.AlertRuleExpression{Model: map[string]any{"expr": "1"}, Source: new(true)},
			"B": v1.AlertRuleExpression{Model: map[string]any{"expr": "2"}, Source: new(true)},
		}
	}), "want multiple source expressions error")
	// Expression validation: non-expression query without relative time range
	assert.Error(t, mk(func(r *v1.AlertRule) {
		dsUID := v1.AlertRuleDatasourceUID("prometheus")
		r.Spec.Expressions = v1.AlertRuleExpressionMap{
			"A": v1.AlertRuleExpression{Model: map[string]any{"expr": "1"}, Source: new(true), DatasourceUID: &dsUID},
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
		Expressions:  v1.AlertRuleExpressionMap{"A": v1.AlertRuleExpression{Model: map[string]any{"expr": "1"}, Source: new(true)}},
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
		Expressions:         v1.RecordingRuleExpressionMap{"A": v1.RecordingRuleExpression{Model: map[string]any{"expr": "1"}, Source: new(true)}},
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
				Source:        new(true),
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
				Source:        new(true),
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
				Source: new(true),
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
			"A": v1.RecordingRuleExpression{Model: map[string]any{"expr": "1"}, Source: new(true)},
			"B": v1.RecordingRuleExpression{Model: map[string]any{"expr": "2"}, Source: new(true)},
		}
	}), "want multiple source expressions error")
	// Expression validation: non-expression query without relative time range
	assert.Error(t, mk(func(r *v1.RecordingRule) {
		dsUID := v1.RecordingRuleDatasourceUID("prometheus")
		r.Spec.Expressions = v1.RecordingRuleExpressionMap{
			"A": v1.RecordingRuleExpression{Model: map[string]any{"expr": "1"}, Source: new(true), DatasourceUID: &dsUID},
		}
	}), "want query expression requires relative time range error")
}

func TestAlertRuleValidation_DeleteAndMoveGuardrails(t *testing.T) {
	baseCfg := makeDefaultRuntimeConfig()
	baseCfg.FolderValidator = func(ctx context.Context, folderUID string) (bool, error) {
		return folderUID == "f1" || folderUID == "f2", nil
	}
	baseCfg.MembershipResolver = funcMembershipResolver(func(ctx context.Context, uids []string) (map[string]config.RuleSequenceMembership, error) {
		out := map[string]config.RuleSequenceMembership{}
		for _, uid := range uids {
			if uid == "uid-1" {
				out[uid] = config.RuleSequenceMembership{SequenceUID: "seq-1", Found: true}
			} else {
				out[uid] = config.RuleSequenceMembership{}
			}
		}
		return out, nil
	})

	v := alertrule.NewValidator(baseCfg)

	t.Run("delete blocked when rule is in sequence", func(t *testing.T) {
		err := v.Validate(context.Background(), &appsdk.AdmissionRequest{
			Action:    resource.AdmissionActionDelete,
			OldObject: baseAlertRule(),
		})
		if err == nil {
			t.Fatalf("expected delete to be blocked")
		}
	})

	t.Run("folder move blocked when rule is in sequence", func(t *testing.T) {
		oldRule := baseAlertRule()
		newRule := baseAlertRule()
		newRule.Annotations[v1.FolderAnnotationKey] = "f2"

		err := v.Validate(context.Background(), &appsdk.AdmissionRequest{
			Action:    resource.AdmissionActionUpdate,
			Object:    newRule,
			OldObject: oldRule,
		})
		if err == nil {
			t.Fatalf("expected folder move to be blocked")
		}
	})
}

func TestRecordingRuleValidation_DeleteAndMoveGuardrails(t *testing.T) {
	baseCfg := makeDefaultRuntimeConfig()
	baseCfg.FolderValidator = func(ctx context.Context, folderUID string) (bool, error) {
		return folderUID == "f1" || folderUID == "f2", nil
	}
	baseCfg.MembershipResolver = funcMembershipResolver(func(ctx context.Context, uids []string) (map[string]config.RuleSequenceMembership, error) {
		out := map[string]config.RuleSequenceMembership{}
		for _, uid := range uids {
			if uid == "uid-1" {
				out[uid] = config.RuleSequenceMembership{SequenceUID: "seq-1", Found: true}
			} else {
				out[uid] = config.RuleSequenceMembership{}
			}
		}
		return out, nil
	})

	v := recordingrule.NewValidator(baseCfg)

	t.Run("delete blocked when rule is in sequence", func(t *testing.T) {
		err := v.Validate(context.Background(), &appsdk.AdmissionRequest{
			Action:    resource.AdmissionActionDelete,
			OldObject: baseRecordingRule(),
		})
		if err == nil {
			t.Fatalf("expected delete to be blocked")
		}
	})

	t.Run("folder move blocked when rule is in sequence", func(t *testing.T) {
		oldRule := baseRecordingRule()
		newRule := baseRecordingRule()
		newRule.Annotations[v1.FolderAnnotationKey] = "f2"

		err := v.Validate(context.Background(), &appsdk.AdmissionRequest{
			Action:    resource.AdmissionActionUpdate,
			Object:    newRule,
			OldObject: oldRule,
		})
		if err == nil {
			t.Fatalf("expected folder move to be blocked")
		}
	})
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
		Expressions:         v1.RecordingRuleExpressionMap{"A": v1.RecordingRuleExpression{Model: map[string]any{"expr": "1"}, Source: new(true)}},
		Metric:              "test_metric",
		TargetDatasourceUID: "ds1",
	}
	return r
}

// --- RuleSequence helpers ---

func baseRuleSequence() *v1.RuleSequence {
	r := &v1.RuleSequence{}
	r.SetGroupVersionKind(v1.RuleSequenceKind().GroupVersionKind())
	r.Name = "seq-1"
	r.Namespace = "ns1"
	r.Annotations = map[string]string{v1.FolderAnnotationKey: "f1"}
	r.Labels = map[string]string{}
	r.Spec = v1.RuleSequenceSpec{
		Trigger: v1.RuleSequenceIntervalTrigger{Interval: v1.RuleSequencePromDuration("60s")},
		RecordingRules: []v1.RuleSequenceRuleRef{
			{Name: "rec-1"},
		},
		AlertingRules: []v1.RuleSequenceRuleRef{
			{Name: "alert-1"},
		},
	}
	return r
}

func ruleSequenceRuntimeConfig() config.RuntimeConfig {
	cfg := makeDefaultRuntimeConfig()
	cfg.ResolveRuleRef = func(ctx context.Context, uid string) (config.RuleRef, bool, error) {
		switch uid {
		case "rec-1", "rec-2", "alert-1":
			return config.RuleRef{UID: uid, FolderUID: "f1"}, true, nil
		case "other-folder-rule":
			return config.RuleRef{UID: uid, FolderUID: "f2"}, true, nil
		default:
			return config.RuleRef{}, false, nil
		}
	}
	cfg.MembershipResolver = funcMembershipResolver(func(ctx context.Context, uids []string) (map[string]config.RuleSequenceMembership, error) {
		out := make(map[string]config.RuleSequenceMembership, len(uids))
		for _, uid := range uids {
			out[uid] = config.RuleSequenceMembership{}
		}
		return out, nil
	})
	return cfg
}

func TestRuleSequenceValidation_Success(t *testing.T) {
	r := baseRuleSequence()
	req := &appsdk.AdmissionRequest{Action: resource.AdmissionActionCreate, Object: r}
	validator := rulesequence.NewValidator(ruleSequenceRuntimeConfig())
	require.NoError(t, validator.Validate(context.Background(), req))
}

func TestRuleSequenceValidation_Errors(t *testing.T) {
	cfg := ruleSequenceRuntimeConfig()

	mk := func(mut func(r *v1.RuleSequence)) error {
		r := baseRuleSequence()
		mut(r)
		return rulesequence.NewValidator(cfg).Validate(context.Background(), &appsdk.AdmissionRequest{Action: resource.AdmissionActionCreate, Object: r})
	}

	t.Run("missing folder", func(t *testing.T) {
		err := mk(func(r *v1.RuleSequence) { r.Annotations = nil })
		require.Error(t, err)
	})

	t.Run("folder does not exist", func(t *testing.T) {
		err := mk(func(r *v1.RuleSequence) { r.Annotations[v1.FolderAnnotationKey] = "bad" })
		require.Error(t, err)
	})

	t.Run("bad interval", func(t *testing.T) {
		err := mk(func(r *v1.RuleSequence) { r.Spec.Trigger.Interval = v1.RuleSequencePromDuration("30s") })
		require.Error(t, err)
	})

	t.Run("empty recording rules nil", func(t *testing.T) {
		err := mk(func(r *v1.RuleSequence) { r.Spec.RecordingRules = nil })
		require.Error(t, err)
	})

	t.Run("empty recording rules empty slice", func(t *testing.T) {
		err := mk(func(r *v1.RuleSequence) { r.Spec.RecordingRules = []v1.RuleSequenceRuleRef{} })
		require.Error(t, err)
	})

	t.Run("empty name in ref", func(t *testing.T) {
		err := mk(func(r *v1.RuleSequence) {
			r.Spec.RecordingRules = []v1.RuleSequenceRuleRef{{Name: ""}}
		})
		require.Error(t, err)
	})

	t.Run("duplicate name", func(t *testing.T) {
		err := mk(func(r *v1.RuleSequence) {
			r.Spec.RecordingRules = []v1.RuleSequenceRuleRef{{Name: "rec-1"}}
			r.Spec.AlertingRules = []v1.RuleSequenceRuleRef{{Name: "rec-1"}}
		})
		require.Error(t, err)
	})

	t.Run("rule does not exist", func(t *testing.T) {
		err := mk(func(r *v1.RuleSequence) {
			r.Spec.RecordingRules = []v1.RuleSequenceRuleRef{{Name: "nonexistent"}}
		})
		require.Error(t, err)
	})

	t.Run("rule in wrong folder", func(t *testing.T) {
		err := mk(func(r *v1.RuleSequence) {
			r.Spec.RecordingRules = []v1.RuleSequenceRuleRef{{Name: "other-folder-rule"}}
			r.Spec.AlertingRules = nil
		})
		require.Error(t, err)
	})

	t.Run("invalid provenance", func(t *testing.T) {
		err := mk(func(r *v1.RuleSequence) {
			r.Annotations[v1.ProvenanceStatusAnnotationKey] = "invalid-provenance"
		})
		require.Error(t, err)
	})

	t.Run("valid non-empty provenance accepted", func(t *testing.T) {
		err := mk(func(r *v1.RuleSequence) {
			r.Annotations[v1.ProvenanceStatusAnnotationKey] = v1.ProvenanceStatusAPI
		})
		require.NoError(t, err)
	})
}

func TestRuleSequenceValidation_MembershipGuardrails(t *testing.T) {
	cfg := ruleSequenceRuntimeConfig()
	// Override membership resolver: rec-1 already belongs to seq-other
	cfg.MembershipResolver = funcMembershipResolver(func(ctx context.Context, uids []string) (map[string]config.RuleSequenceMembership, error) {
		out := make(map[string]config.RuleSequenceMembership, len(uids))
		for _, uid := range uids {
			if uid == "rec-1" {
				out[uid] = config.RuleSequenceMembership{SequenceUID: "seq-other", Found: true}
			} else {
				out[uid] = config.RuleSequenceMembership{}
			}
		}
		return out, nil
	})

	t.Run("create blocked when rule belongs to another sequence", func(t *testing.T) {
		r := baseRuleSequence()
		err := rulesequence.NewValidator(cfg).Validate(context.Background(), &appsdk.AdmissionRequest{
			Action: resource.AdmissionActionCreate,
			Object: r,
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "seq-other")
	})

	t.Run("update allowed when rule belongs to same sequence", func(t *testing.T) {
		cfg2 := cfg
		cfg2.MembershipResolver = funcMembershipResolver(func(ctx context.Context, uids []string) (map[string]config.RuleSequenceMembership, error) {
			out := make(map[string]config.RuleSequenceMembership, len(uids))
			for _, uid := range uids {
				if uid == "rec-1" {
					// Same sequence as the object being validated (seq-1)
					out[uid] = config.RuleSequenceMembership{SequenceUID: "seq-1", Found: true}
				} else {
					out[uid] = config.RuleSequenceMembership{}
				}
			}
			return out, nil
		})
		r := baseRuleSequence()
		err := rulesequence.NewValidator(cfg2).Validate(context.Background(), &appsdk.AdmissionRequest{
			Action: resource.AdmissionActionUpdate,
			Object: r,
		})
		require.NoError(t, err)
	})
}

func TestRuleSequenceMutation(t *testing.T) {
	cfg := makeDefaultRuntimeConfig()

	t.Run("folder label synced from annotation", func(t *testing.T) {
		r := baseRuleSequence()
		r.Labels = nil
		mutator := rulesequence.NewMutator(cfg)
		resp, err := mutator.Mutate(context.Background(), &appsdk.AdmissionRequest{
			Action: resource.AdmissionActionCreate,
			Object: r,
		})
		require.NoError(t, err)
		updated := resp.UpdatedObject.(*v1.RuleSequence)
		assert.Equal(t, "f1", updated.Labels[v1.FolderLabelKey])
	})

	t.Run("duration clamped", func(t *testing.T) {
		r := baseRuleSequence()
		r.Spec.Trigger.Interval = v1.RuleSequencePromDuration("120s")
		mutator := rulesequence.NewMutator(cfg)
		resp, err := mutator.Mutate(context.Background(), &appsdk.AdmissionRequest{
			Action: resource.AdmissionActionCreate,
			Object: r,
		})
		require.NoError(t, err)
		updated := resp.UpdatedObject.(*v1.RuleSequence)
		assert.Equal(t, "2m", string(updated.Spec.Trigger.Interval))
	})

	t.Run("no annotation no label", func(t *testing.T) {
		r := baseRuleSequence()
		r.Annotations = map[string]string{} // no folder annotation
		r.Labels = nil
		mutator := rulesequence.NewMutator(cfg)
		resp, err := mutator.Mutate(context.Background(), &appsdk.AdmissionRequest{
			Action: resource.AdmissionActionCreate,
			Object: r,
		})
		require.NoError(t, err)
		updated := resp.UpdatedObject.(*v1.RuleSequence)
		if updated.Labels != nil {
			assert.NotContains(t, updated.Labels, v1.FolderLabelKey)
		}
	})
}
