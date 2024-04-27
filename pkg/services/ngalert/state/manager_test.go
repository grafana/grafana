package state_test

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"math"
	"math/rand"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/exp/slices"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/annotations/annotationstest"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/state/historian"
	"github.com/grafana/grafana/pkg/services/ngalert/tests"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

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
			Labels:       data.Labels{"test1": "testValue1"},
			State:        eval.Normal,
			Results: []state.Evaluation{
				{EvaluationTime: evaluationTime, EvaluationState: eval.Normal},
			},
			StartsAt:           evaluationTime.Add(-1 * time.Minute),
			EndsAt:             evaluationTime.Add(1 * time.Minute),
			LastEvaluationTime: evaluationTime,
			Annotations:        map[string]string{"testAnnoKey": "testAnnoValue"},
			ResultFingerprint:  data.Fingerprint(math.MaxUint64),
		}, {
			AlertRuleUID: rule.UID,
			OrgID:        rule.OrgID,
			Labels:       data.Labels{"test2": "testValue2"},
			State:        eval.Alerting,
			Results: []state.Evaluation{
				{EvaluationTime: evaluationTime, EvaluationState: eval.Alerting},
			},
			StartsAt:           evaluationTime.Add(-1 * time.Minute),
			EndsAt:             evaluationTime.Add(1 * time.Minute),
			LastEvaluationTime: evaluationTime,
			Annotations:        map[string]string{"testAnnoKey": "testAnnoValue"},
			ResultFingerprint:  data.Fingerprint(math.MaxUint64 - 1),
		},
		{
			AlertRuleUID: rule.UID,
			OrgID:        rule.OrgID,
			Labels:       data.Labels{"test3": "testValue3"},
			State:        eval.NoData,
			Results: []state.Evaluation{
				{EvaluationTime: evaluationTime, EvaluationState: eval.NoData},
			},
			StartsAt:           evaluationTime.Add(-1 * time.Minute),
			EndsAt:             evaluationTime.Add(1 * time.Minute),
			LastEvaluationTime: evaluationTime,
			Annotations:        map[string]string{"testAnnoKey": "testAnnoValue"},
			ResultFingerprint:  data.Fingerprint(0),
		},
		{
			AlertRuleUID: rule.UID,
			OrgID:        rule.OrgID,
			Labels:       data.Labels{"test4": "testValue4"},
			State:        eval.Error,
			Results: []state.Evaluation{
				{EvaluationTime: evaluationTime, EvaluationState: eval.Error},
			},
			StartsAt:           evaluationTime.Add(-1 * time.Minute),
			EndsAt:             evaluationTime.Add(1 * time.Minute),
			LastEvaluationTime: evaluationTime,
			Annotations:        map[string]string{"testAnnoKey": "testAnnoValue"},
			ResultFingerprint:  data.Fingerprint(1),
		},
		{
			AlertRuleUID: rule.UID,
			OrgID:        rule.OrgID,
			Labels:       data.Labels{"test5": "testValue5"},
			State:        eval.Pending,
			Results: []state.Evaluation{
				{EvaluationTime: evaluationTime, EvaluationState: eval.Pending},
			},
			StartsAt:           evaluationTime.Add(-1 * time.Minute),
			EndsAt:             evaluationTime.Add(1 * time.Minute),
			LastEvaluationTime: evaluationTime,
			Annotations:        map[string]string{"testAnnoKey": "testAnnoValue"},
			ResultFingerprint:  data.Fingerprint(2),
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
		ResultFingerprint: data.Fingerprint(math.MaxUint64).String(),
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
		ResultFingerprint: data.Fingerprint(math.MaxUint64 - 1).String(),
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
		ResultFingerprint: data.Fingerprint(0).String(),
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
		ResultFingerprint: data.Fingerprint(1).String(),
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
		ResultFingerprint: data.Fingerprint(2).String(),
	})
	for _, instance := range instances {
		_ = dbstore.SaveAlertInstance(ctx, instance)
	}

	cfg := state.ManagerCfg{
		Metrics:       metrics.NewNGAlert(prometheus.NewPedanticRegistry()).GetStateMetrics(),
		ExternalURL:   nil,
		InstanceStore: dbstore,
		Images:        &state.NoopImageService{},
		Clock:         clock.NewMock(),
		Historian:     &state.FakeHistorian{},
		Tracer:        tracing.InitializeTracerForTest(),
		Log:           log.New("ngalert.state.manager"),
	}
	st := state.NewManager(cfg, state.NewNoopPersister())
	st.Warm(ctx, dbstore)

	t.Run("instance cache has expected entries", func(t *testing.T) {
		for _, entry := range expectedEntries {
			setCacheID(entry)
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
	historianMetrics := metrics.NewHistorianMetrics(prometheus.NewRegistry(), metrics.Subsystem)
	store := historian.NewAnnotationStore(fakeAnnoRepo, &dashboards.FakeDashboardService{}, historianMetrics)
	hist := historian.NewAnnotationBackend(store, nil, historianMetrics)
	cfg := state.ManagerCfg{
		Metrics:       metrics.NewNGAlert(prometheus.NewPedanticRegistry()).GetStateMetrics(),
		ExternalURL:   nil,
		InstanceStore: dbstore,
		Images:        &state.NoopImageService{},
		Clock:         clock.New(),
		Historian:     hist,
		Tracer:        tracing.InitializeTracerForTest(),
		Log:           log.New("ngalert.state.manager"),
	}
	st := state.NewManager(cfg, state.NewNoopPersister())

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
	evaluationDuration := 10 * time.Millisecond
	evaluationInterval := 10 * time.Second

	t1 := time.Time{}.Add(evaluationInterval)

	tn := func(n int) time.Time {
		return t1.Add(time.Duration(n-1) * evaluationInterval)
	}

	t2 := tn(2)
	t3 := tn(3)

	baseRule := &models.AlertRule{
		OrgID: 1,
		Title: "test_title",
		UID:   "test_alert_rule_uid",
		Data: []models.AlertQuery{{
			RefID:         "A",
			DatasourceUID: "datasource_uid_1",
		}, {
			RefID:         "B",
			DatasourceUID: expr.DatasourceType,
		}},
		NamespaceUID:    "test_namespace_uid",
		Annotations:     map[string]string{"annotation": "test"},
		Labels:          map[string]string{"label": "test"},
		IntervalSeconds: int64(evaluationInterval.Seconds()),
		NoDataState:     models.NoData,
		ExecErrState:    models.ErrorErrState,
	}

	newEvaluation := func(evalTime time.Time, evalState eval.State) state.Evaluation {
		return state.Evaluation{
			EvaluationTime:  evalTime,
			EvaluationState: evalState,
			Values:          make(map[string]*float64),
		}
	}

	baseRuleWith := func(mutators ...models.AlertRuleMutator) *models.AlertRule {
		r := models.CopyRule(baseRule)
		for _, mutator := range mutators {
			mutator(r)
		}
		return r
	}

	newResult := func(mutators ...eval.ResultMutator) eval.Result {
		r := eval.Result{
			State:              eval.Normal,
			EvaluationDuration: evaluationDuration,
		}
		for _, mutator := range mutators {
			mutator(&r)
		}
		return r
	}

	labels1 := data.Labels{
		"instance_label": "test-1",
	}
	labels2 := data.Labels{
		"instance_label": "test-2",
	}
	systemLabels := data.Labels{
		"system": "owned",
	}
	noDataLabels := data.Labels{
		"datasource_uid": "1",
		"ref_id":         "A",
	}
	labels := map[string]data.Labels{
		"system + rule":           mergeLabels(baseRule.Labels, systemLabels),
		"system + rule + labels1": mergeLabels(mergeLabels(labels1, baseRule.Labels), systemLabels),
		"system + rule + labels2": mergeLabels(mergeLabels(labels2, baseRule.Labels), systemLabels),
		"system + rule + no-data": mergeLabels(mergeLabels(noDataLabels, baseRule.Labels), systemLabels),
	}

	// keep it separate to make code folding work correctly.
	type testCase struct {
		desc                string
		alertRule           *models.AlertRule
		evalResults         map[time.Time]eval.Results
		expectedStates      []*state.State
		expectedAnnotations int
	}

	testCases := []testCase{
		{
			desc:      "a cache entry is correctly created",
			alertRule: baseRule,
			evalResults: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
				},
			},
			expectedStates: []*state.State{
				{
					Labels:            labels["system + rule + labels1"],
					ResultFingerprint: labels1.Fingerprint(),
					State:             eval.Normal,
					Results: []state.Evaluation{
						newEvaluation(t1, eval.Normal),
					},
					StartsAt:           t1,
					EndsAt:             t1,
					LastEvaluationTime: t1,
				},
			},
		},
		{
			desc:      "two results create two correct cache entries",
			alertRule: baseRule,
			evalResults: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels2)),
				},
			},
			expectedAnnotations: 1,
			expectedStates: []*state.State{
				{
					Labels:            labels["system + rule + labels1"],
					ResultFingerprint: labels1.Fingerprint(),
					State:             eval.Normal,
					Results: []state.Evaluation{
						newEvaluation(t1, eval.Normal),
					},
					StartsAt:           t1,
					EndsAt:             t1,
					LastEvaluationTime: t1,
				},
				{
					Labels:            labels["system + rule + labels2"],
					ResultFingerprint: labels2.Fingerprint(),
					State:             eval.Alerting,
					Results: []state.Evaluation{
						newEvaluation(t1, eval.Alerting),
					},
					StartsAt:           t1,
					EndsAt:             t1.Add(state.ResendDelay * 4),
					LastEvaluationTime: t1,
				},
			},
		},
		{
			desc:      "state is maintained",
			alertRule: baseRule,
			evalResults: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
				},
				tn(6): {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
				},
			},
			expectedStates: []*state.State{
				{
					Labels:            labels["system + rule + labels1"],
					ResultFingerprint: labels1.Fingerprint(),
					State:             eval.Normal,
					Results: []state.Evaluation{
						newEvaluation(t1, eval.Normal),
						newEvaluation(tn(6), eval.Normal),
					},
					StartsAt:           t1,
					EndsAt:             t1,
					LastEvaluationTime: tn(6),
				},
			},
		},
		{
			desc:      "normal -> alerting transition when For is unset",
			alertRule: baseRule,
			evalResults: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
				},
				t2: {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
				},
			},
			expectedAnnotations: 1,
			expectedStates: []*state.State{
				{
					Labels:            labels["system + rule + labels1"],
					ResultFingerprint: labels1.Fingerprint(),
					State:             eval.Alerting,
					Results: []state.Evaluation{
						newEvaluation(t1, eval.Normal),
						newEvaluation(t2, eval.Alerting),
					},
					StartsAt:           t2,
					EndsAt:             t2.Add(state.ResendDelay * 4),
					LastEvaluationTime: t2,
				},
			},
		},
		{
			desc:      "normal -> alerting when For is set",
			alertRule: baseRuleWith(models.WithForNTimes(2)),
			evalResults: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
				},
				t2: {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
				},
				t3: {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
				},
				tn(4): {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
				},
			},
			expectedAnnotations: 2,
			expectedStates: []*state.State{
				{
					Labels:            labels["system + rule + labels1"],
					ResultFingerprint: labels1.Fingerprint(),
					State:             eval.Alerting,
					Results: []state.Evaluation{
						newEvaluation(t3, eval.Alerting),
						newEvaluation(tn(4), eval.Alerting),
					},
					StartsAt:           tn(4),
					EndsAt:             tn(4).Add(state.ResendDelay * 4),
					LastEvaluationTime: tn(4),
				},
			},
		},
		{
			desc:      "normal -> alerting -> noData -> alerting when For is set",
			alertRule: baseRuleWith(models.WithForNTimes(2)),
			evalResults: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
				},
				t2: {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
				},
				t3: {
					newResult(eval.WithState(eval.NoData), eval.WithLabels(labels1)), // TODO fix it because NoData does not have labels
				},
				tn(4): {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
				},
				tn(5): {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
				},
			},
			expectedAnnotations: 3, // Normal -> Pending, Pending -> NoData, NoData -> Pending
			expectedStates: []*state.State{
				{
					Labels:            labels["system + rule + labels1"],
					ResultFingerprint: labels1.Fingerprint(),
					State:             eval.Pending,
					Results: []state.Evaluation{
						newEvaluation(tn(4), eval.Alerting),
						newEvaluation(tn(5), eval.Alerting),
					},
					StartsAt:           tn(4),
					EndsAt:             tn(4).Add(state.ResendDelay * 4),
					LastEvaluationTime: tn(5),
				},
			},
		},
		{
			desc:      "pending -> alerting -> noData when For is set and NoDataState is NoData",
			alertRule: baseRuleWith(models.WithForNTimes(2)),
			evalResults: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
				},
				t2: {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
				},
				t3: {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
				},
				tn(4): {
					newResult(eval.WithState(eval.NoData), eval.WithLabels(labels1)),
				},
			},
			expectedAnnotations: 3,
			expectedStates: []*state.State{
				{
					Labels:            labels["system + rule + labels1"],
					ResultFingerprint: labels1.Fingerprint(),
					State:             eval.NoData,
					Results: []state.Evaluation{
						newEvaluation(t3, eval.Alerting),
						newEvaluation(tn(4), eval.NoData),
					},
					StartsAt:           tn(4),
					EndsAt:             tn(4).Add(state.ResendDelay * 4),
					LastEvaluationTime: tn(4),
				},
			},
		},
		{
			desc:      "normal -> pending when For is set but not exceeded and first result is normal",
			alertRule: baseRuleWith(models.WithForNTimes(2)),
			evalResults: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
				},
				t2: {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
				},
			},
			expectedAnnotations: 1,
			expectedStates: []*state.State{
				{
					Labels:            labels["system + rule + labels1"],
					ResultFingerprint: labels1.Fingerprint(),

					State: eval.Pending,
					Results: []state.Evaluation{
						newEvaluation(t1, eval.Normal),
						newEvaluation(t2, eval.Alerting),
					},
					StartsAt:           t2,
					EndsAt:             t2.Add(state.ResendDelay * 4),
					LastEvaluationTime: t2,
				},
			},
		},
		{
			desc:      "normal -> pending when For is set but not exceeded and first result is alerting",
			alertRule: baseRuleWith(models.WithForNTimes(6)),
			evalResults: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
				},
				t2: {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
				},
			},
			expectedAnnotations: 1,
			expectedStates: []*state.State{
				{
					Labels:            labels["system + rule + labels1"],
					ResultFingerprint: labels1.Fingerprint(),
					State:             eval.Pending,
					Results: []state.Evaluation{
						newEvaluation(t1, eval.Alerting),
						newEvaluation(t2, eval.Alerting),
					},
					StartsAt:           t1,
					EndsAt:             t1.Add(state.ResendDelay * 4),
					LastEvaluationTime: t2,
				},
			},
		},
		{
			desc:      "normal -> pending when For is set but not exceeded, result is NoData and NoDataState is alerting",
			alertRule: baseRuleWith(models.WithForNTimes(6), models.WithNoDataExecAs(models.Alerting)),
			evalResults: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
				},
				t2: {
					newResult(eval.WithState(eval.NoData), eval.WithLabels(labels1)),
				},
			},
			expectedAnnotations: 1,
			expectedStates: []*state.State{
				{
					Labels:            labels["system + rule + labels1"],
					ResultFingerprint: labels1.Fingerprint(),
					State:             eval.Pending,
					StateReason:       eval.NoData.String(),
					Results: []state.Evaluation{
						newEvaluation(t1, eval.Normal),
						newEvaluation(t2, eval.NoData),
					},
					StartsAt:           t2,
					EndsAt:             t2.Add(state.ResendDelay * 4),
					LastEvaluationTime: t2,
				},
			},
		},
		{
			desc:      "normal -> alerting when For is exceeded, result is NoData and NoDataState is alerting",
			alertRule: baseRuleWith(models.WithForNTimes(3), models.WithNoDataExecAs(models.Alerting)),
			evalResults: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
				},
				t2: {
					newResult(eval.WithState(eval.NoData), eval.WithLabels(labels1)), // TODO fix it because nodata has no labels of regular result
				},
				t3: {
					newResult(eval.WithState(eval.NoData), eval.WithLabels(labels1)),
				},
				tn(4): {
					newResult(eval.WithState(eval.NoData), eval.WithLabels(labels1)),
				},
				tn(5): {
					newResult(eval.WithState(eval.NoData), eval.WithLabels(labels1)),
				},
			},
			expectedAnnotations: 2,
			expectedStates: []*state.State{
				{
					Labels:            labels["system + rule + labels1"],
					ResultFingerprint: labels1.Fingerprint(),
					State:             eval.Alerting,
					StateReason:       eval.NoData.String(),
					Results: []state.Evaluation{
						newEvaluation(t3, eval.NoData),
						newEvaluation(tn(4), eval.NoData),
						newEvaluation(tn(5), eval.NoData),
					},
					StartsAt:           tn(5),
					EndsAt:             tn(5).Add(state.ResendDelay * 4),
					LastEvaluationTime: tn(5),
				},
			},
		},
		{
			desc:      "normal -> nodata when result is NoData and NoDataState is nodata",
			alertRule: baseRule,
			evalResults: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
				},
				t2: {
					newResult(eval.WithState(eval.NoData), eval.WithLabels(labels1)),
				},
			},
			expectedAnnotations: 1,
			expectedStates: []*state.State{
				{
					Labels:            labels["system + rule + labels1"],
					ResultFingerprint: labels1.Fingerprint(),
					State:             eval.NoData,
					Results: []state.Evaluation{
						newEvaluation(t1, eval.Normal),
						newEvaluation(t2, eval.NoData),
					},
					StartsAt:           t2,
					EndsAt:             t2.Add(state.ResendDelay * 4),
					LastEvaluationTime: t2,
				},
			},
		},
		{
			desc:      "normal -> nodata no labels when result is NoData and NoDataState is nodata", // TODO should be broken in https://github.com/grafana/grafana/pull/68142
			alertRule: baseRule,
			evalResults: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
				},
				t2: {
					newResult(eval.WithState(eval.NoData), eval.WithLabels(nil)),
				},
			},
			expectedAnnotations: 1,
			expectedStates: []*state.State{
				{
					Labels:            labels["system + rule + labels1"],
					ResultFingerprint: labels1.Fingerprint(),
					State:             eval.Normal,
					Results: []state.Evaluation{
						newEvaluation(t1, eval.Normal),
					},
					StartsAt:           t1,
					EndsAt:             t1,
					LastEvaluationTime: t1,
				},
				{
					Labels:            labels["system + rule"],
					ResultFingerprint: data.Labels{}.Fingerprint(),
					State:             eval.NoData,
					Results: []state.Evaluation{
						newEvaluation(t2, eval.NoData),
					},
					StartsAt:           t2,
					EndsAt:             t2.Add(state.ResendDelay * 4),
					LastEvaluationTime: t2,
				},
			},
		},
		{
			desc:      "normal (multi-dimensional) -> nodata no labels when result is NoData and NoDataState is nodata",
			alertRule: baseRule,
			evalResults: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels2)),
				},
				t2: {
					newResult(eval.WithState(eval.NoData), eval.WithLabels(data.Labels{})),
				},
			},
			expectedAnnotations: 1,
			expectedStates: []*state.State{
				{
					Labels:            labels["system + rule + labels1"],
					ResultFingerprint: labels1.Fingerprint(),
					State:             eval.Normal,
					Results: []state.Evaluation{
						newEvaluation(t1, eval.Normal),
					},
					StartsAt:           t1,
					EndsAt:             t1,
					LastEvaluationTime: t1,
				},
				{
					Labels:            labels["system + rule + labels2"],
					ResultFingerprint: labels2.Fingerprint(),
					State:             eval.Normal,
					Results: []state.Evaluation{
						newEvaluation(t1, eval.Normal),
					},
					StartsAt:           t1,
					EndsAt:             t1,
					LastEvaluationTime: t1,
				},
				{
					Labels:            labels["system + rule"],
					ResultFingerprint: data.Labels{}.Fingerprint(),
					State:             eval.NoData,
					Results: []state.Evaluation{
						newEvaluation(t2, eval.NoData),
					},
					StartsAt:           t2,
					EndsAt:             t2.Add(state.ResendDelay * 4),
					LastEvaluationTime: t2,
				},
			},
		},
		{
			desc:      "normal -> nodata no labels -> normal when result is NoData and NoDataState is nodata",
			alertRule: baseRule,
			evalResults: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
				},
				t2: {
					newResult(eval.WithState(eval.NoData), eval.WithLabels(noDataLabels)),
				},
				t3: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
				},
			},
			expectedAnnotations: 1,
			expectedStates: []*state.State{
				{
					Labels:            labels["system + rule + labels1"],
					ResultFingerprint: labels1.Fingerprint(),
					State:             eval.Normal,
					Results: []state.Evaluation{
						newEvaluation(t1, eval.Normal),
						newEvaluation(t3, eval.Normal),
					},
					StartsAt:           t1,
					EndsAt:             t1,
					LastEvaluationTime: t3,
				},
				{
					Labels:            labels["system + rule + no-data"],
					ResultFingerprint: noDataLabels.Fingerprint(),
					State:             eval.NoData,
					Results: []state.Evaluation{
						newEvaluation(t2, eval.NoData),
					},
					StartsAt:           t2,
					EndsAt:             t2.Add(state.ResendDelay * 4),
					LastEvaluationTime: t2,
				},
			},
		},
		{
			desc:      "normal -> normal (NoData, KeepLastState) -> alerting -> alerting (NoData, KeepLastState) - keeps last state when result is NoData and NoDataState is KeepLast",
			alertRule: baseRuleWith(models.WithForNTimes(0), models.WithNoDataExecAs(models.KeepLast)),
			evalResults: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
				},
				t2: {
					newResult(eval.WithState(eval.NoData), eval.WithLabels(labels1)), // TODO fix it because NoData does not have same labels
				},
				t3: {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
				},
				tn(4): {
					newResult(eval.WithState(eval.NoData), eval.WithLabels(labels1)), // TODO fix it because NoData does not have same labels
				},
			},
			expectedAnnotations: 1,
			expectedStates: []*state.State{
				{
					Labels:            labels["system + rule + labels1"],
					ResultFingerprint: labels1.Fingerprint(),
					State:             eval.Alerting,
					StateReason:       models.ConcatReasons(eval.NoData.String(), models.StateReasonKeepLast),
					Results: []state.Evaluation{
						newEvaluation(t1, eval.Normal),
						newEvaluation(t2, eval.NoData),
						newEvaluation(t3, eval.Alerting),
						newEvaluation(tn(4), eval.NoData),
					},
					StartsAt:           t3,
					EndsAt:             tn(4).Add(state.ResendDelay * 4),
					LastEvaluationTime: tn(4),
				},
			},
		},
		{
			desc:      "normal -> pending -> pending (NoData, KeepLastState) -> alerting (NoData, KeepLastState) - keep last state respects For when result is NoData",
			alertRule: baseRuleWith(models.WithForNTimes(2), models.WithNoDataExecAs(models.KeepLast)),
			evalResults: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
				},
				t2: {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
				},
				t3: {
					newResult(eval.WithState(eval.NoData), eval.WithLabels(labels1)), // TODO fix it because NoData does not have same labels
				},
				tn(4): {
					newResult(eval.WithState(eval.NoData), eval.WithLabels(labels1)), // TODO fix it because NoData does not have same labels
				},
			},
			expectedAnnotations: 2,
			expectedStates: []*state.State{
				{
					Labels:            labels["system + rule + labels1"],
					ResultFingerprint: labels1.Fingerprint(),
					State:             eval.Alerting,
					StateReason:       models.ConcatReasons(eval.NoData.String(), models.StateReasonKeepLast),
					Results: []state.Evaluation{
						newEvaluation(t3, eval.NoData),
						newEvaluation(tn(4), eval.NoData),
					},
					StartsAt:           tn(4),
					EndsAt:             tn(4).Add(state.ResendDelay * 4),
					LastEvaluationTime: tn(4),
				},
			},
		},
		{
			desc:      "normal -> normal when result is NoData and NoDataState is ok",
			alertRule: baseRuleWith(models.WithNoDataExecAs(models.OK)),
			evalResults: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
				},
				t2: {
					newResult(eval.WithState(eval.NoData), eval.WithLabels(labels1)), // TODO fix it because NoData does not have same labels
				},
			},
			expectedAnnotations: 0,
			expectedStates: []*state.State{
				{
					Labels:            labels["system + rule + labels1"],
					ResultFingerprint: labels1.Fingerprint(),
					State:             eval.Normal,
					StateReason:       eval.NoData.String(),
					Results: []state.Evaluation{
						newEvaluation(t1, eval.Normal),
						newEvaluation(t2, eval.NoData),
					},
					StartsAt:           t1,
					EndsAt:             t1,
					LastEvaluationTime: t2,
				},
			},
		},
		{
			desc:      "normal -> pending when For is set but not exceeded, result is Error and ExecErrState is Alerting",
			alertRule: baseRuleWith(models.WithForNTimes(6), models.WithErrorExecAs(models.AlertingErrState)),
			evalResults: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
				},
				t2: {
					newResult(eval.WithState(eval.Error), eval.WithLabels(labels1)),
				},
			},
			expectedAnnotations: 1,
			expectedStates: []*state.State{
				{
					Labels:            labels["system + rule + labels1"],
					ResultFingerprint: labels1.Fingerprint(),
					State:             eval.Pending,
					StateReason:       eval.Error.String(),
					Error:             errors.New("with_state_error"),
					Results: []state.Evaluation{
						newEvaluation(t1, eval.Normal),
						newEvaluation(t2, eval.Error),
					},
					StartsAt:           t2,
					EndsAt:             t2.Add(state.ResendDelay * 4),
					LastEvaluationTime: t2,
				},
			},
		},
		{
			desc:      "normal -> alerting when For is exceeded, result is Error and ExecErrState is Alerting",
			alertRule: baseRuleWith(models.WithForNTimes(3), models.WithErrorExecAs(models.AlertingErrState)),
			evalResults: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
				},
				t2: {
					newResult(eval.WithState(eval.Error), eval.WithLabels(labels1)),
				},
				t3: {
					newResult(eval.WithState(eval.Error), eval.WithLabels(labels1)),
				},
				tn(4): {
					newResult(eval.WithState(eval.Error), eval.WithLabels(labels1)),
				},
				tn(5): {
					newResult(eval.WithState(eval.Error), eval.WithLabels(labels1)),
				},
			},
			expectedAnnotations: 2,
			expectedStates: []*state.State{
				{
					Labels:            labels["system + rule + labels1"],
					ResultFingerprint: labels1.Fingerprint(),
					State:             eval.Alerting,
					StateReason:       eval.Error.String(),
					Error:             errors.New("with_state_error"),
					Results: []state.Evaluation{
						newEvaluation(t3, eval.Error),
						newEvaluation(tn(4), eval.Error),
						newEvaluation(tn(5), eval.Error),
					},
					StartsAt:           tn(5),
					EndsAt:             tn(5).Add(state.ResendDelay * 4),
					LastEvaluationTime: tn(5),
				},
			},
		},
		{
			desc:      "normal -> error when result is Error and ExecErrState is Error",
			alertRule: baseRuleWith(models.WithForNTimes(6), models.WithErrorExecAs(models.ErrorErrState)),
			evalResults: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
				},
				t2: {
					newResult(eval.WithError(expr.MakeQueryError("A", "datasource_uid_1", errors.New("this is an error"))), eval.WithLabels(labels1)), // TODO fix it because error labels are different
				},
			},
			expectedAnnotations: 1,
			expectedStates: []*state.State{
				{
					CacheID: func() string {
						lbls := models.InstanceLabels(labels["system + rule + labels1"])
						r, err := lbls.StringKey()
						if err != nil {
							panic(err)
						}
						return r
					}(),
					Labels: mergeLabels(labels["system + rule + labels1"], data.Labels{
						"datasource_uid": "datasource_uid_1",
						"ref_id":         "A",
					}),
					ResultFingerprint: labels1.Fingerprint(),
					State:             eval.Error,
					Error:             expr.MakeQueryError("A", "datasource_uid_1", errors.New("this is an error")),
					Results: []state.Evaluation{
						newEvaluation(t1, eval.Normal),
						newEvaluation(t2, eval.Error),
					},
					StartsAt:           t2,
					EndsAt:             t2.Add(state.ResendDelay * 4),
					LastEvaluationTime: t2,
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"annotation": "test", "Error": "[sse.dataQueryError] failed to execute query [A]: this is an error"},
				},
			},
		},
		{
			desc:      "normal -> normal (Error, KeepLastState) -> alerting -> alerting (Error, KeepLastState) - keeps last state when result is Error and ExecErrState is KeepLast",
			alertRule: baseRuleWith(models.WithForNTimes(0), models.WithErrorExecAs(models.KeepLastErrState)),
			evalResults: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
				},
				t2: {
					newResult(eval.WithError(expr.MakeQueryError("A", "datasource_uid_1", errors.New("this is an error"))), eval.WithLabels(labels1)), // TODO fix it because error labels are different
				},
				t3: {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
				},
				tn(4): {
					newResult(eval.WithError(expr.MakeQueryError("A", "datasource_uid_1", errors.New("this is an error"))), eval.WithLabels(labels1)), // TODO fix it because error labels are different
				},
			},
			expectedAnnotations: 1,
			expectedStates: []*state.State{
				{
					Labels:            labels["system + rule + labels1"],
					ResultFingerprint: labels1.Fingerprint(),
					State:             eval.Alerting,
					StateReason:       models.ConcatReasons(eval.Error.String(), models.StateReasonKeepLast),
					Results: []state.Evaluation{
						newEvaluation(t1, eval.Normal),
						newEvaluation(t2, eval.Error),
						newEvaluation(t3, eval.Alerting),
						newEvaluation(tn(4), eval.Error),
					},
					StartsAt:           t3,
					EndsAt:             tn(4).Add(state.ResendDelay * 4),
					LastEvaluationTime: tn(4),
				},
			},
		},
		{
			desc:      "normal -> pending -> pending (Error, KeepLastState) -> alerting (Error, KeepLastState) - keep last state respects For when result is Error",
			alertRule: baseRuleWith(models.WithForNTimes(2), models.WithErrorExecAs(models.KeepLastErrState)),
			evalResults: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
				},
				t2: {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
				},
				t3: {
					newResult(eval.WithError(expr.MakeQueryError("A", "datasource_uid_1", errors.New("this is an error"))), eval.WithLabels(labels1)), // TODO fix it because error labels are different
				},
				tn(4): {
					newResult(eval.WithError(expr.MakeQueryError("A", "datasource_uid_1", errors.New("this is an error"))), eval.WithLabels(labels1)), // TODO fix it because error labels are different
				},
			},
			expectedAnnotations: 2,
			expectedStates: []*state.State{
				{
					Labels:            labels["system + rule + labels1"],
					ResultFingerprint: labels1.Fingerprint(),
					State:             eval.Alerting,
					StateReason:       models.ConcatReasons(eval.Error.String(), models.StateReasonKeepLast),
					Results: []state.Evaluation{
						newEvaluation(t3, eval.Error),
						newEvaluation(tn(4), eval.Error),
					},
					StartsAt:           tn(4),
					EndsAt:             tn(4).Add(state.ResendDelay * 4),
					LastEvaluationTime: tn(4),
				},
			},
		},
		{
			desc:      "normal -> normal when result is Error and ExecErrState is OK",
			alertRule: baseRuleWith(models.WithForNTimes(6), models.WithErrorExecAs(models.OkErrState)),
			evalResults: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
				},
				t2: {
					newResult(eval.WithError(expr.MakeQueryError("A", "datasource_uid_1", errors.New("this is an error"))), eval.WithLabels(labels1)), // TODO fix it because error labels are different
				},
			},
			expectedAnnotations: 1,
			expectedStates: []*state.State{
				{
					Labels:            labels["system + rule + labels1"],
					ResultFingerprint: labels1.Fingerprint(),
					State:             eval.Normal,
					StateReason:       eval.Error.String(),
					Results: []state.Evaluation{
						newEvaluation(t1, eval.Normal),
						newEvaluation(t2, eval.Error),
					},
					StartsAt:           t1,
					EndsAt:             t1,
					LastEvaluationTime: t2,
				},
			},
		},
		{
			desc:      "alerting -> normal when result is Error and ExecErrState is OK",
			alertRule: baseRuleWith(models.WithForNTimes(6), models.WithErrorExecAs(models.OkErrState)),
			evalResults: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
				},
				t2: {
					newResult(eval.WithError(expr.MakeQueryError("A", "datasource_uid_1", errors.New("this is an error"))), eval.WithLabels(labels1)), // TODO fix it because error labels are different
				},
			},
			expectedAnnotations: 2,
			expectedStates: []*state.State{
				{
					Labels:            labels["system + rule + labels1"],
					ResultFingerprint: labels1.Fingerprint(),
					State:             eval.Normal,
					StateReason:       eval.Error.String(),
					Results: []state.Evaluation{
						newEvaluation(t1, eval.Alerting),
						newEvaluation(t2, eval.Error),
					},
					StartsAt:           t2,
					EndsAt:             t2,
					LastEvaluationTime: t2,
				},
			},
		},
		{
			desc:      "normal -> alerting -> error when result is Error and ExecErrorState is Error",
			alertRule: baseRuleWith(models.WithForNTimes(2)),
			evalResults: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
				},
				t2: {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
				},
				t3: {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
				},
				tn(4): {
					newResult(eval.WithState(eval.Error), eval.WithLabels(labels1)), // TODO this is not how error result is created
				},
				tn(5): {
					newResult(eval.WithState(eval.Error), eval.WithLabels(labels1)), // TODO this is not how error result is created
				},
				tn(6): {
					newResult(eval.WithState(eval.Error), eval.WithLabels(labels1)), // TODO this is not how error result is created
				},
			},
			expectedAnnotations: 3,
			expectedStates: []*state.State{
				{
					Labels:            labels["system + rule + labels1"],
					ResultFingerprint: labels1.Fingerprint(),
					State:             eval.Error,
					Error:             fmt.Errorf("with_state_error"),
					Results: []state.Evaluation{
						newEvaluation(tn(5), eval.Error),
						newEvaluation(tn(6), eval.Error),
					},
					StartsAt:           tn(4),
					EndsAt:             tn(6).Add(state.ResendDelay * 4),
					LastEvaluationTime: tn(6),
				},
			},
		},
		{
			desc:      "normal -> alerting -> error -> alerting - it should clear the error",
			alertRule: baseRuleWith(models.WithForNTimes(3)),
			evalResults: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
				},
				tn(4): {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
				},
				tn(5): {
					newResult(eval.WithState(eval.Error), eval.WithLabels(labels1)), // TODO fix it
				},
				tn(8): {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
				},
			},
			expectedAnnotations: 3,
			expectedStates: []*state.State{
				{
					Labels:            labels["system + rule + labels1"],
					ResultFingerprint: labels1.Fingerprint(),
					State:             eval.Pending,
					Results: []state.Evaluation{
						newEvaluation(tn(4), eval.Alerting),
						newEvaluation(tn(5), eval.Error),
						newEvaluation(tn(8), eval.Alerting),
					},
					StartsAt:           tn(8),
					EndsAt:             tn(8).Add(state.ResendDelay * 4),
					LastEvaluationTime: tn(8),
				},
			},
		},
		{
			desc:      "normal -> alerting -> error -> no data - it should clear the error",
			alertRule: baseRuleWith(models.WithForNTimes(3)),
			evalResults: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
				},
				tn(4): {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
				},
				tn(5): {
					newResult(eval.WithState(eval.Error), eval.WithLabels(labels1)), // TODO FIX it
				},
				tn(6): {
					newResult(eval.WithState(eval.NoData), eval.WithLabels(labels1)), // TODO fix it because it's not possible
				},
			},
			expectedAnnotations: 3,
			expectedStates: []*state.State{
				{
					Labels:            labels["system + rule + labels1"],
					ResultFingerprint: labels1.Fingerprint(),
					State:             eval.NoData,
					Results: []state.Evaluation{
						newEvaluation(tn(4), eval.Alerting),
						newEvaluation(tn(5), eval.Error),
						newEvaluation(tn(6), eval.NoData),
					},
					StartsAt:           tn(6),
					EndsAt:             tn(6).Add(state.ResendDelay * 4),
					LastEvaluationTime: tn(6),
				},
			},
		},
		{
			desc: "template is correctly expanded",
			alertRule: baseRuleWith(
				models.WithAnnotations(map[string]string{"summary": "{{$labels.pod}} is down in {{$labels.cluster}} cluster -> {{$labels.namespace}} namespace"}),
				models.WithLabels(map[string]string{"label": "test", "job": "{{$labels.namespace}}/{{$labels.pod}}"}),
			),
			evalResults: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(data.Labels{
						"cluster":   "us-central-1",
						"namespace": "prod",
						"pod":       "grafana",
					})),
				},
			},
			expectedStates: []*state.State{
				{
					Labels: mergeLabels(systemLabels, data.Labels{
						"cluster":   "us-central-1",
						"namespace": "prod",
						"pod":       "grafana",
						"label":     "test",
						"job":       "prod/grafana",
					}),
					State: eval.Normal,
					Results: []state.Evaluation{
						newEvaluation(t1, eval.Normal),
					},
					StartsAt:           t1,
					EndsAt:             t1,
					LastEvaluationTime: t1,
					EvaluationDuration: evaluationDuration,
					Annotations:        map[string]string{"summary": "grafana is down in us-central-1 cluster -> prod namespace"},
					ResultFingerprint: data.Labels{
						"cluster":   "us-central-1",
						"namespace": "prod",
						"pod":       "grafana",
					}.Fingerprint(),
				},
			},
		},
		{
			desc:                "classic condition, execution Error as Error (alerting -> query error -> alerting)",
			alertRule:           baseRuleWith(models.WithErrorExecAs(models.ErrorErrState)),
			expectedAnnotations: 3,
			evalResults: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(data.Labels{})),
				},
				t2: {
					newResult(eval.WithError(expr.MakeQueryError("A", "test-datasource-uid", errors.New("this is an error"))), eval.WithLabels(data.Labels{})),
				},
				t3: {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(data.Labels{})),
				},
			},
			expectedStates: []*state.State{
				{
					Labels:            labels["system + rule"],
					ResultFingerprint: data.Labels{}.Fingerprint(),
					State:             eval.Alerting,
					Results: []state.Evaluation{
						newEvaluation(t1, eval.Alerting),
						newEvaluation(t2, eval.Error),
						newEvaluation(t3, eval.Alerting),
					},
					StartsAt:           t3,
					EndsAt:             t3.Add(state.ResendDelay * 4),
					LastEvaluationTime: t3,
				},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			fakeAnnoRepo := annotationstest.NewFakeAnnotationsRepo()
			reg := prometheus.NewPedanticRegistry()
			stateMetrics := metrics.NewStateMetrics(reg)
			m := metrics.NewHistorianMetrics(prometheus.NewRegistry(), metrics.Subsystem)
			store := historian.NewAnnotationStore(fakeAnnoRepo, &dashboards.FakeDashboardService{}, m)
			hist := historian.NewAnnotationBackend(store, nil, m)
			clk := clock.NewMock()
			cfg := state.ManagerCfg{
				Metrics:       stateMetrics,
				ExternalURL:   nil,
				InstanceStore: &state.FakeInstanceStore{},
				Images:        &state.NotAvailableImageService{},
				Clock:         clk,
				Historian:     hist,
				Tracer:        tracing.InitializeTracerForTest(),
				Log:           log.New("ngalert.state.manager"),
			}
			st := state.NewManager(cfg, state.NewNoopPersister())

			evals := make([]time.Time, 0, len(tc.evalResults))
			for evalTime := range tc.evalResults {
				evals = append(evals, evalTime)
			}
			slices.SortFunc(evals, func(a, b time.Time) int {
				return a.Compare(b)
			})
			results := 0
			for _, evalTime := range evals {
				res := tc.evalResults[evalTime]
				for i := 0; i < len(res); i++ {
					res[i].EvaluatedAt = evalTime
				}
				clk.Set(evalTime)
				_ = st.ProcessEvalResults(context.Background(), evalTime, tc.alertRule, res, systemLabels)
				results += len(res)
			}

			states := st.GetStatesForRuleUID(tc.alertRule.OrgID, tc.alertRule.UID)
			assert.Len(t, states, len(tc.expectedStates))

			expectedStates := make(map[string]*state.State, len(tc.expectedStates))
			for _, s := range tc.expectedStates {
				// patch all optional fields of the expected state
				setCacheID(s)
				if s.AlertRuleUID == "" {
					s.AlertRuleUID = tc.alertRule.UID
				}
				if s.OrgID == 0 {
					s.OrgID = tc.alertRule.OrgID
				}
				if s.Annotations == nil {
					s.Annotations = tc.alertRule.Annotations
				}
				if s.EvaluationDuration == 0 {
					s.EvaluationDuration = evaluationDuration
				}
				if s.Values == nil {
					s.Values = make(map[string]float64)
				}
				expectedStates[s.CacheID] = s
			}

			for _, actual := range states {
				expected, ok := expectedStates[actual.CacheID]
				if !ok {
					assert.Failf(t, "state is not expected", "State: %#v", actual)
					continue
				}
				delete(expectedStates, actual.CacheID)
				if !assert.ObjectsAreEqual(expected, actual) {
					assert.Failf(t, "expected and actual states are not equal", "Diff: %s", cmp.Diff(expected, actual, cmpopts.EquateErrors()))
				}
			}

			if len(expectedStates) > 0 {
				vals := make([]state.State, 0, len(expectedStates))
				for _, s := range expectedStates {
					vals = append(vals, *s)
				}
				assert.Failf(t, "some expected states do not exist", "States: %#v", vals)
			}

			require.Eventuallyf(t, func() bool {
				return tc.expectedAnnotations == fakeAnnoRepo.Len()
			}, time.Second, 100*time.Millisecond, "%d annotations are present, expected %d. We have %+v", fakeAnnoRepo.Len(), tc.expectedAnnotations, printAllAnnotations(fakeAnnoRepo.Items()))

			expectedMetric := fmt.Sprintf(
				`# HELP grafana_alerting_state_calculation_duration_seconds The duration of calculation of a single state.
        	            # TYPE grafana_alerting_state_calculation_duration_seconds histogram
        	            grafana_alerting_state_calculation_duration_seconds_bucket{le="0.01"} %[1]d
        	            grafana_alerting_state_calculation_duration_seconds_bucket{le="0.1"} %[1]d
        	            grafana_alerting_state_calculation_duration_seconds_bucket{le="1"} %[1]d
        	            grafana_alerting_state_calculation_duration_seconds_bucket{le="2"} %[1]d
        	            grafana_alerting_state_calculation_duration_seconds_bucket{le="5"} %[1]d
        	            grafana_alerting_state_calculation_duration_seconds_bucket{le="10"} %[1]d
        	            grafana_alerting_state_calculation_duration_seconds_bucket{le="+Inf"} %[1]d
        	            grafana_alerting_state_calculation_duration_seconds_sum 0
        	            grafana_alerting_state_calculation_duration_seconds_count %[1]d
						`, results)
			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_state_calculation_duration_seconds", "grafana_alerting_state_calculation_total")
			require.NoError(t, err)
		})
	}

	t.Run("should save state to database", func(t *testing.T) {
		instanceStore := &state.FakeInstanceStore{}
		clk := clock.New()
		cfg := state.ManagerCfg{
			Metrics:                 metrics.NewNGAlert(prometheus.NewPedanticRegistry()).GetStateMetrics(),
			ExternalURL:             nil,
			InstanceStore:           instanceStore,
			Images:                  &state.NotAvailableImageService{},
			Clock:                   clk,
			Historian:               &state.FakeHistorian{},
			Tracer:                  tracing.InitializeTracerForTest(),
			Log:                     log.New("ngalert.state.manager"),
			MaxStateSaveConcurrency: 1,
		}
		statePersister := state.NewSyncStatePersisiter(log.New("ngalert.state.manager.persist"), cfg)
		st := state.NewManager(cfg, statePersister)
		rule := models.AlertRuleGen()()
		var results = eval.GenerateResults(rand.Intn(4)+1, eval.ResultGen(eval.WithEvaluatedAt(clk.Now())))

		states := st.ProcessEvalResults(context.Background(), clk.Now(), rule, results, make(data.Labels))

		require.NotEmpty(t, states)

		savedStates := make(map[string]models.AlertInstance)
		for _, op := range instanceStore.RecordedOps() {
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
	b := strings.Builder{}
	b.WriteRune('[')
	idx := make([]int64, 0, len(annos))
	for id := range annos {
		idx = append(idx, id)
	}
	slices.Sort(idx)
	for idx, id := range idx {
		if idx > 0 {
			b.WriteRune(',')
		}
		b.WriteString(fmt.Sprintf("%s: %s -> %s", time.UnixMilli(annos[id].Epoch).Format(time.TimeOnly), annos[id].PrevState, annos[id].NewState))
	}
	b.WriteRune(']')

	return b.String()
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
		expectedStates     []*state.State
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
			expectedStates: []*state.State{
				{
					AlertRuleUID: rule.UID,
					OrgID:        1,
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
					ResultFingerprint:  data.Labels{"test1": "testValue1"}.Fingerprint(),
				},
			},
			startingStateCount: 2,
			finalStateCount:    1,
		},
	}

	for _, tc := range testCases {
		ctx := context.Background()
		cfg := state.ManagerCfg{
			Metrics:       metrics.NewNGAlert(prometheus.NewPedanticRegistry()).GetStateMetrics(),
			ExternalURL:   nil,
			InstanceStore: dbstore,
			Images:        &state.NoopImageService{},
			Clock:         clock.New(),
			Historian:     &state.FakeHistorian{},
			Tracer:        tracing.InitializeTracerForTest(),
			Log:           log.New("ngalert.state.manager"),
		}
		st := state.NewManager(cfg, state.NewNoopPersister())
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
				setCacheID(s)
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
		Metrics:       metrics.NewNGAlert(prometheus.NewPedanticRegistry()).GetStateMetrics(),
		ExternalURL:   nil,
		InstanceStore: store,
		Images:        &state.NoopImageService{},
		Clock:         clk,
		Historian:     &state.FakeHistorian{},
		Tracer:        tracing.InitializeTracerForTest(),
		Log:           log.New("ngalert.state.manager"),
	}
	st := state.NewManager(cfg, state.NewNoopPersister())

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
		for _, op := range store.RecordedOps() {
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

		expectedStates []*state.State

		startingStateCacheCount int
		finalStateCacheCount    int
		startingInstanceDBCount int
		finalInstanceDBCount    int
	}{
		{
			desc:          "all states/instances are removed from cache and DB",
			instanceStore: dbstore,
			expectedStates: []*state.State{
				{
					AlertRuleUID:       rule.UID,
					OrgID:              1,
					Labels:             data.Labels{"test1": "testValue1"},
					State:              eval.Normal,
					EvaluationDuration: 0,
					Annotations:        map[string]string{"testAnnoKey": "testAnnoValue"},
				},
				{
					AlertRuleUID:       rule.UID,
					OrgID:              1,
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
		expectedStatesMap := make(map[string]*state.State, len(tc.expectedStates))
		for _, expectedState := range tc.expectedStates {
			s := setCacheID(expectedState)
			expectedStatesMap[s.CacheID] = s
		}

		t.Run(tc.desc, func(t *testing.T) {
			ctx := context.Background()
			clk := clock.NewMock()
			clk.Set(time.Now())
			cfg := state.ManagerCfg{
				Metrics:       metrics.NewNGAlert(prometheus.NewPedanticRegistry()).GetStateMetrics(),
				ExternalURL:   nil,
				InstanceStore: dbstore,
				Images:        &state.NoopImageService{},
				Clock:         clk,
				Historian:     &state.FakeHistorian{},
				Tracer:        tracing.InitializeTracerForTest(),
				Log:           log.New("ngalert.state.manager"),
			}
			st := state.NewManager(cfg, state.NewNoopPersister())
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
				assert.Contains(t, expectedStatesMap, s.CacheID)
				oldState := expectedStatesMap[s.CacheID]
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

		expectedStates []*state.State

		startingStateCacheCount  int
		finalStateCacheCount     int
		startingInstanceDBCount  int
		finalInstanceDBCount     int
		newHistorianEntriesCount int
	}{
		{
			desc:          "all states/instances are removed from cache and DB and saved in historian",
			instanceStore: dbstore,
			expectedStates: []*state.State{
				{
					AlertRuleUID:       rule.UID,
					OrgID:              1,
					Labels:             data.Labels{"test1": "testValue1"},
					State:              eval.Normal,
					EvaluationDuration: 0,
					Annotations:        map[string]string{"testAnnoKey": "testAnnoValue"},
				},
				{
					AlertRuleUID:       rule.UID,
					OrgID:              1,
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
		expectedStatesMap := stateSliceToMap(tc.expectedStates)

		t.Run(tc.desc, func(t *testing.T) {
			ctx := context.Background()
			fakeHistorian := &state.FakeHistorian{StateTransitions: make([]state.StateTransition, 0)}
			clk := clock.NewMock()
			clk.Set(time.Now())
			cfg := state.ManagerCfg{
				Metrics:       metrics.NewNGAlert(prometheus.NewPedanticRegistry()).GetStateMetrics(),
				ExternalURL:   nil,
				InstanceStore: dbstore,
				Images:        &state.NoopImageService{},
				Clock:         clk,
				Historian:     fakeHistorian,
				Tracer:        tracing.InitializeTracerForTest(),
				Log:           log.New("ngalert.state.manager"),
			}
			st := state.NewManager(cfg, state.NewNoopPersister())
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
				assert.Contains(t, expectedStatesMap, s.CacheID)
				oldState := expectedStatesMap[s.CacheID]
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

func setCacheID(s *state.State) *state.State {
	if s.CacheID != "" {
		return s
	}
	il := models.InstanceLabels(s.Labels)
	id, err := il.StringKey()
	if err != nil {
		panic(err)
	}
	s.CacheID = id
	return s
}

func stateSliceToMap(states []*state.State) map[string]*state.State {
	result := make(map[string]*state.State, len(states))
	for _, s := range states {
		setCacheID(s)
		result[s.CacheID] = s
	}
	return result
}

func mergeLabels(a, b data.Labels) data.Labels {
	result := make(data.Labels, len(a)+len(b))
	for k, v := range a {
		result[k] = v
	}
	for k, v := range b {
		result[k] = v
	}
	return result
}
