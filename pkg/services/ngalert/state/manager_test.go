package state_test

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"sort"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/annotations/annotationstest"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/state/historian"
	"github.com/grafana/grafana/pkg/services/ngalert/tests"
	"github.com/grafana/grafana/pkg/util"
)

var testMetrics = metrics.NewNGAlert(prometheus.NewPedanticRegistry())

func TestWarmStateCache(t *testing.T) {
	evaluationTime, err := time.Parse("2006-01-02", "2021-03-25")
	require.NoError(t, err)
	ctx := context.Background()
	_, dbstore := tests.SetupTestEnv(t, 1)

	const mainOrgID int64 = 1
	rule := tests.CreateTestAlertRule(t, ctx, dbstore, 600, mainOrgID)

	expectedEntries := []*state.State{
		{
			AlertRuleUID: rule.UID,
			OrgID:        rule.OrgID,
			CacheID:      `[["test1","testValue1"]]`,
			Labels:       data.Labels{"test1": "testValue1"},
			State:        eval.Normal,
			Results: []state.Evaluation{
				{EvaluationTime: evaluationTime, EvaluationState: eval.Normal},
			},
			StartsAt:           evaluationTime.Add(-1 * time.Minute),
			EndsAt:             evaluationTime.Add(1 * time.Minute),
			LastEvaluationTime: evaluationTime,
			Annotations:        map[string]string{"testAnnoKey": "testAnnoValue"},
		}, {
			AlertRuleUID: rule.UID,
			OrgID:        rule.OrgID,
			CacheID:      `[["test2","testValue2"]]`,
			Labels:       data.Labels{"test2": "testValue2"},
			State:        eval.Alerting,
			Results: []state.Evaluation{
				{EvaluationTime: evaluationTime, EvaluationState: eval.Alerting},
			},
			StartsAt:           evaluationTime.Add(-1 * time.Minute),
			EndsAt:             evaluationTime.Add(1 * time.Minute),
			LastEvaluationTime: evaluationTime,
			Annotations:        map[string]string{"testAnnoKey": "testAnnoValue"},
		},
		{
			AlertRuleUID: rule.UID,
			OrgID:        rule.OrgID,
			CacheID:      `[["test3","testValue3"]]`,
			Labels:       data.Labels{"test3": "testValue3"},
			State:        eval.NoData,
			Results: []state.Evaluation{
				{EvaluationTime: evaluationTime, EvaluationState: eval.NoData},
			},
			StartsAt:           evaluationTime.Add(-1 * time.Minute),
			EndsAt:             evaluationTime.Add(1 * time.Minute),
			LastEvaluationTime: evaluationTime,
			Annotations:        map[string]string{"testAnnoKey": "testAnnoValue"},
		},
		{
			AlertRuleUID: rule.UID,
			OrgID:        rule.OrgID,
			CacheID:      `[["test4","testValue4"]]`,
			Labels:       data.Labels{"test4": "testValue4"},
			State:        eval.Error,
			Results: []state.Evaluation{
				{EvaluationTime: evaluationTime, EvaluationState: eval.Error},
			},
			StartsAt:           evaluationTime.Add(-1 * time.Minute),
			EndsAt:             evaluationTime.Add(1 * time.Minute),
			LastEvaluationTime: evaluationTime,
			Annotations:        map[string]string{"testAnnoKey": "testAnnoValue"},
		},
		{
			AlertRuleUID: rule.UID,
			OrgID:        rule.OrgID,
			CacheID:      `[["test5","testValue5"]]`,
			Labels:       data.Labels{"test5": "testValue5"},
			State:        eval.Pending,
			Results: []state.Evaluation{
				{EvaluationTime: evaluationTime, EvaluationState: eval.Pending},
			},
			StartsAt:           evaluationTime.Add(-1 * time.Minute),
			EndsAt:             evaluationTime.Add(1 * time.Minute),
			LastEvaluationTime: evaluationTime,
			Annotations:        map[string]string{"testAnnoKey": "testAnnoValue"},
		},
		{
			AlertRuleUID: rule.UID,
			OrgID:        rule.OrgID,
			CacheID:      `[["test6","testValue6"]]`,
			Labels:       data.Labels{"test6": "testValue6"},
			State:        eval.Alerting,
			StateReason:  models.StateReasonError,
			Results: []state.Evaluation{
				{EvaluationTime: evaluationTime, EvaluationState: eval.Alerting},
			},
			StartsAt:           evaluationTime.Add(-1 * time.Minute),
			EndsAt:             evaluationTime.Add(1 * time.Minute),
			LastEvaluationTime: evaluationTime,
			Annotations:        map[string]string{"testAnnoKey": "testAnnoValue"},
		},
		{
			AlertRuleUID: rule.UID,
			OrgID:        rule.OrgID,
			CacheID:      `[["test7","testValue7"]]`,
			Labels:       data.Labels{"test7": "testValue7"},
			State:        eval.Pending,
			StateReason:  models.StateReasonError,
			Results: []state.Evaluation{
				{EvaluationTime: evaluationTime, EvaluationState: eval.Pending},
			},
			StartsAt:           evaluationTime.Add(-1 * time.Minute),
			EndsAt:             evaluationTime.Add(1 * time.Minute),
			LastEvaluationTime: evaluationTime,
			Annotations:        map[string]string{"testAnnoKey": "testAnnoValue"},
		},
		{
			AlertRuleUID: rule.UID,
			OrgID:        rule.OrgID,
			CacheID:      `[["test8","testValue8"]]`,
			Labels:       data.Labels{"test8": "testValue8"},
			State:        eval.Normal,
			StateReason:  models.StateReasonError,
			Results: []state.Evaluation{
				{EvaluationTime: evaluationTime, EvaluationState: eval.Normal},
			},
			StartsAt:           evaluationTime.Add(-1 * time.Minute),
			EndsAt:             evaluationTime.Add(1 * time.Minute),
			LastEvaluationTime: evaluationTime,
			Annotations:        map[string]string{"testAnnoKey": "testAnnoValue"},
		},
		{
			AlertRuleUID: rule.UID,
			OrgID:        rule.OrgID,
			CacheID:      `[["test9","testValue9"]]`,
			Labels:       data.Labels{"test9": "testValue9"},
			State:        eval.Alerting,
			StateReason:  models.StateReasonNoData,
			Results: []state.Evaluation{
				{EvaluationTime: evaluationTime, EvaluationState: eval.Alerting},
			},
			StartsAt:           evaluationTime.Add(-1 * time.Minute),
			EndsAt:             evaluationTime.Add(1 * time.Minute),
			LastEvaluationTime: evaluationTime,
			Annotations:        map[string]string{"testAnnoKey": "testAnnoValue"},
		},
		{
			AlertRuleUID: rule.UID,
			OrgID:        rule.OrgID,
			CacheID:      `[["test10","testValue10"]]`,
			Labels:       data.Labels{"test10": "testValue10"},
			State:        eval.Normal,
			StateReason:  models.StateReasonNoData,
			Results: []state.Evaluation{
				{EvaluationTime: evaluationTime, EvaluationState: eval.Normal},
			},
			StartsAt:           evaluationTime.Add(-1 * time.Minute),
			EndsAt:             evaluationTime.Add(1 * time.Minute),
			LastEvaluationTime: evaluationTime,
			Annotations:        map[string]string{"testAnnoKey": "testAnnoValue"},
		},
	}

	instances := make([]models.AlertInstance, 0)

	labels := models.InstanceLabels{"test1": "testValue1"}
	_, hash, _ := labels.StringAndHash()
	instances = append(instances, models.AlertInstance{
		AlertInstanceKey: models.AlertInstanceKey{
			RuleOrgID:  rule.OrgID,
			RuleUID:    rule.UID,
			LabelsHash: hash,
		},
		CurrentState:      models.InstanceStateNormal,
		LastEvalTime:      evaluationTime,
		CurrentStateSince: evaluationTime.Add(-1 * time.Minute),
		CurrentStateEnd:   evaluationTime.Add(1 * time.Minute),
		Labels:            labels,
	})

	labels = models.InstanceLabels{"test2": "testValue2"}
	_, hash, _ = labels.StringAndHash()
	instances = append(instances, models.AlertInstance{
		AlertInstanceKey: models.AlertInstanceKey{
			RuleOrgID:  rule.OrgID,
			RuleUID:    rule.UID,
			LabelsHash: hash,
		},
		CurrentState:      models.InstanceStateFiring,
		LastEvalTime:      evaluationTime,
		CurrentStateSince: evaluationTime.Add(-1 * time.Minute),
		CurrentStateEnd:   evaluationTime.Add(1 * time.Minute),
		Labels:            labels,
	})

	labels = models.InstanceLabels{"test3": "testValue3"}
	_, hash, _ = labels.StringAndHash()
	instances = append(instances, models.AlertInstance{
		AlertInstanceKey: models.AlertInstanceKey{
			RuleOrgID:  rule.OrgID,
			RuleUID:    rule.UID,
			LabelsHash: hash,
		},
		CurrentState:      models.InstanceStateNoData,
		LastEvalTime:      evaluationTime,
		CurrentStateSince: evaluationTime.Add(-1 * time.Minute),
		CurrentStateEnd:   evaluationTime.Add(1 * time.Minute),
		Labels:            labels,
	})

	labels = models.InstanceLabels{"test4": "testValue4"}
	_, hash, _ = labels.StringAndHash()
	instances = append(instances, models.AlertInstance{
		AlertInstanceKey: models.AlertInstanceKey{
			RuleOrgID:  rule.OrgID,
			RuleUID:    rule.UID,
			LabelsHash: hash,
		},
		CurrentState:      models.InstanceStateError,
		LastEvalTime:      evaluationTime,
		CurrentStateSince: evaluationTime.Add(-1 * time.Minute),
		CurrentStateEnd:   evaluationTime.Add(1 * time.Minute),
		Labels:            labels,
	})

	labels = models.InstanceLabels{"test5": "testValue5"}
	_, hash, _ = labels.StringAndHash()
	instances = append(instances, models.AlertInstance{
		AlertInstanceKey: models.AlertInstanceKey{
			RuleOrgID:  rule.OrgID,
			RuleUID:    rule.UID,
			LabelsHash: hash,
		},
		CurrentState:      models.InstanceStatePending,
		LastEvalTime:      evaluationTime,
		CurrentStateSince: evaluationTime.Add(-1 * time.Minute),
		CurrentStateEnd:   evaluationTime.Add(1 * time.Minute),
		Labels:            labels,
	})

	labels = models.InstanceLabels{"test6": "testValue6"}
	_, hash, _ = labels.StringAndHash()
	instances = append(instances, models.AlertInstance{
		AlertInstanceKey: models.AlertInstanceKey{
			RuleOrgID:  rule.OrgID,
			RuleUID:    rule.UID,
			LabelsHash: hash,
		},
		CurrentState:      models.InstanceStateFiring,
		CurrentReason:     models.StateReasonError,
		LastEvalTime:      evaluationTime,
		CurrentStateSince: evaluationTime.Add(-1 * time.Minute),
		CurrentStateEnd:   evaluationTime.Add(1 * time.Minute),
		Labels:            labels,
	})

	labels = models.InstanceLabels{"test7": "testValue7"}
	_, hash, _ = labels.StringAndHash()
	instances = append(instances, models.AlertInstance{
		AlertInstanceKey: models.AlertInstanceKey{
			RuleOrgID:  rule.OrgID,
			RuleUID:    rule.UID,
			LabelsHash: hash,
		},
		CurrentState:      models.InstanceStatePending,
		CurrentReason:     models.StateReasonError,
		LastEvalTime:      evaluationTime,
		CurrentStateSince: evaluationTime.Add(-1 * time.Minute),
		CurrentStateEnd:   evaluationTime.Add(1 * time.Minute),
		Labels:            labels,
	})

	labels = models.InstanceLabels{"test8": "testValue8"}
	_, hash, _ = labels.StringAndHash()
	instances = append(instances, models.AlertInstance{
		AlertInstanceKey: models.AlertInstanceKey{
			RuleOrgID:  rule.OrgID,
			RuleUID:    rule.UID,
			LabelsHash: hash,
		},
		CurrentState:      models.InstanceStateNormal,
		CurrentReason:     models.StateReasonError,
		LastEvalTime:      evaluationTime,
		CurrentStateSince: evaluationTime.Add(-1 * time.Minute),
		CurrentStateEnd:   evaluationTime.Add(1 * time.Minute),
		Labels:            labels,
	})

	labels = models.InstanceLabels{"test9": "testValue9"}
	_, hash, _ = labels.StringAndHash()
	instances = append(instances, models.AlertInstance{
		AlertInstanceKey: models.AlertInstanceKey{
			RuleOrgID:  rule.OrgID,
			RuleUID:    rule.UID,
			LabelsHash: hash,
		},
		CurrentState:      models.InstanceStateFiring,
		CurrentReason:     models.StateReasonNoData,
		LastEvalTime:      evaluationTime,
		CurrentStateSince: evaluationTime.Add(-1 * time.Minute),
		CurrentStateEnd:   evaluationTime.Add(1 * time.Minute),
		Labels:            labels,
	})

	labels = models.InstanceLabels{"test10": "testValue10"}
	_, hash, _ = labels.StringAndHash()
	instances = append(instances, models.AlertInstance{
		AlertInstanceKey: models.AlertInstanceKey{
			RuleOrgID:  rule.OrgID,
			RuleUID:    rule.UID,
			LabelsHash: hash,
		},
		CurrentState:      models.InstanceStateNormal,
		CurrentReason:     models.StateReasonNoData,
		LastEvalTime:      evaluationTime,
		CurrentStateSince: evaluationTime.Add(-1 * time.Minute),
		CurrentStateEnd:   evaluationTime.Add(1 * time.Minute),
		Labels:            labels,
	})
	for _, instance := range instances {
		_ = dbstore.SaveAlertInstance(ctx, instance)
	}

	cfg := state.ManagerCfg{
		Metrics:       testMetrics.GetStateMetrics(),
		ExternalURL:   nil,
		InstanceStore: dbstore,
		Images:        &state.NoopImageService{},
		Clock:         clock.NewMock(),
		Historian:     &state.FakeHistorian{},
	}
	st := state.NewManager(cfg)
	st.Warm(ctx, dbstore)

	t.Run("instance cache has expected entries", func(t *testing.T) {
		for _, entry := range expectedEntries {
			cacheEntry := st.Get(entry.OrgID, entry.AlertRuleUID, entry.CacheID)

			if diff := cmp.Diff(entry, cacheEntry, cmpopts.IgnoreFields(state.State{}, "Results")); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
				t.FailNow()
			}
		}
	})
}

func TestDashboardAnnotations(t *testing.T) {
	evaluationTime, err := time.Parse("2006-01-02", "2022-01-01")
	require.NoError(t, err)

	ctx := context.Background()
	_, dbstore := tests.SetupTestEnv(t, 1)

	fakeAnnoRepo := annotationstest.NewFakeAnnotationsRepo()
	metrics := metrics.NewHistorianMetrics(prometheus.NewRegistry())
	hist := historian.NewAnnotationBackend(fakeAnnoRepo, &dashboards.FakeDashboardService{}, nil, metrics)
	cfg := state.ManagerCfg{
		Metrics:       testMetrics.GetStateMetrics(),
		ExternalURL:   nil,
		InstanceStore: dbstore,
		Images:        &state.NoopImageService{},
		Clock:         clock.New(),
		Historian:     hist,
	}
	st := state.NewManager(cfg)

	const mainOrgID int64 = 1

	rule := tests.CreateTestAlertRuleWithLabels(t, ctx, dbstore, 600, mainOrgID, map[string]string{
		"test1": "testValue1",
		"test2": "{{ $labels.instance_label }}",
	})

	st.Warm(ctx, dbstore)
	bValue := float64(42)
	cValue := float64(1)
	_ = st.ProcessEvalResults(ctx, evaluationTime, rule, eval.Results{{
		Instance:    data.Labels{"instance_label": "testValue2"},
		State:       eval.Alerting,
		EvaluatedAt: evaluationTime,
		Values: map[string]eval.NumberValueCapture{
			"B": {Var: "B", Value: &bValue, Labels: data.Labels{"job": "prometheus"}},
			"C": {Var: "C", Value: &cValue, Labels: data.Labels{"job": "prometheus"}},
		},
	}}, data.Labels{
		"alertname": rule.Title,
	})

	expected := []string{rule.Title + " {alertname=" + rule.Title + ", instance_label=testValue2, test1=testValue1, test2=testValue2} - B=42.000000, C=1.000000"}
	sort.Strings(expected)
	require.Eventuallyf(t, func() bool {
		var actual []string
		for _, next := range fakeAnnoRepo.Items() {
			actual = append(actual, next.Text)
		}
		sort.Strings(actual)
		if len(expected) != len(actual) {
			return false
		}
		for i := 0; i < len(expected); i++ {
			if expected[i] != actual[i] {
				return false
			}
		}
		return true
	}, time.Second, 100*time.Millisecond, "unexpected annotations")
}

func TestProcessEvalResults(t *testing.T) {
	evaluationTime, err := time.Parse("2006-01-02", "2021-03-25")
	if err != nil {
		t.Fatalf("error parsing date format: %s", err.Error())
	}
	evaluationDuration := 10 * time.Millisecond

	testCases := []struct {
		desc                string
		alertRule           *models.AlertRule
		evalResults         []eval.Results
		expectedStates      map[string]*state.State
		expectedAnnotations int
	}{
		{
			desc: "a cache entry is correctly created",
			alertRule: &models.AlertRule{
				OrgID:           1,
				Title:           "test_title",
				UID:             "test_alert_rule_uid",
				NamespaceUID:    "test_namespace_uid",
				Annotations:     map[string]string{"annotation": "test"},
				Labels:          map[string]string{"label": "test"},
				IntervalSeconds: 10,
			},
			evalResults: []eval.Results{
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Normal,
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
				},
			},
			expectedStates: map[string]*state.State{
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid"],["alertname","test_title"],["instance_label","test"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					Values: make(map[string]float64),
					State:  eval.Normal,
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime,
							EvaluationState: eval.Normal,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime,
					EndsAt:             evaluationTime,
					LastEvaluationTime: evaluationTime,
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
			},
		},
		{
			desc: "two results create two correct cache entries",
			alertRule: &models.AlertRule{
				OrgID:           1,
				Title:           "test_title",
				UID:             "test_alert_rule_uid",
				NamespaceUID:    "test_namespace_uid",
				Annotations:     map[string]string{"annotation": "test"},
				Labels:          map[string]string{"label": "test"},
				IntervalSeconds: 10,
			},
			evalResults: []eval.Results{
				{
					eval.Result{
						Instance:           data.Labels{"instance_label_1": "test"},
						State:              eval.Normal,
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
					eval.Result{
						Instance:           data.Labels{"instance_label_2": "test"},
						State:              eval.Alerting,
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
				},
			},
			expectedAnnotations: 1,
			expectedStates: map[string]*state.State{
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid"],["alertname","test_title"],["instance_label_1","test"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid"],["alertname","test_title"],["instance_label_1","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label_1":             "test",
					},
					Values: make(map[string]float64),
					State:  eval.Normal,
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime,
							EvaluationState: eval.Normal,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime,
					EndsAt:             evaluationTime,
					LastEvaluationTime: evaluationTime,
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid"],["alertname","test_title"],["instance_label_2","test"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid"],["alertname","test_title"],["instance_label_2","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label_2":             "test",
					},
					Values: make(map[string]float64),
					State:  eval.Alerting,
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime,
							EvaluationState: eval.Alerting,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime,
					EndsAt:             evaluationTime.Add(state.ResendDelay * 3),
					LastEvaluationTime: evaluationTime,
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
			},
		},
		{
			desc: "state is maintained",
			alertRule: &models.AlertRule{
				OrgID:           1,
				Title:           "test_title",
				UID:             "test_alert_rule_uid_1",
				NamespaceUID:    "test_namespace_uid",
				Annotations:     map[string]string{"annotation": "test"},
				Labels:          map[string]string{"label": "test"},
				IntervalSeconds: 10,
			},
			evalResults: []eval.Results{
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Normal,
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Normal,
						EvaluatedAt:        evaluationTime.Add(1 * time.Minute),
						EvaluationDuration: evaluationDuration,
					},
				},
			},
			expectedStates: map[string]*state.State{
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_1"],["alertname","test_title"],["instance_label","test"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_1",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_1"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_1",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					Values: make(map[string]float64),
					State:  eval.Normal,
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime,
							EvaluationState: eval.Normal,
							Values:          make(map[string]*float64),
						},
						{
							EvaluationTime:  evaluationTime.Add(1 * time.Minute),
							EvaluationState: eval.Normal,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime,
					EndsAt:             evaluationTime,
					LastEvaluationTime: evaluationTime.Add(1 * time.Minute),
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
			},
		},
		{
			desc: "normal -> alerting transition when For is unset",
			alertRule: &models.AlertRule{
				OrgID:           1,
				Title:           "test_title",
				UID:             "test_alert_rule_uid_2",
				NamespaceUID:    "test_namespace_uid",
				Annotations:     map[string]string{"annotation": "test"},
				Labels:          map[string]string{"label": "test"},
				IntervalSeconds: 10,
			},
			evalResults: []eval.Results{
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Normal,
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Alerting,
						EvaluatedAt:        evaluationTime.Add(1 * time.Minute),
						EvaluationDuration: evaluationDuration,
					},
				},
			},
			expectedAnnotations: 1,
			expectedStates: map[string]*state.State{
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					Values: make(map[string]float64),
					State:  eval.Alerting,
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime,
							EvaluationState: eval.Normal,
							Values:          make(map[string]*float64),
						},
						{
							EvaluationTime:  evaluationTime.Add(1 * time.Minute),
							EvaluationState: eval.Alerting,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime.Add(1 * time.Minute),
					EndsAt:             evaluationTime.Add(1 * time.Minute).Add(state.ResendDelay * 3),
					LastEvaluationTime: evaluationTime.Add(1 * time.Minute),
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
			},
		},
		{
			desc: "normal -> alerting when For is set",
			alertRule: &models.AlertRule{
				OrgID:           1,
				Title:           "test_title",
				UID:             "test_alert_rule_uid_2",
				NamespaceUID:    "test_namespace_uid",
				Annotations:     map[string]string{"annotation": "test"},
				Labels:          map[string]string{"label": "test"},
				IntervalSeconds: 10,
				For:             1 * time.Minute,
			},
			evalResults: []eval.Results{
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Normal,
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Alerting,
						EvaluatedAt:        evaluationTime.Add(10 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Alerting,
						EvaluatedAt:        evaluationTime.Add(80 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
			},
			expectedAnnotations: 2,
			expectedStates: map[string]*state.State{
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					Values: make(map[string]float64),
					State:  eval.Alerting,
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime,
							EvaluationState: eval.Normal,
							Values:          make(map[string]*float64),
						},
						{
							EvaluationTime:  evaluationTime.Add(10 * time.Second),
							EvaluationState: eval.Alerting,
							Values:          make(map[string]*float64),
						},
						{
							EvaluationTime:  evaluationTime.Add(80 * time.Second),
							EvaluationState: eval.Alerting,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime.Add(80 * time.Second),
					EndsAt:             evaluationTime.Add(80 * time.Second).Add(state.ResendDelay * 3),
					LastEvaluationTime: evaluationTime.Add(80 * time.Second),
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
			},
		},
		{
			desc: "normal -> alerting -> noData -> alerting when For is set",
			alertRule: &models.AlertRule{
				OrgID:           1,
				Title:           "test_title",
				UID:             "test_alert_rule_uid_2",
				NamespaceUID:    "test_namespace_uid",
				Annotations:     map[string]string{"annotation": "test"},
				Labels:          map[string]string{"label": "test"},
				IntervalSeconds: 10,
				For:             20 * time.Second,
				NoDataState:     models.NoData,
			},
			evalResults: []eval.Results{
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Normal,
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Alerting,
						EvaluatedAt:        evaluationTime.Add(10 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.NoData,
						EvaluatedAt:        evaluationTime.Add(20 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Alerting,
						EvaluatedAt:        evaluationTime.Add(30 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Alerting,
						EvaluatedAt:        evaluationTime.Add(40 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
			},
			expectedAnnotations: 3,
			expectedStates: map[string]*state.State{
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					Values: make(map[string]float64),
					State:  eval.Pending,
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime.Add(30 * time.Second),
							EvaluationState: eval.Alerting,
							Values:          make(map[string]*float64),
						},
						{
							EvaluationTime:  evaluationTime.Add(40 * time.Second),
							EvaluationState: eval.Alerting,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime.Add(30 * time.Second),
					EndsAt:             evaluationTime.Add(30 * time.Second).Add(state.ResendDelay * 3),
					LastEvaluationTime: evaluationTime.Add(40 * time.Second),
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
			},
		},
		{
			desc: "pending -> alerting -> noData when For is set and NoDataState is NoData",
			alertRule: &models.AlertRule{
				OrgID:           1,
				Title:           "test_title",
				UID:             "test_alert_rule_uid_2",
				NamespaceUID:    "test_namespace_uid",
				Annotations:     map[string]string{"annotation": "test"},
				Labels:          map[string]string{"label": "test"},
				IntervalSeconds: 10,
				For:             20 * time.Second,
				NoDataState:     models.NoData,
			},
			evalResults: []eval.Results{
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Alerting,
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Alerting,
						EvaluatedAt:        evaluationTime.Add(10 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Alerting,
						EvaluatedAt:        evaluationTime.Add(20 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.NoData,
						EvaluatedAt:        evaluationTime.Add(30 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
			},
			expectedAnnotations: 3,
			expectedStates: map[string]*state.State{
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					Values:      make(map[string]float64),
					State:       eval.NoData,
					StateReason: models.StateReasonNoData,
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime.Add(20 * time.Second),
							EvaluationState: eval.Alerting,
							Values:          make(map[string]*float64),
						},
						{
							EvaluationTime:  evaluationTime.Add(30 * time.Second),
							EvaluationState: eval.NoData,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime.Add(30 * time.Second),
					EndsAt:             evaluationTime.Add(30 * time.Second).Add(state.ResendDelay * 3),
					LastEvaluationTime: evaluationTime.Add(30 * time.Second),
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
			},
		},
		{
			desc: "normal -> pending when For is set but not exceeded and first result is normal",
			alertRule: &models.AlertRule{
				OrgID:           1,
				Title:           "test_title",
				UID:             "test_alert_rule_uid_2",
				NamespaceUID:    "test_namespace_uid",
				Annotations:     map[string]string{"annotation": "test"},
				Labels:          map[string]string{"label": "test"},
				IntervalSeconds: 10,
				For:             1 * time.Minute,
			},
			evalResults: []eval.Results{
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Normal,
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Alerting,
						EvaluatedAt:        evaluationTime.Add(10 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
			},
			expectedAnnotations: 1,
			expectedStates: map[string]*state.State{
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					Values: make(map[string]float64),
					State:  eval.Pending,
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime,
							EvaluationState: eval.Normal,
							Values:          make(map[string]*float64),
						},
						{
							EvaluationTime:  evaluationTime.Add(10 * time.Second),
							EvaluationState: eval.Alerting,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime.Add(10 * time.Second),
					EndsAt:             evaluationTime.Add(10 * time.Second).Add(state.ResendDelay * 3),
					LastEvaluationTime: evaluationTime.Add(10 * time.Second),
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
			},
		},
		{
			desc: "normal -> pending when For is set but not exceeded and first result is alerting",
			alertRule: &models.AlertRule{
				OrgID:           1,
				Title:           "test_title",
				UID:             "test_alert_rule_uid_2",
				NamespaceUID:    "test_namespace_uid",
				Annotations:     map[string]string{"annotation": "test"},
				Labels:          map[string]string{"label": "test"},
				IntervalSeconds: 10,
				For:             1 * time.Minute,
			},
			evalResults: []eval.Results{
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Alerting,
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Alerting,
						EvaluatedAt:        evaluationTime.Add(10 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
			},
			expectedAnnotations: 1,
			expectedStates: map[string]*state.State{
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					Values: make(map[string]float64),
					State:  eval.Pending,
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime,
							EvaluationState: eval.Alerting,
							Values:          make(map[string]*float64),
						},
						{
							EvaluationTime:  evaluationTime.Add(10 * time.Second),
							EvaluationState: eval.Alerting,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime,
					EndsAt:             evaluationTime.Add(state.ResendDelay * 3),
					LastEvaluationTime: evaluationTime.Add(10 * time.Second),
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
			},
		},
		{
			desc: "normal -> pending when For is set but not exceeded, result is NoData and NoDataState is alerting",
			alertRule: &models.AlertRule{
				OrgID:           1,
				Title:           "test_title",
				UID:             "test_alert_rule_uid_2",
				NamespaceUID:    "test_namespace_uid",
				Annotations:     map[string]string{"annotation": "test"},
				Labels:          map[string]string{"label": "test"},
				IntervalSeconds: 10,
				For:             1 * time.Minute,
				NoDataState:     models.Alerting,
			},
			evalResults: []eval.Results{
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Normal,
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.NoData,
						EvaluatedAt:        evaluationTime.Add(10 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
			},
			expectedAnnotations: 1,
			expectedStates: map[string]*state.State{
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					Values:      make(map[string]float64),
					State:       eval.Pending,
					StateReason: eval.NoData.String(),
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime,
							EvaluationState: eval.Normal,
							Values:          make(map[string]*float64),
						},
						{
							EvaluationTime:  evaluationTime.Add(10 * time.Second),
							EvaluationState: eval.NoData,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime.Add(10 * time.Second),
					EndsAt:             evaluationTime.Add(10 * time.Second).Add(state.ResendDelay * 3),
					LastEvaluationTime: evaluationTime.Add(10 * time.Second),
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
			},
		},
		{
			desc: "normal -> alerting when For is exceeded, result is NoData and NoDataState is alerting",
			alertRule: &models.AlertRule{
				OrgID:           1,
				Title:           "test_title",
				UID:             "test_alert_rule_uid_2",
				NamespaceUID:    "test_namespace_uid",
				Annotations:     map[string]string{"annotation": "test"},
				Labels:          map[string]string{"label": "test"},
				IntervalSeconds: 10,
				For:             30 * time.Second,
				NoDataState:     models.Alerting,
			},
			evalResults: []eval.Results{
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Normal,
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.NoData,
						EvaluatedAt:        evaluationTime.Add(10 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.NoData,
						EvaluatedAt:        evaluationTime.Add(20 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.NoData,
						EvaluatedAt:        evaluationTime.Add(30 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.NoData,
						EvaluatedAt:        evaluationTime.Add(40 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
			},
			expectedAnnotations: 2,
			expectedStates: map[string]*state.State{
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					Values:      make(map[string]float64),
					State:       eval.Alerting,
					StateReason: eval.NoData.String(),
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime.Add(20 * time.Second),
							EvaluationState: eval.NoData,
							Values:          make(map[string]*float64),
						},
						{
							EvaluationTime:  evaluationTime.Add(30 * time.Second),
							EvaluationState: eval.NoData,
							Values:          make(map[string]*float64),
						},
						{
							EvaluationTime:  evaluationTime.Add(40 * time.Second),
							EvaluationState: eval.NoData,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime.Add(40 * time.Second),
					EndsAt:             evaluationTime.Add(40 * time.Second).Add(state.ResendDelay * 3),
					LastEvaluationTime: evaluationTime.Add(40 * time.Second),
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
			},
		},
		{
			desc: "normal -> nodata when result is NoData and NoDataState is nodata",
			alertRule: &models.AlertRule{
				OrgID:           1,
				Title:           "test_title",
				UID:             "test_alert_rule_uid_2",
				NamespaceUID:    "test_namespace_uid",
				Annotations:     map[string]string{"annotation": "test"},
				Labels:          map[string]string{"label": "test"},
				IntervalSeconds: 10,
				NoDataState:     models.NoData,
			},
			evalResults: []eval.Results{
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Normal,
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.NoData,
						EvaluatedAt:        evaluationTime.Add(10 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
			},
			expectedAnnotations: 1,
			expectedStates: map[string]*state.State{
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					Values:      make(map[string]float64),
					State:       eval.NoData,
					StateReason: models.StateReasonNoData,
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime,
							EvaluationState: eval.Normal,
							Values:          make(map[string]*float64),
						},
						{
							EvaluationTime:  evaluationTime.Add(10 * time.Second),
							EvaluationState: eval.NoData,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime.Add(10 * time.Second),
					EndsAt:             evaluationTime.Add(10 * time.Second).Add(state.ResendDelay * 3),
					LastEvaluationTime: evaluationTime.Add(10 * time.Second),
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
			},
		},
		{
			desc: "normal -> nodata no labels when result is NoData and NoDataState is nodata",
			alertRule: &models.AlertRule{
				OrgID:           1,
				Title:           "test_title",
				UID:             "test_alert_rule_uid_2",
				NamespaceUID:    "test_namespace_uid",
				Annotations:     map[string]string{"annotation": "test"},
				Labels:          map[string]string{"label": "test"},
				IntervalSeconds: 10,
				NoDataState:     models.NoData,
			},
			evalResults: []eval.Results{
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Normal,
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{},
						State:              eval.NoData,
						EvaluatedAt:        evaluationTime.Add(10 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
			},
			expectedAnnotations: 1,
			expectedStates: map[string]*state.State{
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					Values: make(map[string]float64),
					State:  eval.Normal,
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime,
							EvaluationState: eval.Normal,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime,
					EndsAt:             evaluationTime,
					LastEvaluationTime: evaluationTime,
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
					},
					Values:      make(map[string]float64),
					State:       eval.NoData,
					StateReason: models.StateReasonNoData,
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime.Add(10 * time.Second),
							EvaluationState: eval.NoData,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime.Add(10 * time.Second),
					EndsAt:             evaluationTime.Add(10 * time.Second).Add(state.ResendDelay * 3),
					LastEvaluationTime: evaluationTime.Add(10 * time.Second),
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
			},
		},
		{
			desc: "normal (multi-dimensional) -> nodata no labels when result is NoData and NoDataState is nodata",
			alertRule: &models.AlertRule{
				OrgID:           1,
				Title:           "test_title",
				UID:             "test_alert_rule_uid_2",
				NamespaceUID:    "test_namespace_uid",
				Annotations:     map[string]string{"annotation": "test"},
				Labels:          map[string]string{"label": "test"},
				IntervalSeconds: 10,
				NoDataState:     models.NoData,
			},
			evalResults: []eval.Results{
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test-1"},
						State:              eval.Normal,
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
					eval.Result{
						Instance:           data.Labels{"instance_label": "test-2"},
						State:              eval.Normal,
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{},
						State:              eval.NoData,
						EvaluatedAt:        evaluationTime.Add(10 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
			},
			expectedAnnotations: 1,
			expectedStates: map[string]*state.State{
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test-1"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test-1"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test-1",
					},
					Values: make(map[string]float64),
					State:  eval.Normal,
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime,
							EvaluationState: eval.Normal,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime,
					EndsAt:             evaluationTime,
					LastEvaluationTime: evaluationTime,
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test-2"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test-2"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test-2",
					},
					Values: make(map[string]float64),
					State:  eval.Normal,
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime,
							EvaluationState: eval.Normal,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime,
					EndsAt:             evaluationTime,
					LastEvaluationTime: evaluationTime,
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
					},
					Values:      make(map[string]float64),
					State:       eval.NoData,
					StateReason: models.StateReasonNoData,
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime.Add(10 * time.Second),
							EvaluationState: eval.NoData,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime.Add(10 * time.Second),
					EndsAt:             evaluationTime.Add(10 * time.Second).Add(state.ResendDelay * 3),
					LastEvaluationTime: evaluationTime.Add(10 * time.Second),
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
			},
		},
		{
			desc: "normal -> nodata no labels -> normal when result is NoData and NoDataState is nodata",
			alertRule: &models.AlertRule{
				OrgID:           1,
				Title:           "test_title",
				UID:             "test_alert_rule_uid_2",
				NamespaceUID:    "test_namespace_uid",
				Annotations:     map[string]string{"annotation": "test"},
				Labels:          map[string]string{"label": "test"},
				IntervalSeconds: 10,
				NoDataState:     models.NoData,
			},
			evalResults: []eval.Results{
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Normal,
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{},
						State:              eval.NoData,
						EvaluatedAt:        evaluationTime.Add(10 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Normal,
						EvaluatedAt:        evaluationTime.Add(20 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
			},
			expectedAnnotations: 1,
			expectedStates: map[string]*state.State{
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					Values: make(map[string]float64),
					State:  eval.Normal,
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime,
							EvaluationState: eval.Normal,
							Values:          make(map[string]*float64),
						},
						{
							EvaluationTime:  evaluationTime.Add(20 * time.Second),
							EvaluationState: eval.Normal,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime,
					EndsAt:             evaluationTime,
					LastEvaluationTime: evaluationTime.Add(20 * time.Second),
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
					},
					Values:      make(map[string]float64),
					State:       eval.NoData,
					StateReason: models.StateReasonNoData,
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime.Add(10 * time.Second),
							EvaluationState: eval.NoData,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime.Add(10 * time.Second),
					EndsAt:             evaluationTime.Add(10 * time.Second).Add(state.ResendDelay * 3),
					LastEvaluationTime: evaluationTime.Add(10 * time.Second),
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
			},
		},
		{
			desc: "normal -> normal when result is NoData and NoDataState is ok",
			alertRule: &models.AlertRule{
				OrgID:           1,
				Title:           "test_title",
				UID:             "test_alert_rule_uid_2",
				NamespaceUID:    "test_namespace_uid",
				Annotations:     map[string]string{"annotation": "test"},
				Labels:          map[string]string{"label": "test"},
				IntervalSeconds: 10,
				NoDataState:     models.OK,
			},
			evalResults: []eval.Results{
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Normal,
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.NoData,
						EvaluatedAt:        evaluationTime.Add(10 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
			},
			expectedAnnotations: 1,
			expectedStates: map[string]*state.State{
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					Values:      make(map[string]float64),
					State:       eval.Normal,
					StateReason: eval.NoData.String(),
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime,
							EvaluationState: eval.Normal,
							Values:          make(map[string]*float64),
						},
						{
							EvaluationTime:  evaluationTime.Add(10 * time.Second),
							EvaluationState: eval.NoData,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime.Add(10 * time.Second),
					EndsAt:             evaluationTime.Add(10 * time.Second),
					LastEvaluationTime: evaluationTime.Add(10 * time.Second),
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
			},
		},
		{
			desc: "normal -> pending when For is set but not exceeded, result is Error and ExecErrState is Alerting",
			alertRule: &models.AlertRule{
				OrgID:           1,
				Title:           "test_title",
				UID:             "test_alert_rule_uid_2",
				NamespaceUID:    "test_namespace_uid",
				Annotations:     map[string]string{"annotation": "test"},
				Labels:          map[string]string{"label": "test"},
				IntervalSeconds: 10,
				For:             1 * time.Minute,
				ExecErrState:    models.AlertingErrState,
			},
			evalResults: []eval.Results{
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Normal,
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Error,
						Error:              errors.New("test error"),
						EvaluatedAt:        evaluationTime.Add(10 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
			},
			expectedAnnotations: 1,
			expectedStates: map[string]*state.State{
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					Values:      make(map[string]float64),
					State:       eval.Pending,
					StateReason: models.StateReasonError,
					Error:       errors.New("test error"),
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime,
							EvaluationState: eval.Normal,
							Values:          make(map[string]*float64),
						},
						{
							EvaluationTime:  evaluationTime.Add(10 * time.Second),
							EvaluationState: eval.Error,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime.Add(10 * time.Second),
					EndsAt:             evaluationTime.Add(10 * time.Second).Add(state.ResendDelay * 3),
					LastEvaluationTime: evaluationTime.Add(10 * time.Second),
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
			},
		},
		{
			desc: "normal -> alerting when For is exceeded, result is Error and ExecErrState is Alerting",
			alertRule: &models.AlertRule{
				OrgID:           1,
				Title:           "test_title",
				UID:             "test_alert_rule_uid_2",
				NamespaceUID:    "test_namespace_uid",
				Annotations:     map[string]string{"annotation": "test"},
				Labels:          map[string]string{"label": "test"},
				IntervalSeconds: 10,
				For:             30 * time.Second,
				ExecErrState:    models.AlertingErrState,
			},
			evalResults: []eval.Results{
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Normal,
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Error,
						EvaluatedAt:        evaluationTime.Add(10 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Error,
						EvaluatedAt:        evaluationTime.Add(20 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Error,
						EvaluatedAt:        evaluationTime.Add(30 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Error,
						EvaluatedAt:        evaluationTime.Add(40 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
			},
			expectedAnnotations: 2,
			expectedStates: map[string]*state.State{
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					Values:      make(map[string]float64),
					State:       eval.Alerting,
					StateReason: eval.Error.String(),
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime.Add(20 * time.Second),
							EvaluationState: eval.Error,
							Values:          make(map[string]*float64),
						},
						{
							EvaluationTime:  evaluationTime.Add(30 * time.Second),
							EvaluationState: eval.Error,
							Values:          make(map[string]*float64),
						},
						{
							EvaluationTime:  evaluationTime.Add(40 * time.Second),
							EvaluationState: eval.Error,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime.Add(40 * time.Second),
					EndsAt:             evaluationTime.Add(40 * time.Second).Add(state.ResendDelay * 3),
					LastEvaluationTime: evaluationTime.Add(40 * time.Second),
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
			},
		},
		{
			desc: "normal -> error when result is Error and ExecErrState is Error and ForError is the default value",
			alertRule: &models.AlertRule{
				OrgID:        1,
				Title:        "test_title",
				UID:          "test_alert_rule_uid_2",
				NamespaceUID: "test_namespace_uid",
				Data: []models.AlertQuery{{
					RefID:         "A",
					DatasourceUID: "datasource_uid_1",
				}},
				Annotations:     map[string]string{"annotation": "test"},
				Labels:          map[string]string{"label": "test"},
				IntervalSeconds: 10,
				For:             1 * time.Minute,
				ForError:        0,
				ExecErrState:    models.ErrorErrState,
			},
			evalResults: []eval.Results{
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Normal,
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance: data.Labels{"instance_label": "test"},
						Error: expr.QueryError{
							RefID: "A",
							Err:   errors.New("this is an error"),
						},
						State:              eval.Error,
						EvaluatedAt:        evaluationTime.Add(10 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
			},
			expectedAnnotations: 1,
			expectedStates: map[string]*state.State{
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
						"datasource_uid":               "datasource_uid_1",
						"ref_id":                       "A",
					},
					Values:      make(map[string]float64),
					State:       eval.Error,
					StateReason: models.StateReasonError,
					Error: expr.QueryError{
						RefID: "A",
						Err:   errors.New("this is an error"),
					},
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime,
							EvaluationState: eval.Normal,
							Values:          make(map[string]*float64),
						},
						{
							EvaluationTime:  evaluationTime.Add(10 * time.Second),
							EvaluationState: eval.Error,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime.Add(10 * time.Second),
					EndsAt:             evaluationTime.Add(10 * time.Second).Add(state.ResendDelay * 3),
					LastEvaluationTime: evaluationTime.Add(10 * time.Second),
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test", "Error": "failed to execute query A: this is an error"},
				},
			},
		},
		{
			desc: "normal -> pending error when result is Error and ExecErrState is Error and ForError is set",
			alertRule: &models.AlertRule{
				OrgID:        1,
				Title:        "test_title",
				UID:          "test_alert_rule_uid_2",
				NamespaceUID: "test_namespace_uid",
				Data: []models.AlertQuery{{
					RefID:         "A",
					DatasourceUID: "datasource_uid_1",
				}},
				Annotations:     map[string]string{"annotation": "test"},
				Labels:          map[string]string{"label": "test"},
				IntervalSeconds: 10,
				For:             1 * time.Minute,
				ForError:        1 * time.Minute,
				ExecErrState:    models.ErrorErrState,
			},
			evalResults: []eval.Results{
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Normal,
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance: data.Labels{"instance_label": "test"},
						Error: expr.QueryError{
							RefID: "A",
							Err:   errors.New("this is an error"),
						},
						State:              eval.Error,
						EvaluatedAt:        evaluationTime.Add(10 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
			},
			expectedAnnotations: 1,
			expectedStates: map[string]*state.State{
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
						"datasource_uid":               "datasource_uid_1",
						"ref_id":                       "A",
					},
					Values:      make(map[string]float64),
					State:       eval.Pending,
					StateReason: models.StateReasonError,
					Error: expr.QueryError{
						RefID: "A",
						Err:   errors.New("this is an error"),
					},
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime,
							EvaluationState: eval.Normal,
							Values:          make(map[string]*float64),
						},
						{
							EvaluationTime:  evaluationTime.Add(10 * time.Second),
							EvaluationState: eval.Error,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime.Add(10 * time.Second),
					EndsAt:             evaluationTime.Add(10 * time.Second).Add(state.ResendDelay * 3),
					LastEvaluationTime: evaluationTime.Add(10 * time.Second),
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test", "Error": "failed to execute query A: this is an error"},
				},
			},
		},
		{
			desc: "normal -> pending error when result is Error and ExecErrState is Error and ForError is set",
			alertRule: &models.AlertRule{
				OrgID:        1,
				Title:        "test_title",
				UID:          "test_alert_rule_uid_2",
				NamespaceUID: "test_namespace_uid",
				Data: []models.AlertQuery{{
					RefID:         "A",
					DatasourceUID: "datasource_uid_1",
				}},
				Annotations:     map[string]string{"annotation": "test"},
				Labels:          map[string]string{"label": "test"},
				IntervalSeconds: 10,
				For:             1 * time.Minute,
				ForError:        1 * time.Minute,
				ExecErrState:    models.ErrorErrState,
			},
			evalResults: []eval.Results{
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Normal,
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance: data.Labels{"instance_label": "test"},
						Error: expr.QueryError{
							RefID: "A",
							Err:   errors.New("this is an error"),
						},
						State:              eval.Error,
						EvaluatedAt:        evaluationTime.Add(10 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
			},
			expectedAnnotations: 1,
			expectedStates: map[string]*state.State{
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
						"datasource_uid":               "datasource_uid_1",
						"ref_id":                       "A",
					},
					Values:      make(map[string]float64),
					State:       eval.Pending,
					StateReason: models.StateReasonError,
					Error: expr.QueryError{
						RefID: "A",
						Err:   errors.New("this is an error"),
					},
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime,
							EvaluationState: eval.Normal,
							Values:          make(map[string]*float64),
						},
						{
							EvaluationTime:  evaluationTime.Add(10 * time.Second),
							EvaluationState: eval.Error,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime.Add(10 * time.Second),
					EndsAt:             evaluationTime.Add(10 * time.Second).Add(state.ResendDelay * 3),
					LastEvaluationTime: evaluationTime.Add(10 * time.Second),
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test", "Error": "failed to execute query A: this is an error"},
				},
			},
		},
		{
			desc: "normal -> pending error when result is Error and ExecErrState is Error and ForError is set",
			alertRule: &models.AlertRule{
				OrgID:        1,
				Title:        "test_title",
				UID:          "test_alert_rule_uid_2",
				NamespaceUID: "test_namespace_uid",
				Data: []models.AlertQuery{{
					RefID:         "A",
					DatasourceUID: "datasource_uid_1",
				}},
				Annotations:     map[string]string{"annotation": "test"},
				Labels:          map[string]string{"label": "test"},
				IntervalSeconds: 10,
				For:             1 * time.Minute,
				ForError:        1 * time.Minute,
				ExecErrState:    models.ErrorErrState,
			},
			evalResults: []eval.Results{
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Normal,
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance: data.Labels{"instance_label": "test"},
						Error: expr.QueryError{
							RefID: "A",
							Err:   errors.New("this is an error"),
						},
						State:              eval.Error,
						EvaluatedAt:        evaluationTime.Add(10 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
			},
			expectedAnnotations: 1,
			expectedStates: map[string]*state.State{
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
						"datasource_uid":               "datasource_uid_1",
						"ref_id":                       "A",
					},
					Values:      make(map[string]float64),
					State:       eval.Pending,
					StateReason: models.StateReasonError,
					Error: expr.QueryError{
						RefID: "A",
						Err:   errors.New("this is an error"),
					},
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime,
							EvaluationState: eval.Normal,
							Values:          make(map[string]*float64),
						},
						{
							EvaluationTime:  evaluationTime.Add(10 * time.Second),
							EvaluationState: eval.Error,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime.Add(10 * time.Second),
					EndsAt:             evaluationTime.Add(10 * time.Second).Add(state.ResendDelay * 3),
					LastEvaluationTime: evaluationTime.Add(10 * time.Second),
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test", "Error": "failed to execute query A: this is an error"},
				},
			},
		},
		{
			desc: "normal -> normal when result is Error and ExecErrState is OK",
			alertRule: &models.AlertRule{
				OrgID:        1,
				Title:        "test_title",
				UID:          "test_alert_rule_uid_2",
				NamespaceUID: "test_namespace_uid",
				Data: []models.AlertQuery{{
					RefID:         "A",
					DatasourceUID: "datasource_uid_1",
				}},
				Annotations:     map[string]string{"annotation": "test"},
				Labels:          map[string]string{"label": "test"},
				IntervalSeconds: 10,
				For:             1 * time.Minute,
				ExecErrState:    models.OkErrState,
			},
			evalResults: []eval.Results{
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Normal,
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance: data.Labels{"instance_label": "test"},
						Error: expr.QueryError{
							RefID: "A",
							Err:   errors.New("this is an error"),
						},
						State:              eval.Error,
						EvaluatedAt:        evaluationTime.Add(10 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
			},
			expectedAnnotations: 1,
			expectedStates: map[string]*state.State{
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					Values:      make(map[string]float64),
					State:       eval.Normal,
					StateReason: models.StateReasonError,
					Error: expr.QueryError{
						RefID: "A",
						Err:   errors.New("this is an error"),
					},
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime,
							EvaluationState: eval.Normal,
							Values:          make(map[string]*float64),
						},
						{
							EvaluationTime:  evaluationTime.Add(10 * time.Second),
							EvaluationState: eval.Error,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime.Add(10 * time.Second),
					EndsAt:             evaluationTime.Add(10 * time.Second),
					LastEvaluationTime: evaluationTime.Add(10 * time.Second),
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
			},
		},
		{
			desc: "alerting -> normal when result is Error and ExecErrState is OK",
			alertRule: &models.AlertRule{
				OrgID:        1,
				Title:        "test_title",
				UID:          "test_alert_rule_uid_2",
				NamespaceUID: "test_namespace_uid",
				Data: []models.AlertQuery{{
					RefID:         "A",
					DatasourceUID: "datasource_uid_1",
				}},
				Annotations:     map[string]string{"annotation": "test"},
				Labels:          map[string]string{"label": "test"},
				IntervalSeconds: 10,
				For:             1 * time.Minute,
				ExecErrState:    models.OkErrState,
			},
			evalResults: []eval.Results{
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Alerting,
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance: data.Labels{"instance_label": "test"},
						Error: expr.QueryError{
							RefID: "A",
							Err:   errors.New("this is an error"),
						},
						State:              eval.Error,
						EvaluatedAt:        evaluationTime.Add(10 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
			},
			expectedAnnotations: 2,
			expectedStates: map[string]*state.State{
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					Values:      make(map[string]float64),
					State:       eval.Normal,
					StateReason: models.StateReasonError,
					Error: expr.QueryError{
						RefID: "A",
						Err:   errors.New("this is an error"),
					},
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime,
							EvaluationState: eval.Alerting,
							Values:          make(map[string]*float64),
						},
						{
							EvaluationTime:  evaluationTime.Add(10 * time.Second),
							EvaluationState: eval.Error,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime.Add(10 * time.Second),
					EndsAt:             evaluationTime.Add(10 * time.Second),
					LastEvaluationTime: evaluationTime.Add(10 * time.Second),
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
			},
		},
		{
			desc: "normal -> alerting -> error when result is Error and ExecErrorState is Error",
			alertRule: &models.AlertRule{
				OrgID:           1,
				Title:           "test_title",
				UID:             "test_alert_rule_uid_2",
				NamespaceUID:    "test_namespace_uid",
				Annotations:     map[string]string{"annotation": "test"},
				Labels:          map[string]string{"label": "test"},
				IntervalSeconds: 10,
				For:             20 * time.Second,
				ExecErrState:    models.ErrorErrState,
			},
			evalResults: []eval.Results{
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Alerting,
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Alerting,
						EvaluatedAt:        evaluationTime.Add(10 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Alerting,
						EvaluatedAt:        evaluationTime.Add(20 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Error,
						EvaluatedAt:        evaluationTime.Add(30 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Error,
						EvaluatedAt:        evaluationTime.Add(40 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Error,
						EvaluatedAt:        evaluationTime.Add(50 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
			},
			expectedAnnotations: 3,
			expectedStates: map[string]*state.State{
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					Values:      make(map[string]float64),
					State:       eval.Error,
					StateReason: models.StateReasonError,
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime.Add(40 * time.Second),
							EvaluationState: eval.Error,
							Values:          make(map[string]*float64),
						},
						{
							EvaluationTime:  evaluationTime.Add(50 * time.Second),
							EvaluationState: eval.Error,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime.Add(30 * time.Second),
					EndsAt:             evaluationTime.Add(50 * time.Second).Add(state.ResendDelay * 3),
					LastEvaluationTime: evaluationTime.Add(50 * time.Second),
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
			},
		},
		{
			desc: "pending alerting -> pending error when result is Error and ExecErrorState is Error with For and ForError set",
			alertRule: &models.AlertRule{
				OrgID:           1,
				Title:           "test_title",
				UID:             "test_alert_rule_uid_2",
				NamespaceUID:    "test_namespace_uid",
				Annotations:     map[string]string{"annotation": "test"},
				Labels:          map[string]string{"label": "test"},
				IntervalSeconds: 10,
				For:             10 * time.Second,
				ForError:        20 * time.Second,
				ExecErrState:    models.ErrorErrState,
			},
			evalResults: []eval.Results{
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Alerting,
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance: data.Labels{"instance_label": "test"},
						State:    eval.Error,
						Error: expr.QueryError{
							RefID: "A",
							Err:   errors.New("this is an error"),
						},
						EvaluatedAt:        evaluationTime.Add(20 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance: data.Labels{"instance_label": "test"},
						State:    eval.Error,
						Error: expr.QueryError{
							RefID: "A",
							Err:   errors.New("this is an error"),
						},
						EvaluatedAt:        evaluationTime.Add(30 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
			},
			expectedAnnotations: 2,
			expectedStates: map[string]*state.State{
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					Values:      make(map[string]float64),
					State:       eval.Pending,
					StateReason: models.StateReasonError,
					Error: expr.QueryError{
						RefID: "A",
						Err:   errors.New("this is an error"),
					},
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime.Add(30 * time.Second),
							EvaluationState: eval.Error,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime.Add(20 * time.Second),
					EndsAt:             evaluationTime.Add(20 * time.Second).Add(state.ResendDelay * 3),
					LastEvaluationTime: evaluationTime.Add(30 * time.Second),
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
			},
		},
		{
			desc: "pending error -> pending alerting when result is Error and ExecErrorState is Error with For and ForError set",
			alertRule: &models.AlertRule{
				OrgID:           1,
				Title:           "test_title",
				UID:             "test_alert_rule_uid_2",
				NamespaceUID:    "test_namespace_uid",
				Annotations:     map[string]string{"annotation": "test"},
				Labels:          map[string]string{"label": "test"},
				IntervalSeconds: 10,
				For:             20 * time.Second,
				ForError:        10 * time.Second,
				ExecErrState:    models.ErrorErrState,
			},
			evalResults: []eval.Results{
				{
					eval.Result{
						Instance: data.Labels{"instance_label": "test"},
						State:    eval.Error,
						Error: expr.QueryError{
							RefID: "A",
							Err:   errors.New("this is an error"),
						},
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Alerting,
						EvaluatedAt:        evaluationTime.Add(20 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Alerting,
						EvaluatedAt:        evaluationTime.Add(30 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
			},
			expectedAnnotations: 2,
			expectedStates: map[string]*state.State{
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					Values: make(map[string]float64),
					State:  eval.Pending,
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime.Add(20 * time.Second),
							EvaluationState: eval.Alerting,
							Values:          make(map[string]*float64),
						},
						{
							EvaluationTime:  evaluationTime.Add(30 * time.Second),
							EvaluationState: eval.Alerting,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime.Add(20 * time.Second),
					EndsAt:             evaluationTime.Add(20 * time.Second).Add(state.ResendDelay * 3),
					LastEvaluationTime: evaluationTime.Add(30 * time.Second),
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
			},
		},
		{
			desc: "normal -> pending -> alerting -> pending error -> error -> pending -> alerting when result is Error and ExecErrorState is Error with For and ForError set",
			alertRule: &models.AlertRule{
				OrgID:           1,
				Title:           "test_title",
				UID:             "test_alert_rule_uid_2",
				NamespaceUID:    "test_namespace_uid",
				Annotations:     map[string]string{"annotation": "test"},
				Labels:          map[string]string{"label": "test"},
				IntervalSeconds: 10,
				For:             20 * time.Second,
				ForError:        20 * time.Second,
				ExecErrState:    models.ErrorErrState,
			},
			evalResults: []eval.Results{
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Normal,
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Alerting,
						EvaluatedAt:        evaluationTime.Add(10 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Alerting,
						EvaluatedAt:        evaluationTime.Add(20 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Alerting,
						EvaluatedAt:        evaluationTime.Add(30 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance: data.Labels{"instance_label": "test"},
						State:    eval.Error,
						Error: expr.QueryError{
							RefID: "A",
							Err:   errors.New("this is an error"),
						},
						EvaluatedAt:        evaluationTime.Add(40 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance: data.Labels{"instance_label": "test"},
						State:    eval.Error,
						Error: expr.QueryError{
							RefID: "A",
							Err:   errors.New("this is an error"),
						},
						EvaluatedAt:        evaluationTime.Add(50 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance: data.Labels{"instance_label": "test"},
						State:    eval.Error,
						Error: expr.QueryError{
							RefID: "A",
							Err:   errors.New("this is an error"),
						},
						EvaluatedAt:        evaluationTime.Add(60 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Alerting,
						EvaluatedAt:        evaluationTime.Add(70 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Alerting,
						EvaluatedAt:        evaluationTime.Add(80 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Alerting,
						EvaluatedAt:        evaluationTime.Add(90 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
			},
			expectedAnnotations: 6,
			expectedStates: map[string]*state.State{
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					Values: make(map[string]float64),
					State:  eval.Alerting,
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime.Add(80 * time.Second),
							EvaluationState: eval.Alerting,
							Values:          make(map[string]*float64),
						},
						{
							EvaluationTime:  evaluationTime.Add(90 * time.Second),
							EvaluationState: eval.Alerting,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime.Add(90 * time.Second),
					EndsAt:             evaluationTime.Add(90 * time.Second).Add(state.ResendDelay * 3),
					LastEvaluationTime: evaluationTime.Add(90 * time.Second),
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
			},
		},
		{
			desc: "normal -> alerting -> error -> alerting - it should clear the error",
			alertRule: &models.AlertRule{
				OrgID:           1,
				Title:           "test_title",
				UID:             "test_alert_rule_uid_2",
				NamespaceUID:    "test_namespace_uid",
				Annotations:     map[string]string{"annotation": "test"},
				Labels:          map[string]string{"label": "test"},
				IntervalSeconds: 10,
				For:             30 * time.Second,
			},
			evalResults: []eval.Results{
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Normal,
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Alerting,
						EvaluatedAt:        evaluationTime.Add(30 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Error,
						Error:              fmt.Errorf("Failed to query data"),
						EvaluatedAt:        evaluationTime.Add(40 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Alerting,
						EvaluatedAt:        evaluationTime.Add(70 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
			},
			expectedAnnotations: 3,
			expectedStates: map[string]*state.State{
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					Values: make(map[string]float64),
					State:  eval.Pending,
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime.Add(30 * time.Second),
							EvaluationState: eval.Alerting,
							Values:          make(map[string]*float64),
						},
						{
							EvaluationTime:  evaluationTime.Add(40 * time.Second),
							EvaluationState: eval.Error,
							Values:          make(map[string]*float64),
						},
						{
							EvaluationTime:  evaluationTime.Add(70 * time.Second),
							EvaluationState: eval.Alerting,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime.Add(70 * time.Second),
					EndsAt:             evaluationTime.Add(70 * time.Second).Add(state.ResendDelay * 3),
					LastEvaluationTime: evaluationTime.Add(70 * time.Second),
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
			},
		},
		{
			desc: "normal -> alerting -> error -> no data - it should clear the error",
			alertRule: &models.AlertRule{
				OrgID:           1,
				Title:           "test_title",
				UID:             "test_alert_rule_uid_2",
				NamespaceUID:    "test_namespace_uid",
				Annotations:     map[string]string{"annotation": "test"},
				Labels:          map[string]string{"label": "test"},
				IntervalSeconds: 10,
				For:             30 * time.Second,
				NoDataState:     models.NoData,
			},
			evalResults: []eval.Results{
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Normal,
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Alerting,
						EvaluatedAt:        evaluationTime.Add(30 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.Error,
						Error:              fmt.Errorf("Failed to query data"),
						EvaluatedAt:        evaluationTime.Add(40 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
				{
					eval.Result{
						Instance:           data.Labels{"instance_label": "test"},
						State:              eval.NoData,
						EvaluatedAt:        evaluationTime.Add(50 * time.Second),
						EvaluationDuration: evaluationDuration,
					},
				},
			},
			expectedAnnotations: 3,
			expectedStates: map[string]*state.State{
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					Values:      make(map[string]float64),
					State:       eval.NoData,
					StateReason: models.StateReasonNoData,
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime.Add(30 * time.Second),
							EvaluationState: eval.Alerting,
							Values:          make(map[string]*float64),
						},
						{
							EvaluationTime:  evaluationTime.Add(40 * time.Second),
							EvaluationState: eval.Error,
							Values:          make(map[string]*float64),
						},
						{
							EvaluationTime:  evaluationTime.Add(50 * time.Second),
							EvaluationState: eval.NoData,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime.Add(50 * time.Second),
					EndsAt:             evaluationTime.Add(50 * time.Second).Add(state.ResendDelay * 3),
					LastEvaluationTime: evaluationTime.Add(50 * time.Second),
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
			},
		},
		{
			desc: "template is correctly expanded",
			alertRule: &models.AlertRule{
				OrgID:           1,
				Title:           "test_title",
				UID:             "test_alert_rule_uid",
				NamespaceUID:    "test_namespace_uid",
				Annotations:     map[string]string{"summary": "{{$labels.pod}} is down in {{$labels.cluster}} cluster -> {{$labels.namespace}} namespace"},
				Labels:          map[string]string{"label": "test", "job": "{{$labels.namespace}}/{{$labels.pod}}"},
				IntervalSeconds: 10,
			},
			evalResults: []eval.Results{
				{
					eval.Result{
						Instance:           data.Labels{"cluster": "us-central-1", "namespace": "prod", "pod": "grafana"},
						State:              eval.Normal,
						EvaluatedAt:        evaluationTime,
						EvaluationDuration: evaluationDuration,
					},
				},
			},
			expectedStates: map[string]*state.State{
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid"],["alertname","test_title"],["cluster","us-central-1"],["job","prod/grafana"],["label","test"],["namespace","prod"],["pod","grafana"]]`: {
					AlertRuleUID: "test_alert_rule_uid",
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid"],["alertname","test_title"],["cluster","us-central-1"],["job","prod/grafana"],["label","test"],["namespace","prod"],["pod","grafana"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid",
						"alertname":                    "test_title",
						"cluster":                      "us-central-1",
						"namespace":                    "prod",
						"pod":                          "grafana",
						"label":                        "test",
						"job":                          "prod/grafana",
					},
					Values: make(map[string]float64),
					State:  eval.Normal,
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime,
							EvaluationState: eval.Normal,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           evaluationTime,
					EndsAt:             evaluationTime,
					LastEvaluationTime: evaluationTime,
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"summary": "grafana is down in us-central-1 cluster -> prod namespace"},
				},
			},
		},
	}

	for _, tc := range testCases {
		fakeAnnoRepo := annotationstest.NewFakeAnnotationsRepo()
		metrics := metrics.NewHistorianMetrics(prometheus.NewRegistry())
		hist := historian.NewAnnotationBackend(fakeAnnoRepo, &dashboards.FakeDashboardService{}, nil, metrics)
		cfg := state.ManagerCfg{
			Metrics:       testMetrics.GetStateMetrics(),
			ExternalURL:   nil,
			InstanceStore: &state.FakeInstanceStore{},
			Images:        &state.NotAvailableImageService{},
			Clock:         clock.New(),
			Historian:     hist,
		}
		st := state.NewManager(cfg)
		t.Run(tc.desc, func(t *testing.T) {
			for _, res := range tc.evalResults {
				_ = st.ProcessEvalResults(context.Background(), evaluationTime, tc.alertRule, res, data.Labels{
					"alertname":                    tc.alertRule.Title,
					"__alert_rule_namespace_uid__": tc.alertRule.NamespaceUID,
					"__alert_rule_uid__":           tc.alertRule.UID,
				})
			}

			states := st.GetStatesForRuleUID(tc.alertRule.OrgID, tc.alertRule.UID)
			assert.Len(t, states, len(tc.expectedStates))

			for _, s := range tc.expectedStates {
				cachedState := st.Get(s.OrgID, s.AlertRuleUID, s.CacheID)
				assert.Equal(t, s, cachedState)
			}

			require.Eventuallyf(t, func() bool {
				return tc.expectedAnnotations == fakeAnnoRepo.Len()
			}, time.Second, 100*time.Millisecond, "%d annotations are present, expected %d. We have %+v", fakeAnnoRepo.Len(), tc.expectedAnnotations, printAllAnnotations(fakeAnnoRepo.Items()))
		})
	}

	t.Run("should save state to database", func(t *testing.T) {
		instanceStore := &state.FakeInstanceStore{}
		clk := clock.New()
		cfg := state.ManagerCfg{
			Metrics:       testMetrics.GetStateMetrics(),
			ExternalURL:   nil,
			InstanceStore: instanceStore,
			Images:        &state.NotAvailableImageService{},
			Clock:         clk,
			Historian:     &state.FakeHistorian{},
		}
		st := state.NewManager(cfg)
		rule := models.AlertRuleGen()()
		var results = eval.GenerateResults(rand.Intn(4)+1, eval.ResultGen(eval.WithEvaluatedAt(clk.Now())))

		states := st.ProcessEvalResults(context.Background(), clk.Now(), rule, results, make(data.Labels))

		require.NotEmpty(t, states)

		savedStates := make(map[string]models.AlertInstance)
		for _, op := range instanceStore.RecordedOps {
			switch q := op.(type) {
			case models.AlertInstance:
				cacheId, err := q.Labels.StringKey()
				require.NoError(t, err)
				savedStates[cacheId] = q
			}
		}
		require.Len(t, savedStates, len(states))
		for _, s := range states {
			require.Contains(t, savedStates, s.CacheID)
		}
	})
}

func printAllAnnotations(annos map[int64]annotations.Item) string {
	str := "["
	for _, anno := range annos {
		str += fmt.Sprintf("%+v, ", anno)
	}
	str += "]"

	return str
}

func TestStaleResultsHandler(t *testing.T) {
	evaluationTime := time.Now()
	interval := time.Minute

	ctx := context.Background()
	_, dbstore := tests.SetupTestEnv(t, 1)

	const mainOrgID int64 = 1
	rule := tests.CreateTestAlertRule(t, ctx, dbstore, int64(interval.Seconds()), mainOrgID)
	lastEval := evaluationTime.Add(-2 * interval)

	labels1 := models.InstanceLabels{"test1": "testValue1"}
	_, hash1, _ := labels1.StringAndHash()
	labels2 := models.InstanceLabels{"test2": "testValue2"}
	_, hash2, _ := labels2.StringAndHash()
	instances := []models.AlertInstance{
		{
			AlertInstanceKey: models.AlertInstanceKey{
				RuleOrgID:  rule.OrgID,
				RuleUID:    rule.UID,
				LabelsHash: hash1,
			},
			CurrentState:      models.InstanceStateNormal,
			Labels:            labels1,
			LastEvalTime:      lastEval,
			CurrentStateSince: lastEval,
			CurrentStateEnd:   lastEval.Add(3 * interval),
		},
		{
			AlertInstanceKey: models.AlertInstanceKey{
				RuleOrgID:  rule.OrgID,
				RuleUID:    rule.UID,
				LabelsHash: hash2,
			},
			CurrentState:      models.InstanceStateFiring,
			Labels:            labels2,
			LastEvalTime:      lastEval,
			CurrentStateSince: lastEval,
			CurrentStateEnd:   lastEval.Add(3 * interval),
		},
	}

	for _, instance := range instances {
		_ = dbstore.SaveAlertInstance(ctx, instance)
	}

	testCases := []struct {
		desc               string
		evalResults        []eval.Results
		expectedStates     map[string]*state.State
		startingStateCount int
		finalStateCount    int
	}{
		{
			desc: "stale cache entries are removed",
			evalResults: []eval.Results{
				{
					eval.Result{
						Instance:    data.Labels{"test1": "testValue1"},
						State:       eval.Normal,
						EvaluatedAt: evaluationTime,
					},
				},
			},
			expectedStates: map[string]*state.State{
				`[["__alert_rule_namespace_uid__","namespace"],["__alert_rule_uid__","` + rule.UID + `"],["alertname","` + rule.Title + `"],["test1","testValue1"]]`: {
					AlertRuleUID: rule.UID,
					OrgID:        1,
					CacheID:      `[["__alert_rule_namespace_uid__","namespace"],["__alert_rule_uid__","` + rule.UID + `"],["alertname","` + rule.Title + `"],["test1","testValue1"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "namespace",
						"__alert_rule_uid__":           rule.UID,
						"alertname":                    rule.Title,
						"test1":                        "testValue1",
					},
					Values: make(map[string]float64),
					State:  eval.Normal,
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime,
							EvaluationState: eval.Normal,
							Values:          make(map[string]*float64),
							Condition:       "A",
						},
					},
					StartsAt:           evaluationTime,
					EndsAt:             evaluationTime,
					LastEvaluationTime: evaluationTime,
					EvaluationDuration: 0,
					Annotations:        map[string]string{"testAnnoKey": "testAnnoValue"},
				},
			},
			startingStateCount: 2,
			finalStateCount:    1,
		},
	}

	for _, tc := range testCases {
		ctx := context.Background()
		cfg := state.ManagerCfg{
			Metrics:       testMetrics.GetStateMetrics(),
			ExternalURL:   nil,
			InstanceStore: dbstore,
			Images:        &state.NoopImageService{},
			Clock:         clock.New(),
			Historian:     &state.FakeHistorian{},
		}
		st := state.NewManager(cfg)
		st.Warm(ctx, dbstore)
		existingStatesForRule := st.GetStatesForRuleUID(rule.OrgID, rule.UID)

		// We have loaded the expected number of entries from the db
		assert.Equal(t, tc.startingStateCount, len(existingStatesForRule))
		for _, res := range tc.evalResults {
			evalTime := evaluationTime
			for _, re := range res {
				if re.EvaluatedAt.After(evalTime) {
					evalTime = re.EvaluatedAt
				}
			}
			st.ProcessEvalResults(context.Background(), evalTime, rule, res, data.Labels{
				"alertname":                    rule.Title,
				"__alert_rule_namespace_uid__": rule.NamespaceUID,
				"__alert_rule_uid__":           rule.UID,
			})
			for _, s := range tc.expectedStates {
				cachedState := st.Get(s.OrgID, s.AlertRuleUID, s.CacheID)
				assert.Equal(t, s, cachedState)
			}
		}
		existingStatesForRule = st.GetStatesForRuleUID(rule.OrgID, rule.UID)

		// The expected number of state entries remains after results are processed
		assert.Equal(t, tc.finalStateCount, len(existingStatesForRule))
	}
}

func TestStaleResults(t *testing.T) {
	getCacheID := func(t *testing.T, rule *models.AlertRule, result eval.Result) string {
		t.Helper()
		labels := data.Labels{}
		for key, value := range rule.Labels {
			labels[key] = value
		}
		for key, value := range result.Instance {
			labels[key] = value
		}
		lbls := models.InstanceLabels(labels)
		key, err := lbls.StringKey()
		require.NoError(t, err)
		return key
	}

	checkExpectedStates := func(t *testing.T, actual []*state.State, expected map[string]struct{}) map[string]*state.State {
		t.Helper()
		result := make(map[string]*state.State)
		require.Len(t, actual, len(expected))
		for _, currentState := range actual {
			_, ok := expected[currentState.CacheID]
			result[currentState.CacheID] = currentState
			require.Truef(t, ok, "State %s is not expected. States: %v", currentState.CacheID, expected)
		}
		return result
	}
	checkExpectedStateTransitions := func(t *testing.T, actual []state.StateTransition, expected map[string]struct{}) {
		t.Helper()
		require.Len(t, actual, len(expected))
		for _, currentState := range actual {
			_, ok := expected[currentState.CacheID]
			require.Truef(t, ok, "State %s is not expected. States: %v", currentState.CacheID, expected)
		}
	}

	ctx := context.Background()
	clk := clock.NewMock()

	store := &state.FakeInstanceStore{}

	cfg := state.ManagerCfg{
		Metrics:       testMetrics.GetStateMetrics(),
		ExternalURL:   nil,
		InstanceStore: store,
		Images:        &state.NoopImageService{},
		Clock:         clk,
		Historian:     &state.FakeHistorian{},
	}
	st := state.NewManager(cfg)

	rule := models.AlertRuleGen(models.WithFor(0))()

	initResults := eval.Results{
		eval.ResultGen(eval.WithEvaluatedAt(clk.Now()))(),
		eval.ResultGen(eval.WithState(eval.Alerting), eval.WithEvaluatedAt(clk.Now()))(),
		eval.ResultGen(eval.WithState(eval.Normal), eval.WithEvaluatedAt(clk.Now()))(),
	}

	state1 := getCacheID(t, rule, initResults[0])
	state2 := getCacheID(t, rule, initResults[1])
	state3 := getCacheID(t, rule, initResults[2])

	initStates := map[string]struct{}{
		state1: {},
		state2: {},
		state3: {},
	}

	// Init
	processed := st.ProcessEvalResults(ctx, clk.Now(), rule, initResults, nil)
	checkExpectedStateTransitions(t, processed, initStates)

	currentStates := st.GetStatesForRuleUID(rule.OrgID, rule.UID)
	statesMap := checkExpectedStates(t, currentStates, initStates)
	require.Equal(t, eval.Alerting, statesMap[state2].State) // make sure the state is alerting because we need it to be resolved later

	staleDuration := 2 * time.Duration(rule.IntervalSeconds) * time.Second
	clk.Add(staleDuration)
	result := initResults[0]
	result.EvaluatedAt = clk.Now()
	results := eval.Results{
		result,
	}

	var expectedStaleKeys []models.AlertInstanceKey
	t.Run("should mark missing states as stale", func(t *testing.T) {
		processed = st.ProcessEvalResults(ctx, clk.Now(), rule, results, nil)
		checkExpectedStateTransitions(t, processed, initStates)
		for _, s := range processed {
			if s.CacheID == state1 {
				continue
			}
			assert.Equal(t, eval.Normal, s.State.State)
			assert.Equal(t, models.StateReasonMissingSeries, s.StateReason)
			assert.Equal(t, clk.Now(), s.EndsAt)
			if s.CacheID == state2 {
				assert.Truef(t, s.Resolved, "Returned stale state should have Resolved set to true")
			}
			key, err := s.GetAlertInstanceKey()
			require.NoError(t, err)
			expectedStaleKeys = append(expectedStaleKeys, key)
		}
	})

	t.Run("should remove stale states from cache", func(t *testing.T) {
		currentStates = st.GetStatesForRuleUID(rule.OrgID, rule.UID)
		checkExpectedStates(t, currentStates, map[string]struct{}{
			getCacheID(t, rule, results[0]): {},
		})
	})

	t.Run("should delete stale states from the database", func(t *testing.T) {
		for _, op := range store.RecordedOps {
			switch q := op.(type) {
			case state.FakeInstanceStoreOp:
				keys, ok := q.Args[1].([]models.AlertInstanceKey)
				require.Truef(t, ok, "Failed to parse fake store operations")
				require.Len(t, keys, 2)
				require.EqualValues(t, expectedStaleKeys, keys)
			}
		}
	})
}

func TestDeleteStateByRuleUID(t *testing.T) {
	interval := time.Minute
	ctx := context.Background()
	_, dbstore := tests.SetupTestEnv(t, 1)

	const mainOrgID int64 = 1
	rule := tests.CreateTestAlertRule(t, ctx, dbstore, int64(interval.Seconds()), mainOrgID)

	labels1 := models.InstanceLabels{"test1": "testValue1"}
	_, hash1, _ := labels1.StringAndHash()
	labels2 := models.InstanceLabels{"test2": "testValue2"}
	_, hash2, _ := labels2.StringAndHash()
	instances := []models.AlertInstance{
		{
			AlertInstanceKey: models.AlertInstanceKey{
				RuleOrgID:  rule.OrgID,
				RuleUID:    rule.UID,
				LabelsHash: hash1,
			},
			CurrentState: models.InstanceStateNormal,
			Labels:       labels1,
		},
		{
			AlertInstanceKey: models.AlertInstanceKey{
				RuleOrgID:  rule.OrgID,
				RuleUID:    rule.UID,
				LabelsHash: hash2,
			},
			CurrentState: models.InstanceStateFiring,
			Labels:       labels2,
		},
	}

	for _, instance := range instances {
		_ = dbstore.SaveAlertInstance(ctx, instance)
	}

	testCases := []struct {
		desc          string
		instanceStore state.InstanceStore

		expectedStates map[string]*state.State

		startingStateCacheCount int
		finalStateCacheCount    int
		startingInstanceDBCount int
		finalInstanceDBCount    int
	}{
		{
			desc:          "all states/instances are removed from cache and DB",
			instanceStore: dbstore,
			expectedStates: map[string]*state.State{
				`[["test1","testValue1"]]`: {
					AlertRuleUID:       rule.UID,
					OrgID:              1,
					CacheID:            `[["test1","testValue1"]]`,
					Labels:             data.Labels{"test1": "testValue1"},
					State:              eval.Normal,
					EvaluationDuration: 0,
					Annotations:        map[string]string{"testAnnoKey": "testAnnoValue"},
				},
				`[["test2","testValue2"]]`: {
					AlertRuleUID:       rule.UID,
					OrgID:              1,
					CacheID:            `[["test2","testValue2"]]`,
					Labels:             data.Labels{"test2": "testValue2"},
					State:              eval.Alerting,
					EvaluationDuration: 0,
					Annotations:        map[string]string{"testAnnoKey": "testAnnoValue"},
				},
			},
			startingStateCacheCount: 2,
			finalStateCacheCount:    0,
			startingInstanceDBCount: 2,
			finalInstanceDBCount:    0,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			ctx := context.Background()
			clk := clock.NewMock()
			clk.Set(time.Now())
			cfg := state.ManagerCfg{
				Metrics:       testMetrics.GetStateMetrics(),
				ExternalURL:   nil,
				InstanceStore: dbstore,
				Images:        &state.NoopImageService{},
				Clock:         clk,
				Historian:     &state.FakeHistorian{},
			}
			st := state.NewManager(cfg)
			st.Warm(ctx, dbstore)
			q := &models.ListAlertInstancesQuery{RuleOrgID: rule.OrgID, RuleUID: rule.UID}
			alerts, _ := dbstore.ListAlertInstances(ctx, q)
			existingStatesForRule := st.GetStatesForRuleUID(rule.OrgID, rule.UID)

			// We have loaded the expected number of entries from the db
			assert.Equal(t, tc.startingStateCacheCount, len(existingStatesForRule))
			assert.Equal(t, tc.startingInstanceDBCount, len(alerts))

			expectedReason := util.GenerateShortUID()
			transitions := st.DeleteStateByRuleUID(ctx, rule.GetKey(), expectedReason)

			// Check that the deleted states are the same as the ones that were in cache
			assert.Equal(t, tc.startingStateCacheCount, len(transitions))
			for _, s := range transitions {
				assert.Contains(t, tc.expectedStates, s.CacheID)
				oldState := tc.expectedStates[s.CacheID]
				assert.Equal(t, oldState.State, s.PreviousState)
				assert.Equal(t, oldState.StateReason, s.PreviousStateReason)
				assert.Equal(t, eval.Normal, s.State.State)
				assert.Equal(t, expectedReason, s.StateReason)
				if oldState.State == eval.Normal {
					assert.Equal(t, oldState.StartsAt, s.StartsAt)
					assert.False(t, s.Resolved)
				} else {
					assert.Equal(t, clk.Now(), s.StartsAt)
					if oldState.State == eval.Alerting {
						assert.True(t, s.Resolved)
					}
				}
				assert.Equal(t, clk.Now(), s.EndsAt)
			}

			q = &models.ListAlertInstancesQuery{RuleOrgID: rule.OrgID, RuleUID: rule.UID}
			alertInstances, _ := dbstore.ListAlertInstances(ctx, q)
			existingStatesForRule = st.GetStatesForRuleUID(rule.OrgID, rule.UID)

			// The expected number of state entries remains after states are deleted
			assert.Equal(t, tc.finalStateCacheCount, len(existingStatesForRule))
			assert.Equal(t, tc.finalInstanceDBCount, len(alertInstances))
		})
	}
}

func TestResetStateByRuleUID(t *testing.T) {
	interval := time.Minute
	ctx := context.Background()
	_, dbstore := tests.SetupTestEnv(t, 1)

	const mainOrgID int64 = 1
	rule := tests.CreateTestAlertRule(t, ctx, dbstore, int64(interval.Seconds()), mainOrgID)

	labels1 := models.InstanceLabels{"test1": "testValue1"}
	_, hash1, _ := labels1.StringAndHash()
	labels2 := models.InstanceLabels{"test2": "testValue2"}
	_, hash2, _ := labels2.StringAndHash()
	instances := []models.AlertInstance{
		{
			AlertInstanceKey: models.AlertInstanceKey{
				RuleOrgID:  rule.OrgID,
				RuleUID:    rule.UID,
				LabelsHash: hash1,
			},
			CurrentState: models.InstanceStateNormal,
			Labels:       labels1,
		},
		{
			AlertInstanceKey: models.AlertInstanceKey{
				RuleOrgID:  rule.OrgID,
				RuleUID:    rule.UID,
				LabelsHash: hash2,
			},
			CurrentState: models.InstanceStateFiring,
			Labels:       labels2,
		},
	}

	for _, instance := range instances {
		_ = dbstore.SaveAlertInstance(ctx, instance)
	}

	testCases := []struct {
		desc          string
		instanceStore state.InstanceStore

		expectedStates map[string]*state.State

		startingStateCacheCount  int
		finalStateCacheCount     int
		startingInstanceDBCount  int
		finalInstanceDBCount     int
		newHistorianEntriesCount int
	}{
		{
			desc:          "all states/instances are removed from cache and DB and saved in historian",
			instanceStore: dbstore,
			expectedStates: map[string]*state.State{
				`[["test1","testValue1"]]`: {
					AlertRuleUID:       rule.UID,
					OrgID:              1,
					CacheID:            `[["test1","testValue1"]]`,
					Labels:             data.Labels{"test1": "testValue1"},
					State:              eval.Normal,
					EvaluationDuration: 0,
					Annotations:        map[string]string{"testAnnoKey": "testAnnoValue"},
				},
				`[["test2","testValue2"]]`: {
					AlertRuleUID:       rule.UID,
					OrgID:              1,
					CacheID:            `[["test2","testValue2"]]`,
					Labels:             data.Labels{"test2": "testValue2"},
					State:              eval.Alerting,
					EvaluationDuration: 0,
					Annotations:        map[string]string{"testAnnoKey": "testAnnoValue"},
				},
			},
			startingStateCacheCount:  2,
			finalStateCacheCount:     0,
			startingInstanceDBCount:  2,
			finalInstanceDBCount:     0,
			newHistorianEntriesCount: 2,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			ctx := context.Background()
			fakeHistorian := &state.FakeHistorian{StateTransitions: make([]state.StateTransition, 0)}
			clk := clock.NewMock()
			clk.Set(time.Now())
			cfg := state.ManagerCfg{
				Metrics:       testMetrics.GetStateMetrics(),
				ExternalURL:   nil,
				InstanceStore: dbstore,
				Images:        &state.NoopImageService{},
				Clock:         clk,
				Historian:     fakeHistorian,
			}
			st := state.NewManager(cfg)
			st.Warm(ctx, dbstore)
			q := &models.ListAlertInstancesQuery{RuleOrgID: rule.OrgID, RuleUID: rule.UID}
			alerts, _ := dbstore.ListAlertInstances(ctx, q)
			existingStatesForRule := st.GetStatesForRuleUID(rule.OrgID, rule.UID)

			// We have loaded the expected number of entries from the db
			assert.Equal(t, tc.startingStateCacheCount, len(existingStatesForRule))
			assert.Equal(t, tc.startingInstanceDBCount, len(alerts))

			transitions := st.ResetStateByRuleUID(ctx, rule, models.StateReasonPaused)

			// Check that the deleted states are the same as the ones that were in cache
			assert.Equal(t, tc.startingStateCacheCount, len(transitions))
			for _, s := range transitions {
				assert.Contains(t, tc.expectedStates, s.CacheID)
				oldState := tc.expectedStates[s.CacheID]
				assert.Equal(t, oldState.State, s.PreviousState)
				assert.Equal(t, oldState.StateReason, s.PreviousStateReason)
				assert.Equal(t, eval.Normal, s.State.State)
				assert.Equal(t, models.StateReasonPaused, s.StateReason)
				if oldState.State == eval.Normal {
					assert.Equal(t, oldState.StartsAt, s.StartsAt)
					assert.False(t, s.Resolved)
				} else {
					assert.Equal(t, clk.Now(), s.StartsAt)
					if oldState.State == eval.Alerting {
						assert.True(t, s.Resolved)
					}
				}
				assert.Equal(t, clk.Now(), s.EndsAt)
			}

			// Check if both entries have been added to the historian
			assert.Equal(t, tc.newHistorianEntriesCount, len(fakeHistorian.StateTransitions))
			assert.Equal(t, transitions, fakeHistorian.StateTransitions)

			q = &models.ListAlertInstancesQuery{RuleOrgID: rule.OrgID, RuleUID: rule.UID}
			alertInstances, _ := dbstore.ListAlertInstances(ctx, q)
			existingStatesForRule = st.GetStatesForRuleUID(rule.OrgID, rule.UID)

			// The expected number of state entries remains after states are deleted
			assert.Equal(t, tc.finalStateCacheCount, len(existingStatesForRule))
			assert.Equal(t, tc.finalInstanceDBCount, len(alertInstances))
		})
	}
}
