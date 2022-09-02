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
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/image"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/ngalert/tests"
)

var testMetrics = metrics.NewNGAlert(prometheus.NewPedanticRegistry())

func TestDashboardAnnotations(t *testing.T) {
	evaluationTime, err := time.Parse("2006-01-02", "2022-01-01")
	require.NoError(t, err)

	ctx := context.Background()
	_, dbstore := tests.SetupTestEnv(t, 1)

	st := state.NewManager(log.New("test_stale_results_handler"), testMetrics.GetStateMetrics(), nil, dbstore, dbstore, &dashboards.FakeDashboardService{}, &image.NoopImageService{}, clock.New())

	fakeAnnoRepo := store.NewFakeAnnotationsRepo()
	annotations.SetRepository(fakeAnnoRepo)

	const mainOrgID int64 = 1

	rule := tests.CreateTestAlertRuleWithLabels(t, ctx, dbstore, 600, mainOrgID, map[string]string{
		"test1": "testValue1",
		"test2": "{{ $labels.instance_label }}",
	})

	st.Warm(ctx)
	_ = st.ProcessEvalResults(ctx, evaluationTime, rule, eval.Results{{
		Instance:    data.Labels{"instance_label": "testValue2"},
		State:       eval.Alerting,
		EvaluatedAt: evaluationTime,
	}}, data.Labels{
		"alertname": rule.Title,
	})

	expected := []string{rule.Title + " {alertname=" + rule.Title + ", instance_label=testValue2, test1=testValue1, test2=testValue2} - Alerting"}
	sort.Strings(expected)
	require.Eventuallyf(t, func() bool {
		var actual []string
		for _, next := range fakeAnnoRepo.Items {
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
					CacheId:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					State: eval.Normal,
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime,
							EvaluationState: eval.Normal,
							Values:          make(map[string]*float64),
						},
					},
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
					CacheId:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid"],["alertname","test_title"],["instance_label_1","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label_1":             "test",
					},
					State: eval.Normal,
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime,
							EvaluationState: eval.Normal,
							Values:          make(map[string]*float64),
						},
					},
					LastEvaluationTime: evaluationTime,
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid"],["alertname","test_title"],["instance_label_2","test"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid",
					OrgID:        1,
					CacheId:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid"],["alertname","test_title"],["instance_label_2","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label_2":             "test",
					},
					State: eval.Alerting,
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
					CacheId:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_1"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_1",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					State: eval.Normal,
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
					CacheId:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					State: eval.Alerting,
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
					CacheId:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					State: eval.Alerting,
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
					CacheId:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					State: eval.Pending,
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
					CacheId:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					State: eval.NoData,
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
					StartsAt:           evaluationTime.Add(20 * time.Second),
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
					CacheId:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					State: eval.Pending,
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
					CacheId:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					State: eval.Pending,
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
			desc: "normal -> alerting when result is NoData and NoDataState is alerting",
			alertRule: &models.AlertRule{
				OrgID:           1,
				Title:           "test_title",
				UID:             "test_alert_rule_uid_2",
				NamespaceUID:    "test_namespace_uid",
				Annotations:     map[string]string{"annotation": "test"},
				Labels:          map[string]string{"label": "test"},
				IntervalSeconds: 10,
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
					CacheId:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					State:       eval.Alerting,
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
					CacheId:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					State: eval.NoData,
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
					CacheId:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					State: eval.Normal,
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime,
							EvaluationState: eval.Normal,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           time.Time{},
					EndsAt:             time.Time{},
					LastEvaluationTime: evaluationTime,
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheId:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
					},
					State: eval.NoData,
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
					CacheId:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test-1"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test-1",
					},
					State: eval.Normal,
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime,
							EvaluationState: eval.Normal,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           time.Time{},
					EndsAt:             time.Time{},
					LastEvaluationTime: evaluationTime,
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test-2"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheId:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test-2"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test-2",
					},
					State: eval.Normal,
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime,
							EvaluationState: eval.Normal,
							Values:          make(map[string]*float64),
						},
					},
					StartsAt:           time.Time{},
					EndsAt:             time.Time{},
					LastEvaluationTime: evaluationTime,
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheId:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
					},
					State: eval.NoData,
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
					CacheId:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					State: eval.Normal,
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
					StartsAt:           time.Time{},
					EndsAt:             time.Time{},
					LastEvaluationTime: evaluationTime.Add(20 * time.Second),
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
				`[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["label","test"]]`: {
					AlertRuleUID: "test_alert_rule_uid_2",
					OrgID:        1,
					CacheId:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
					},
					State: eval.NoData,
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
					CacheId:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
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
					EndsAt:             evaluationTime.Add(10 * time.Second).Add(state.ResendDelay * 3),
					LastEvaluationTime: evaluationTime.Add(10 * time.Second),
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test"},
				},
			},
		},
		{
			desc: "EndsAt set correctly. normal -> alerting when result is NoData and NoDataState is alerting and For is set and For is breached",
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
					CacheId:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					State:       eval.Alerting,
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
					CacheId:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					State:       eval.Pending,
					StateReason: eval.Error.String(),
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
					CacheId:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
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
			desc: "normal -> error when result is Error and ExecErrState is Error",
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
					CacheId:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
						"datasource_uid":               "datasource_uid_1",
						"ref_id":                       "A",
					},
					State: eval.Error,
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
					CacheId:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					State:       eval.Normal,
					StateReason: eval.Error.String(),
					Error:       nil,
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
					CacheId:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					State:       eval.Normal,
					StateReason: eval.Error.String(),
					Error:       nil,
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
					CacheId:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					State: eval.Error,
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
					StartsAt:           evaluationTime.Add(20 * time.Second),
					EndsAt:             evaluationTime.Add(50 * time.Second).Add(state.ResendDelay * 3),
					LastEvaluationTime: evaluationTime.Add(50 * time.Second),
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
					CacheId:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					State: eval.Alerting,
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
					CacheId:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid_2"],["alertname","test_title"],["instance_label","test"],["label","test"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "test_namespace_uid",
						"__alert_rule_uid__":           "test_alert_rule_uid_2",
						"alertname":                    "test_title",
						"label":                        "test",
						"instance_label":               "test",
					},
					State: eval.NoData,
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
					StartsAt:           evaluationTime.Add(30 * time.Second),
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
					CacheId:      `[["__alert_rule_namespace_uid__","test_namespace_uid"],["__alert_rule_uid__","test_alert_rule_uid"],["alertname","test_title"],["cluster","us-central-1"],["job","prod/grafana"],["label","test"],["namespace","prod"],["pod","grafana"]]`,
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
					State: eval.Normal,
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime,
							EvaluationState: eval.Normal,
							Values:          make(map[string]*float64),
						},
					},
					LastEvaluationTime: evaluationTime,
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"summary": "grafana is down in us-central-1 cluster -> prod namespace"},
				},
			},
		},
	}

	for _, tc := range testCases {
		st := state.NewManager(log.New("test_state_manager"), testMetrics.GetStateMetrics(), nil, nil, &store.FakeInstanceStore{}, &dashboards.FakeDashboardService{}, &image.NotAvailableImageService{}, clock.New())
		t.Run(tc.desc, func(t *testing.T) {
			fakeAnnoRepo := store.NewFakeAnnotationsRepo()
			annotations.SetRepository(fakeAnnoRepo)

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
				cachedState, err := st.Get(s.OrgID, s.AlertRuleUID, s.CacheId)
				require.NoError(t, err)
				assert.Equal(t, s, cachedState)
			}

			require.Eventuallyf(t, func() bool {
				return tc.expectedAnnotations == fakeAnnoRepo.Len()
			}, time.Second, 100*time.Millisecond, "%d annotations are present, expected %d. We have %+v", fakeAnnoRepo.Len(), tc.expectedAnnotations, printAllAnnotations(fakeAnnoRepo.Items))
		})
	}

	t.Run("should save state to database", func(t *testing.T) {
		fakeAnnoRepo := store.NewFakeAnnotationsRepo()
		annotations.SetRepository(fakeAnnoRepo)
		instanceStore := &store.FakeInstanceStore{}
		clk := clock.New()
		st := state.NewManager(log.New("test_state_manager"), testMetrics.GetStateMetrics(), nil, nil, instanceStore, &dashboards.FakeDashboardService{}, &image.NotAvailableImageService{}, clk)
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
			require.Contains(t, savedStates, s.CacheId)
		}
	})
}

func printAllAnnotations(annos []*annotations.Item) string {
	str := "["
	for _, anno := range annos {
		str += fmt.Sprintf("%+v, ", *anno)
	}
	str += "]"

	return str
}

func TestStaleResultsHandler(t *testing.T) {
	evaluationTime := time.Now()
	interval := 60 * time.Second

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

	_ = dbstore.SaveAlertInstances(ctx, instances...)

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
					CacheId:      `[["__alert_rule_namespace_uid__","namespace"],["__alert_rule_uid__","` + rule.UID + `"],["alertname","` + rule.Title + `"],["test1","testValue1"]]`,
					Labels: data.Labels{
						"__alert_rule_namespace_uid__": "namespace",
						"__alert_rule_uid__":           rule.UID,
						"alertname":                    rule.Title,
						"test1":                        "testValue1",
					},
					State: eval.Normal,
					Results: []state.Evaluation{
						{
							EvaluationTime:  evaluationTime,
							EvaluationState: eval.Normal,
							Values:          make(map[string]*float64),
							Condition:       "A",
						},
					},
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
		st := state.NewManager(log.New("test_stale_results_handler"), testMetrics.GetStateMetrics(), nil, dbstore, dbstore, &dashboards.FakeDashboardService{}, &image.NoopImageService{}, clock.New())
		st.Warm(ctx)
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
				cachedState, err := st.Get(s.OrgID, s.AlertRuleUID, s.CacheId)
				require.NoError(t, err)
				assert.Equal(t, s, cachedState)
			}
		}
		existingStatesForRule = st.GetStatesForRuleUID(rule.OrgID, rule.UID)

		// The expected number of state entries remains after results are processed
		assert.Equal(t, tc.finalStateCount, len(existingStatesForRule))
	}
}
