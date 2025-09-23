package state

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
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
)

func TestStateIsStale(t *testing.T) {
	now := time.Now()
	intervalSeconds := rand.Int63n(10) + 5

	testCases := []struct {
		name           string
		lastEvaluation time.Time
		expectedResult bool
	}{
		{
			name:           "false if last evaluation is now",
			lastEvaluation: now,
			expectedResult: false,
		},
		{
			name:           "false if last evaluation is 1 interval before now",
			lastEvaluation: now.Add(-time.Duration(intervalSeconds)),
			expectedResult: false,
		},
		{
			name:           "false if last evaluation is little less than 2 interval before now",
			lastEvaluation: now.Add(-time.Duration(intervalSeconds) * time.Second * 2).Add(100 * time.Millisecond),
			expectedResult: false,
		},
		{
			name:           "true if last evaluation is 2 intervals from now",
			lastEvaluation: now.Add(-time.Duration(intervalSeconds) * time.Second * 2),
			expectedResult: true,
		},
		{
			name:           "true if last evaluation is 3 intervals from now",
			lastEvaluation: now.Add(-time.Duration(intervalSeconds) * time.Second * 3),
			expectedResult: true,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.expectedResult, stateIsStale(now, tc.lastEvaluation, intervalSeconds))
		})
	}
}

// TestProcessEvalResults_StateTransitions tests how state.Manager's ProcessEvalResults processes results and creates or changes states.
// In other words, it tests the state transition.
//
// The tests use a micro-framework that has the following features:
//  1. It uses a base rule definition and allows each test case mutate its copy.
//  2. Expected State definition omits several fields which are patched before assertion
//     if they are not specified explicitly (see function "patchState" for patched fields).
//     This allows specifications to be more condense and mention only important fields.
//  3. Expected State definition uses some shortcut functions to make the specification more clear.
//     Expected labels are populated from a labels map where keys = description of what labels included in its values.
//     This allows us to specify the list of labels expected to be in the state in one line, e.g. "system + rule + labels1"
//     Evaluations are populated using function `newEvaluation` that pre-set all important fields.
//  4. Each test case can contain multiple consecutive evaluations at different times with assertions at every interval.
//     The framework offers variables t1, t2, t3 and function tN(n) that provide timestamps of different evaluations.
//  5. NoData and Error tests require assertions for all possible execution options for the same input.
//
// # Naming convention for tests cases.
//
// The tests are formatted to the input characteristics, such as rule definition,
// result format (multi- or single- dimensional) and at which times the assertions are defined.
//
// <time>[(<labelSet>:)<eval.State>] (and <rule_modifications>) at <asserted_time>
//
//	Where:
//	  - <time> can be t1, t2 or t3, i.e. timestamp of evaluation.
//	  - <labelSet> indicates the label set of the normal result. It can be 1,2,3 which corresponds to labels1, labels2 and labels3, or {} for results without labels.
//	    In the case of NoData or Error labelSet is omitted
//	  - <rule_modifications> rule modifications.
//	  - <asserted_time> at which time intervals the test executes assertions. Can be t1,t2 or t3.
//
// For example:
//
//	t1[1:normal] t2[1:alerting] and 'for'=2 at t2
//	t1[{}:alerting] t2[{}:normal] t3[NoData] at t2,t3
//
//nolint:gocyclo
func TestProcessEvalResults_StateTransitions(t *testing.T) {
	evaluationDuration := 10 * time.Millisecond
	evaluationInterval := 10 * time.Second

	tN := func(n int) time.Time {
		return time.Unix(0, 0).UTC().Add(time.Duration(n) * evaluationInterval)
	}
	t1 := tN(1)
	t2 := tN(2)
	t3 := tN(3)

	baseRule := &ngmodels.AlertRule{
		OrgID: 1,
		Title: "test_title",
		UID:   "test_alert_rule_uid",
		Data: []ngmodels.AlertQuery{{
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
		NoDataState:     ngmodels.NoData,
		ExecErrState:    ngmodels.ErrorErrState,
	}

	baseRuleWith := func(mutators ...ngmodels.AlertRuleMutator) *ngmodels.AlertRule {
		return ngmodels.CopyRule(baseRule, mutators...)
	}

	newEvaluationWithValues := func(evalTime time.Time, evalState eval.State, values map[string]float64) *Evaluation {
		return &Evaluation{
			EvaluationTime:  evalTime,
			EvaluationState: evalState,
			Values:          values,
		}
	}

	newEvaluation := func(evalTime time.Time, evalState eval.State) *Evaluation {
		return newEvaluationWithValues(evalTime, evalState, make(map[string]float64))
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

	genericError := errors.New("test-error")
	datasourceError := expr.MakeQueryError("A", "datasource_uid_1", errors.New("this is an error"))
	expectedDatasourceErrorLabels := data.Labels{
		"datasource_uid": "datasource_uid_1",
		"ref_id":         "A",
	}

	labels1 := data.Labels{
		"instance_label": "test-1",
	}
	labels2 := data.Labels{
		"instance_label": "test-2",
	}
	labels3 := data.Labels{
		"instance_label": "test-3",
	}
	systemLabels := data.Labels{
		"system": "owned",
	}
	noDataLabels := data.Labels{
		"datasource_uid": "1",
		"ref_id":         "A",
	}

	noDataAnnotations := data.Labels{
		"datasource_uid": "1",
		"ref_id":         "A",
	}
	genericErrorAnnotations := mergeLabels(
		baseRule.Annotations,
		data.Labels{
			"Error": genericError.Error(),
		},
	)
	datasourceErrorAnnotations := mergeLabels(
		baseRule.Annotations,
		data.Labels{
			"datasource_uid": "datasource_uid_1",
			"ref_id":         "A",
			"Error":          datasourceError.Error(),
		},
	)

	labels := map[string]data.Labels{
		"system + rule":                    mergeLabels(baseRule.Labels, systemLabels),
		"system + rule + labels1":          mergeLabels(mergeLabels(labels1, baseRule.Labels), systemLabels),
		"system + rule + labels2":          mergeLabels(mergeLabels(labels2, baseRule.Labels), systemLabels),
		"system + rule + labels3":          mergeLabels(mergeLabels(labels3, baseRule.Labels), systemLabels),
		"system + rule + no-data":          mergeLabels(mergeLabels(noDataLabels, baseRule.Labels), systemLabels),
		"system + rule + datasource-error": mergeLabels(mergeLabels(expectedDatasourceErrorLabels, baseRule.Labels), systemLabels),
	}

	resultFingerprints := map[string]data.Fingerprint{
		"system + rule":                    data.Labels{}.Fingerprint(),
		"system + rule + labels1":          labels1.Fingerprint(),
		"system + rule + labels2":          labels2.Fingerprint(),
		"system + rule + labels3":          labels3.Fingerprint(),
		"system + rule + no-data":          noDataLabels.Fingerprint(),
		"system + rule + datasource-error": data.Labels{}.Fingerprint(),
	}

	patchState := func(r *ngmodels.AlertRule, s *State) {
		// patch all optional fields of the expected state
		setCacheID(s)
		if s.AlertRuleUID == "" {
			s.AlertRuleUID = r.UID
		}
		if s.OrgID == 0 {
			s.OrgID = r.OrgID
		}
		if s.Annotations == nil {
			s.Annotations = r.Annotations
		}
		if s.EvaluationDuration == 0 {
			s.EvaluationDuration = evaluationDuration
		}
		if s.Values == nil {
			s.Values = make(map[string]float64)
		}
		if s.ResultFingerprint == data.Fingerprint(0) {
			for key, set := range labels {
				if set.Fingerprint() == s.Labels.Fingerprint() {
					s.ResultFingerprint = resultFingerprints[key]
					break
				}
			}
		}
	}

	executeTest := func(t *testing.T, alertRule *ngmodels.AlertRule, resultsAtTime map[time.Time]eval.Results, expectedTransitionsAtTime map[time.Time][]StateTransition, applyNoDataErrorToAllStates bool) {
		clk := clock.NewMock()

		testMetrics := metrics.NewNGAlert(prometheus.NewPedanticRegistry()).GetStateMetrics()
		cfg := ManagerCfg{
			Metrics:       testMetrics,
			Tracer:        tracing.InitializeTracerForTest(),
			Log:           log.New("ngalert.state.manager"),
			ExternalURL:   nil,
			InstanceStore: &FakeInstanceStore{},
			Images:        &NotAvailableImageService{},
			Clock:         clk,
			Historian:     &FakeHistorian{},

			ApplyNoDataAndErrorToAllStates: applyNoDataErrorToAllStates,
		}
		st := NewManager(cfg, NewNoopPersister())

		tss := make([]time.Time, 0, len(resultsAtTime))
		for ts, results := range resultsAtTime {
			for i := range results {
				results[i].EvaluatedAt = ts
			}
			tss = append(tss, ts)
		}
		sort.Slice(tss, func(i, j int) bool {
			return tss[i].Before(tss[j])
		})

		for _, ts := range tss {
			results := resultsAtTime[ts]
			clk.Set(ts)
			var statesToSend StateTransitions
			actual := st.ProcessEvalResults(context.Background(), ts, alertRule, results, systemLabels, func(_ context.Context, states StateTransitions) {
				statesToSend = states
			})

			// Expect all statesToSend to have a LastSentAt set to the evaluation time.
			for _, state := range statesToSend {
				assert.Equalf(t, ts, *state.LastSentAt, "LastSentAt should be set to the evaluation time for all ready-to-send transitions.")
			}

			expectedTransitions, ok := expectedTransitionsAtTime[ts]
			if !ok { // skip if nothing to assert
				continue
			}
			expectedTransitionsMap := make(map[data.Fingerprint]StateTransition, len(expectedTransitions))
			for i := range expectedTransitions {
				patchState(alertRule, expectedTransitions[i].State)
				expectedTransitionsMap[expectedTransitions[i].CacheID] = expectedTransitions[i]
			}

			tn := ts.Sub(t1)/evaluationInterval + 1
			for _, transition := range actual {
				expected, ok := expectedTransitionsMap[transition.CacheID]
				if !ok {
					assert.Failf(t, fmt.Sprintf("transition is not expected at time [t%d]", tn), "CacheID: %s.\nTransition: %s->%s", transition.CacheID, transition.PreviousFormatted(), transition.Formatted())
				}
				delete(expectedTransitionsMap, transition.CacheID)
				if !assert.ObjectsAreEqual(expected, transition) {
					assert.Failf(t, fmt.Sprintf("expected and actual transitions at time [t%d] are not equal", tn), "CacheID: %s\nDiff: %s", transition.CacheID, cmp.Diff(expected, transition, cmpopts.EquateErrors()))
				}
			}
			if len(expectedTransitionsMap) > 0 {
				vals := make([]data.Fingerprint, 0, len(expectedTransitionsMap))
				for _, s := range expectedTransitionsMap {
					vals = append(vals, s.CacheID)
				}
				assert.Failf(t, fmt.Sprintf("some expected states do not exist at time [t%d]", tn), "States: %v", vals)
			}
		}
	}

	type testCase struct {
		desc                string
		alertRule           *ngmodels.AlertRule
		results             map[time.Time]eval.Results
		expectedTransitions map[time.Time][]StateTransition
	}

	testCases := []testCase{
		{
			desc:      "t1[1:normal,2:normal] at t1",
			alertRule: baseRule,
			results: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels2)),
				},
			},
			expectedTransitions: map[time.Time][]StateTransition{
				t1: {
					{
						PreviousState: eval.Normal,
						State: &State{
							Labels:             labels["system + rule + labels1"],
							State:              eval.Normal,
							LatestResult:       newEvaluation(t1, eval.Normal),
							StartsAt:           t1,
							EndsAt:             t1,
							LastEvaluationTime: t1,
						},
					},
					{
						PreviousState: eval.Normal,
						State: &State{
							Labels:             labels["system + rule + labels2"],
							State:              eval.Normal,
							LatestResult:       newEvaluation(t1, eval.Normal),
							StartsAt:           t1,
							EndsAt:             t1,
							LastEvaluationTime: t1,
						},
					},
				},
			},
		},
		{
			desc:      "t1[1:alerting,2:normal] at t1",
			alertRule: baseRule,
			results: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels2)),
				},
			},
			expectedTransitions: map[time.Time][]StateTransition{
				t1: {
					{
						PreviousState: eval.Normal,
						State: &State{
							Labels:             labels["system + rule + labels1"],
							State:              eval.Alerting,
							LatestResult:       newEvaluation(t1, eval.Alerting),
							StartsAt:           t1,
							EndsAt:             t1.Add(ResendDelay * 4),
							LastEvaluationTime: t1,
							LastSentAt:         &t1,
						},
					},
					{
						PreviousState: eval.Normal,
						State: &State{
							Labels:             labels["system + rule + labels2"],
							State:              eval.Normal,
							LatestResult:       newEvaluation(t1, eval.Normal),
							StartsAt:           t1,
							EndsAt:             t1,
							LastEvaluationTime: t1,
						},
					},
				},
			},
		},
		{
			desc:      "t1[1:alerting,2:normal] and 'for'>0 at t1",
			alertRule: baseRuleWith(ngmodels.RuleMuts.WithForNTimes(3)),
			results: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels2)),
				},
			},
			expectedTransitions: map[time.Time][]StateTransition{
				t1: {
					{
						PreviousState: eval.Normal,
						State: &State{
							Labels:             labels["system + rule + labels1"],
							State:              eval.Pending,
							LatestResult:       newEvaluation(t1, eval.Alerting),
							StartsAt:           t1,
							EndsAt:             t1.Add(ResendDelay * 4),
							LastEvaluationTime: t1,
						},
					},
					{
						PreviousState: eval.Normal,
						State: &State{
							Labels:             labels["system + rule + labels2"],
							State:              eval.Normal,
							LatestResult:       newEvaluation(t1, eval.Normal),
							StartsAt:           t1,
							EndsAt:             t1,
							LastEvaluationTime: t1,
						},
					},
				},
			},
		},
		{
			desc:      "t1[1:normal,2:normal] t2[1:alerting,2:normal] at t2",
			alertRule: baseRule,
			results: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels2)),
				},
				t2: {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels2)),
				},
			},
			expectedTransitions: map[time.Time][]StateTransition{
				t2: {
					{
						PreviousState: eval.Normal,
						State: &State{
							Labels:             labels["system + rule + labels1"],
							State:              eval.Alerting,
							LatestResult:       newEvaluation(t2, eval.Alerting),
							StartsAt:           t2,
							EndsAt:             t2.Add(ResendDelay * 4),
							LastEvaluationTime: t2,
							LastSentAt:         &t2,
						},
					},
					{
						PreviousState: eval.Normal,
						State: &State{
							Labels:             labels["system + rule + labels2"],
							State:              eval.Normal,
							LatestResult:       newEvaluation(t2, eval.Normal),
							StartsAt:           t1,
							EndsAt:             t1,
							LastEvaluationTime: t2,
						},
					},
				},
			},
		},
		{
			desc:      "t1[1:alerting] t2[1:alerting] t3[1:alerting] and 'for'=2 at t1,t2,t3",
			alertRule: baseRuleWith(ngmodels.RuleMuts.WithForNTimes(2)),
			results: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
				},
				t2: {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
				},
				t3: {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
				},
			},
			expectedTransitions: map[time.Time][]StateTransition{
				t1: {
					{
						PreviousState: eval.Normal,
						State: &State{
							Labels:             labels["system + rule + labels1"],
							State:              eval.Pending,
							LatestResult:       newEvaluation(t1, eval.Alerting),
							StartsAt:           t1,
							EndsAt:             t1.Add(ResendDelay * 4),
							LastEvaluationTime: t1,
						},
					},
				},
				t2: {
					{
						PreviousState: eval.Pending,
						State: &State{
							Labels:             labels["system + rule + labels1"],
							State:              eval.Pending,
							LatestResult:       newEvaluation(t2, eval.Alerting),
							StartsAt:           t1,
							EndsAt:             t1.Add(ResendDelay * 4), // TODO probably it should be t1 (semantic of Normal)?
							LastEvaluationTime: t2,
						},
					},
				},
				t3: {
					{
						PreviousState: eval.Pending,
						State: &State{
							Labels:             labels["system + rule + labels1"],
							State:              eval.Alerting,
							LatestResult:       newEvaluation(t3, eval.Alerting),
							StartsAt:           t3,
							EndsAt:             t3.Add(ResendDelay * 4),
							LastEvaluationTime: t3,
							LastSentAt:         &t3,
						},
					},
				},
			},
		},
		{
			desc:      "t1[1:alerting], t2[1:normal] and 'for'=2 at t2",
			alertRule: baseRuleWith(ngmodels.RuleMuts.WithForNTimes(2)),
			results: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
				},
				t2: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
				},
			},
			expectedTransitions: map[time.Time][]StateTransition{
				t2: {
					{
						PreviousState: eval.Pending,
						State: &State{
							Labels:             labels["system + rule + labels1"],
							State:              eval.Normal,
							LatestResult:       newEvaluation(t2, eval.Normal),
							StartsAt:           t2,
							EndsAt:             t2,
							LastEvaluationTime: t2,
						},
					},
				},
			},
		},
		{
			desc:      "t1:[1:alerting] t2[1:normal] at t2",
			alertRule: baseRule,
			results: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
				},
				t2: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
				},
			},
			expectedTransitions: map[time.Time][]StateTransition{
				t2: {{
					PreviousState: eval.Alerting,
					State: &State{
						Labels:             labels["system + rule + labels1"],
						State:              eval.Normal,
						LatestResult:       newEvaluation(t2, eval.Normal),
						StartsAt:           t2,
						EndsAt:             t2,
						LastEvaluationTime: t2,
						ResolvedAt:         &t2,
						LastSentAt:         &t2,
					},
				},
				},
			},
		},
		{
			desc:      "t1[1:normal,2:alerting,3:normal] t2[3:normal] t3[3:normal] at t2,t3",
			alertRule: baseRule,
			results: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels2)),
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels3)),
				},
				t2: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels3)),
				},
				t3: {
					newResult(eval.WithState(eval.Normal), eval.WithLabels(labels3)),
				},
			},
			expectedTransitions: map[time.Time][]StateTransition{
				t2: {
					{
						PreviousState: eval.Normal,
						State: &State{
							Labels:             labels["system + rule + labels3"],
							State:              eval.Normal,
							LatestResult:       newEvaluation(t2, eval.Normal),
							StartsAt:           t1,
							EndsAt:             t1,
							LastEvaluationTime: t2,
						},
					},
				},
				t3: {
					{
						PreviousState: eval.Normal,
						State: &State{
							Labels:             labels["system + rule + labels1"],
							State:              eval.Normal,
							StateReason:        ngmodels.StateReasonMissingSeries,
							LatestResult:       newEvaluation(t1, eval.Normal),
							StartsAt:           t1,
							EndsAt:             t3,
							LastEvaluationTime: t3,
						},
					},
					{
						PreviousState: eval.Alerting,
						State: &State{
							Labels:             labels["system + rule + labels2"],
							State:              eval.Normal,
							StateReason:        ngmodels.StateReasonMissingSeries,
							LatestResult:       newEvaluation(t1, eval.Alerting),
							StartsAt:           t1,
							EndsAt:             t3,
							LastEvaluationTime: t3,
							ResolvedAt:         &t3,
							LastSentAt:         &t3,
						},
					},
					{
						PreviousState: eval.Normal,
						State: &State{
							Labels:             labels["system + rule + labels3"],
							State:              eval.Normal,
							LatestResult:       newEvaluation(t3, eval.Normal),
							StartsAt:           t1,
							EndsAt:             t1,
							LastEvaluationTime: t3,
						},
					},
				},
			},
		},
		{
			desc:      "t1[{}:normal] at t1",
			alertRule: baseRule,
			results: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Normal)),
				},
			},
			expectedTransitions: map[time.Time][]StateTransition{
				t1: {
					{
						PreviousState: eval.Normal,
						State: &State{
							Labels:             labels["system + rule"],
							State:              eval.Normal,
							LatestResult:       newEvaluation(t1, eval.Normal),
							StartsAt:           t1,
							EndsAt:             t1,
							LastEvaluationTime: t1,
						},
					},
				},
			},
		},
		{
			desc:      "t1[{}:alerting] at t1",
			alertRule: baseRule,
			results: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Alerting)),
				},
			},
			expectedTransitions: map[time.Time][]StateTransition{
				t1: {
					{
						PreviousState: eval.Normal,
						State: &State{
							Labels:             labels["system + rule"],
							State:              eval.Alerting,
							LatestResult:       newEvaluation(t1, eval.Alerting),
							StartsAt:           t1,
							EndsAt:             t1.Add(ResendDelay * 4),
							LastEvaluationTime: t1,
							LastSentAt:         &t1,
						},
					},
				},
			},
		},
		{
			desc:      "t1[{}:alerting] and 'for'>0  at t1",
			alertRule: baseRuleWith(ngmodels.RuleMuts.WithForNTimes(3)),
			results: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Alerting)),
				},
			},
			expectedTransitions: map[time.Time][]StateTransition{
				t1: {
					{
						PreviousState: eval.Normal,
						State: &State{
							Labels:             labels["system + rule"],
							State:              eval.Pending,
							LatestResult:       newEvaluation(t1, eval.Alerting),
							StartsAt:           t1,
							EndsAt:             t1.Add(ResendDelay * 4),
							LastEvaluationTime: t1,
						},
					},
				},
			},
		},
		{
			desc:      "t1[{}:normal] t2[{}:alerting] at t2",
			alertRule: baseRule,
			results: map[time.Time]eval.Results{
				t1: {
					newResult(eval.WithState(eval.Normal)),
				},
				t2: {
					newResult(eval.WithState(eval.Alerting)),
				},
			},
			expectedTransitions: map[time.Time][]StateTransition{
				t2: {
					{
						PreviousState: eval.Normal,
						State: &State{
							Labels:             labels["system + rule"],
							State:              eval.Alerting,
							LatestResult:       newEvaluation(t2, eval.Alerting),
							StartsAt:           t2,
							EndsAt:             t2.Add(ResendDelay * 4),
							LastEvaluationTime: t2,
							LastSentAt:         &t2,
						},
					},
				},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			t.Run("applyNoDataErrorToAllStates=true", func(t *testing.T) {
				executeTest(t, tc.alertRule, tc.results, tc.expectedTransitions, true)
			})
			t.Run("applyNoDataErrorToAllStates=false", func(t *testing.T) {
				executeTest(t, tc.alertRule, tc.results, tc.expectedTransitions, false)
			})
		})
	}

	t.Run("no-data", func(t *testing.T) {
		rules := map[ngmodels.NoDataState]*ngmodels.AlertRule{
			ngmodels.NoData:   baseRuleWith(ngmodels.RuleMuts.WithNoDataExecAs(ngmodels.NoData)),
			ngmodels.Alerting: baseRuleWith(ngmodels.RuleMuts.WithNoDataExecAs(ngmodels.Alerting)),
			ngmodels.OK:       baseRuleWith(ngmodels.RuleMuts.WithNoDataExecAs(ngmodels.OK)),
			ngmodels.KeepLast: baseRuleWith(ngmodels.RuleMuts.WithNoDataExecAs(ngmodels.KeepLast)),
		}

		type noDataTestCase struct {
			desc                string
			ruleMutators        []ngmodels.AlertRuleMutator
			results             map[time.Time]eval.Results
			expectedTransitions map[ngmodels.NoDataState]map[time.Time][]StateTransition

			expectedTransitionsApplyNoDataErrorToAllStates map[ngmodels.NoDataState]map[time.Time][]StateTransition
		}

		executeForEachRule := func(t *testing.T, tc noDataTestCase) {
			t.Helper()
			for stateExec, rule := range rules {
				r := rule
				if len(tc.ruleMutators) > 0 {
					r = ngmodels.CopyRule(r, tc.ruleMutators...)
				}
				t.Run(fmt.Sprintf("execute as %s", stateExec), func(t *testing.T) {
					expectedTransitions, ok := tc.expectedTransitionsApplyNoDataErrorToAllStates[stateExec]
					overridden := "[*]"
					if !ok {
						expectedTransitions, ok = tc.expectedTransitions[stateExec]
						overridden = ""
					}
					if !ok {
						require.Fail(t, "no expected state transitions")
					}
					t.Run("applyNoDataErrorToAllStates=true"+overridden, func(t *testing.T) {
						executeTest(t, r, tc.results, expectedTransitions, true)
					})
					t.Run("applyNoDataErrorToAllStates=false", func(t *testing.T) {
						expectedTransitions, ok := tc.expectedTransitions[stateExec]
						if !ok {
							require.Fail(t, "no expected state transitions")
						}
						executeTest(t, r, tc.results, expectedTransitions, false)
					})
				})
			}
		}

		testCases := []noDataTestCase{
			{
				desc: "t1[NoData] at t1",
				results: map[time.Time]eval.Results{
					t1: {
						newResult(eval.WithState(eval.NoData), eval.WithLabels(noDataLabels)),
					},
				},
				expectedTransitions: map[ngmodels.NoDataState]map[time.Time][]StateTransition{
					ngmodels.NoData: {
						t1: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.NoData,
									LatestResult:       newEvaluation(t1, eval.NoData),
									StartsAt:           t1,
									EndsAt:             t1.Add(ResendDelay * 4),
									LastEvaluationTime: t1,
									LastSentAt:         &t1,
								},
							},
						},
					},
					ngmodels.Alerting: {
						t1: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.Alerting,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t1, eval.NoData),
									StartsAt:           t1,
									EndsAt:             t1.Add(ResendDelay * 4),
									LastEvaluationTime: t1,
									LastSentAt:         &t1,
								},
							},
						},
					},
					ngmodels.OK: {
						t1: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.Normal,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t1, eval.NoData),
									StartsAt:           t1,
									EndsAt:             t1,
									LastEvaluationTime: t1,
								},
							},
						},
					},
					ngmodels.KeepLast: {
						t1: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.Normal,
									StateReason:        ngmodels.ConcatReasons(eval.NoData.String(), ngmodels.StateReasonKeepLast),
									LatestResult:       newEvaluation(t1, eval.NoData),
									StartsAt:           t1,
									EndsAt:             t1,
									LastEvaluationTime: t1,
								},
							},
						},
					},
				},
			},
			{
				desc: "t1[1:normal] t2[NoData] at t2",
				results: map[time.Time]eval.Results{
					t1: {
						newResult(
							eval.WithState(eval.Normal),
							eval.WithLabels(labels1),
							eval.WithValues(map[string]eval.NumberValueCapture{"A": {Var: "A", Value: util.Pointer(1.0)}}),
						),
					},
					t2: {
						newResult(eval.WithState(eval.NoData), eval.WithLabels(noDataLabels)),
					},
				},
				expectedTransitions: map[ngmodels.NoDataState]map[time.Time][]StateTransition{
					ngmodels.NoData: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.NoData,
									LatestResult:       newEvaluation(t2, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
									LastSentAt:         &t2,
									Values:             map[string]float64{},
								},
							},
						},
					},
					ngmodels.Alerting: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.Alerting,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluationWithValues(t2, eval.NoData, map[string]float64{}),
									StartsAt:           t2,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
									LastSentAt:         &t2,
									Values:             map[string]float64{},
								},
							},
						},
					},
					ngmodels.OK: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.Normal,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluationWithValues(t2, eval.NoData, map[string]float64{}),
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t2,
									Values:             map[string]float64{},
								},
							},
						},
					},
					ngmodels.KeepLast: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.Normal,
									StateReason:        ngmodels.ConcatReasons(eval.NoData.String(), ngmodels.StateReasonKeepLast),
									LatestResult:       newEvaluation(t2, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t2,
								},
							},
						},
					},
				},
				expectedTransitionsApplyNoDataErrorToAllStates: map[ngmodels.NoDataState]map[time.Time][]StateTransition{
					ngmodels.Alerting: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Alerting,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluationWithValues(t2, eval.NoData, map[string]float64{"A": float64(-1)}),
									StartsAt:           t2,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
									LastSentAt:         &t2,
									Values:             map[string]float64{"A": float64(-1)},
								},
							},
						},
					},
					ngmodels.OK: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Normal,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluationWithValues(t2, eval.NoData, map[string]float64{"A": float64(-1)}),
									StartsAt:           t1,
									EndsAt:             t1,
									LastEvaluationTime: t2,
									Values:             map[string]float64{"A": float64(-1)},
								},
							},
						},
					},
					ngmodels.KeepLast: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Normal,
									StateReason:        ngmodels.ConcatReasons(eval.NoData.String(), ngmodels.StateReasonKeepLast),
									LatestResult:       newEvaluationWithValues(t2, eval.NoData, map[string]float64{"A": float64(-1)}),
									StartsAt:           t1,
									EndsAt:             t1,
									LastEvaluationTime: t2,
									Values:             map[string]float64{"A": float64(-1)},
								},
							},
						},
					},
				},
			},
			{
				desc: "t1[1:normal,2:alerting] t2[NoData] t3[NoData] at t2,t3",
				results: map[time.Time]eval.Results{
					t1: {
						newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
						newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels2)),
					},
					t2: {
						newResult(eval.WithState(eval.NoData), eval.WithLabels(noDataLabels)),
					},
					t3: {
						newResult(eval.WithState(eval.NoData), eval.WithLabels(noDataLabels)),
					},
				},
				expectedTransitions: map[ngmodels.NoDataState]map[time.Time][]StateTransition{
					ngmodels.NoData: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.NoData,
									LatestResult:       newEvaluation(t2, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
									LastSentAt:         &t2,
								},
							},
						},
						t3: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									State:              eval.Normal,
									StateReason:        ngmodels.StateReasonMissingSeries,
									LatestResult:       newEvaluation(t1, eval.Normal),
									StartsAt:           t1,
									EndsAt:             t3,
									LastEvaluationTime: t3,
								},
							},
							{
								PreviousState: eval.Alerting,
								State: &State{
									Labels:             labels["system + rule + labels2"],
									State:              eval.Normal,
									StateReason:        ngmodels.StateReasonMissingSeries,
									LatestResult:       newEvaluation(t1, eval.Alerting),
									StartsAt:           t1,
									EndsAt:             t3,
									LastEvaluationTime: t3,
									ResolvedAt:         &t3,
									LastSentAt:         &t3,
								},
							},
							{
								PreviousState: eval.NoData,
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.NoData,
									LatestResult:       newEvaluation(t3, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t3.Add(ResendDelay * 4),
									LastEvaluationTime: t3,
									LastSentAt:         &t2,
								},
							},
						},
					},
					ngmodels.Alerting: {
						t3: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									State:              eval.Normal,
									StateReason:        ngmodels.StateReasonMissingSeries,
									LatestResult:       newEvaluation(t1, eval.Normal),
									StartsAt:           t1,
									EndsAt:             t3,
									LastEvaluationTime: t3,
								},
							},
							{
								PreviousState: eval.Alerting,
								State: &State{
									Labels:             labels["system + rule + labels2"],
									State:              eval.Normal,
									StateReason:        ngmodels.StateReasonMissingSeries,
									LatestResult:       newEvaluation(t1, eval.Alerting),
									StartsAt:           t1,
									EndsAt:             t3,
									LastEvaluationTime: t3,
									ResolvedAt:         &t3,
									LastSentAt:         &t3,
								},
							},
							{
								PreviousState:       eval.Alerting,
								PreviousStateReason: eval.NoData.String(),
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.Alerting,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t3, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t3.Add(ResendDelay * 4),
									LastEvaluationTime: t3,
									LastSentAt:         &t2,
								},
							},
						},
					},
					ngmodels.OK: {
						t3: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									State:              eval.Normal,
									StateReason:        ngmodels.StateReasonMissingSeries,
									LatestResult:       newEvaluation(t1, eval.Normal),
									StartsAt:           t1,
									EndsAt:             t3,
									LastEvaluationTime: t3,
								},
							},
							{
								PreviousState: eval.Alerting,
								State: &State{
									Labels:             labels["system + rule + labels2"],
									State:              eval.Normal,
									StateReason:        ngmodels.StateReasonMissingSeries,
									LatestResult:       newEvaluation(t1, eval.Alerting),
									StartsAt:           t1,
									EndsAt:             t3,
									LastEvaluationTime: t3,
									ResolvedAt:         &t3,
									LastSentAt:         &t3,
								},
							},
							{
								PreviousState:       eval.Normal,
								PreviousStateReason: eval.NoData.String(),
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.Normal,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t3, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t3,
								},
							},
						},
					},
					ngmodels.KeepLast: {
						t3: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									State:              eval.Normal,
									StateReason:        ngmodels.StateReasonMissingSeries,
									LatestResult:       newEvaluation(t1, eval.Normal),
									StartsAt:           t1,
									EndsAt:             t3,
									LastEvaluationTime: t3,
								},
							},
							{
								PreviousState: eval.Alerting,
								State: &State{
									Labels:             labels["system + rule + labels2"],
									State:              eval.Normal,
									StateReason:        ngmodels.StateReasonMissingSeries,
									LatestResult:       newEvaluation(t1, eval.Alerting),
									StartsAt:           t1,
									EndsAt:             t3,
									LastEvaluationTime: t3,
									ResolvedAt:         &t3,
									LastSentAt:         &t3,
								},
							},
							{
								PreviousState:       eval.Normal,
								PreviousStateReason: ngmodels.ConcatReasons(eval.NoData.String(), ngmodels.StateReasonKeepLast),
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.Normal,
									StateReason:        ngmodels.ConcatReasons(eval.NoData.String(), ngmodels.StateReasonKeepLast),
									LatestResult:       newEvaluation(t3, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t3,
								},
							},
						},
					},
				},
				expectedTransitionsApplyNoDataErrorToAllStates: map[ngmodels.NoDataState]map[time.Time][]StateTransition{
					ngmodels.Alerting: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Alerting,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t2, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
									LastSentAt:         &t2,
								},
							},
							{
								PreviousState: eval.Alerting,
								State: &State{
									Labels:             labels["system + rule + labels2"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Alerting,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t2, eval.NoData),
									StartsAt:           t1,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
									LastSentAt:         &t1,
								},
							},
						},
						t3: {
							{
								PreviousState:       eval.Alerting,
								PreviousStateReason: eval.NoData.String(),
								State: &State{
									Labels:             labels["system + rule + labels1"],
									State:              eval.Alerting,
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t3, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t3.Add(ResendDelay * 4),
									LastEvaluationTime: t3,
									LastSentAt:         &t2,
								},
							},
							{
								PreviousState:       eval.Alerting,
								PreviousStateReason: eval.NoData.String(),
								State: &State{
									Labels:             labels["system + rule + labels2"],
									State:              eval.Alerting,
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t3, eval.NoData),
									StartsAt:           t1,
									EndsAt:             t3.Add(ResendDelay * 4),
									LastEvaluationTime: t3,
									LastSentAt:         &t1,
								},
							},
						},
					},
					ngmodels.OK: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Normal,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t2, eval.NoData),
									StartsAt:           t1,
									EndsAt:             t1,
									LastEvaluationTime: t2,
								},
							},
							{
								PreviousState: eval.Alerting,
								State: &State{
									Labels:             labels["system + rule + labels2"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Normal,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t2, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t2,
									ResolvedAt:         &t2,
									LastSentAt:         &t2,
								},
							},
						},
						t3: {
							{
								PreviousState:       eval.Normal,
								PreviousStateReason: eval.NoData.String(),
								State: &State{
									Labels:             labels["system + rule + labels1"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Normal,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t3, eval.NoData),
									StartsAt:           t1,
									EndsAt:             t1,
									LastEvaluationTime: t3,
								},
							},
							{
								PreviousState:       eval.Normal,
								PreviousStateReason: eval.NoData.String(),
								State: &State{
									Labels:             labels["system + rule + labels2"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Normal,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t3, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t3,
									ResolvedAt:         &t2,
									LastSentAt:         &t2,
								},
							},
						},
					},
					ngmodels.KeepLast: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Normal,
									StateReason:        ngmodels.ConcatReasons(eval.NoData.String(), ngmodels.StateReasonKeepLast),
									LatestResult:       newEvaluation(t2, eval.NoData),
									StartsAt:           t1,
									EndsAt:             t1,
									LastEvaluationTime: t2,
								},
							},
							{
								PreviousState: eval.Alerting,
								State: &State{
									Labels:             labels["system + rule + labels2"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Alerting,
									StateReason:        ngmodels.ConcatReasons(eval.NoData.String(), ngmodels.StateReasonKeepLast),
									LatestResult:       newEvaluation(t2, eval.NoData),
									StartsAt:           t1,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
									LastSentAt:         &t1,
								},
							},
						},
						t3: {
							{
								PreviousState:       eval.Normal,
								PreviousStateReason: ngmodels.ConcatReasons(eval.NoData.String(), ngmodels.StateReasonKeepLast),
								State: &State{
									Labels:             labels["system + rule + labels1"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Normal,
									StateReason:        ngmodels.ConcatReasons(eval.NoData.String(), ngmodels.StateReasonKeepLast),
									LatestResult:       newEvaluation(t3, eval.NoData),
									StartsAt:           t1,
									EndsAt:             t1,
									LastEvaluationTime: t3,
								},
							},
							{
								PreviousState:       eval.Alerting,
								PreviousStateReason: ngmodels.ConcatReasons(eval.NoData.String(), ngmodels.StateReasonKeepLast),
								State: &State{
									Labels:             labels["system + rule + labels2"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Alerting,
									StateReason:        ngmodels.ConcatReasons(eval.NoData.String(), ngmodels.StateReasonKeepLast),
									LatestResult:       newEvaluation(t3, eval.NoData),
									StartsAt:           t1,
									EndsAt:             t3.Add(ResendDelay * 4),
									LastEvaluationTime: t3,
									LastSentAt:         &t1,
								},
							},
						},
					},
				},
			},
			{
				desc:         "t1[1:normal,2:alerting] t2[NoData] t3[NoData] and 'for'=1 at t2*,t3",
				ruleMutators: []ngmodels.AlertRuleMutator{ngmodels.RuleMuts.WithForNTimes(1)},
				results: map[time.Time]eval.Results{
					t1: {
						newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
						newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels2)),
					},
					t2: {
						newResult(eval.WithState(eval.NoData), eval.WithLabels(noDataLabels)),
					},
					t3: {
						newResult(eval.WithState(eval.NoData), eval.WithLabels(noDataLabels)),
					},
				},
				expectedTransitions: map[ngmodels.NoDataState]map[time.Time][]StateTransition{
					ngmodels.NoData: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.NoData,
									LatestResult:       newEvaluation(t2, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
									LastSentAt:         &t2,
								},
							},
						},
						t3: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									State:              eval.Normal,
									StateReason:        ngmodels.StateReasonMissingSeries,
									LatestResult:       newEvaluation(t1, eval.Normal),
									StartsAt:           t1,
									EndsAt:             t3,
									LastEvaluationTime: t3,
								},
							},
							{
								PreviousState: eval.Pending,
								State: &State{
									Labels:             labels["system + rule + labels2"],
									State:              eval.Normal,
									StateReason:        ngmodels.StateReasonMissingSeries,
									LatestResult:       newEvaluation(t1, eval.Alerting),
									StartsAt:           t1,
									EndsAt:             t3,
									LastEvaluationTime: t3,
								},
							},
							{
								PreviousState: eval.NoData,
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.NoData,
									LatestResult:       newEvaluation(t3, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t3.Add(ResendDelay * 4),
									LastEvaluationTime: t3,
									LastSentAt:         &t2,
								},
							},
						},
					},
					ngmodels.Alerting: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.Pending,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t2, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
								},
							},
						},
						t3: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									State:              eval.Normal,
									StateReason:        ngmodels.StateReasonMissingSeries,
									LatestResult:       newEvaluation(t1, eval.Normal),
									StartsAt:           t1,
									EndsAt:             t3,
									LastEvaluationTime: t3,
								},
							},
							{
								PreviousState: eval.Pending,
								State: &State{
									Labels:             labels["system + rule + labels2"],
									State:              eval.Normal,
									StateReason:        ngmodels.StateReasonMissingSeries,
									LatestResult:       newEvaluation(t1, eval.Alerting),
									StartsAt:           t1,
									EndsAt:             t3,
									LastEvaluationTime: t3,
								},
							},
							{
								PreviousState:       eval.Pending,
								PreviousStateReason: eval.NoData.String(),
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.Alerting,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t3, eval.NoData),
									StartsAt:           t3,
									EndsAt:             t3.Add(ResendDelay * 4),
									LastEvaluationTime: t3,
									LastSentAt:         &t3,
								},
							},
						},
					},
					ngmodels.OK: {
						t3: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									State:              eval.Normal,
									StateReason:        ngmodels.StateReasonMissingSeries,
									LatestResult:       newEvaluation(t1, eval.Normal),
									StartsAt:           t1,
									EndsAt:             t3,
									LastEvaluationTime: t3,
								},
							},
							{
								PreviousState: eval.Pending,
								State: &State{
									Labels:             labels["system + rule + labels2"],
									State:              eval.Normal,
									StateReason:        ngmodels.StateReasonMissingSeries,
									LatestResult:       newEvaluation(t1, eval.Alerting),
									StartsAt:           t1,
									EndsAt:             t3,
									LastEvaluationTime: t3,
								},
							},
							{
								PreviousState:       eval.Normal,
								PreviousStateReason: eval.NoData.String(),
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.Normal,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t3, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t3,
								},
							},
						},
					},
					ngmodels.KeepLast: {
						t3: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									State:              eval.Normal,
									StateReason:        ngmodels.StateReasonMissingSeries,
									LatestResult:       newEvaluation(t1, eval.Normal),
									StartsAt:           t1,
									EndsAt:             t3,
									LastEvaluationTime: t3,
								},
							},
							{
								PreviousState: eval.Pending,
								State: &State{
									Labels:             labels["system + rule + labels2"],
									State:              eval.Normal,
									StateReason:        ngmodels.StateReasonMissingSeries,
									LatestResult:       newEvaluation(t1, eval.Alerting),
									StartsAt:           t1,
									EndsAt:             t3,
									LastEvaluationTime: t3,
								},
							},
							{
								PreviousState:       eval.Normal,
								PreviousStateReason: ngmodels.ConcatReasons(eval.NoData.String(), ngmodels.StateReasonKeepLast),
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.Normal,
									StateReason:        ngmodels.ConcatReasons(eval.NoData.String(), ngmodels.StateReasonKeepLast),
									LatestResult:       newEvaluation(t3, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t3,
								},
							},
						},
					},
				},
				expectedTransitionsApplyNoDataErrorToAllStates: map[ngmodels.NoDataState]map[time.Time][]StateTransition{
					ngmodels.Alerting: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Pending,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t2, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
								},
							},
							{
								PreviousState: eval.Pending,
								State: &State{
									Labels:             labels["system + rule + labels2"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Alerting,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t2, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
									LastSentAt:         &t2,
								},
							},
						},
						t3: {
							{
								PreviousState:       eval.Pending,
								PreviousStateReason: eval.NoData.String(),
								State: &State{
									Labels:             labels["system + rule + labels1"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Alerting,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t3, eval.NoData),
									StartsAt:           t3,
									EndsAt:             t3.Add(ResendDelay * 4),
									LastEvaluationTime: t3,
									LastSentAt:         &t3,
								},
							},
							{
								PreviousState:       eval.Alerting,
								PreviousStateReason: eval.NoData.String(),
								State: &State{
									Labels:             labels["system + rule + labels2"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Alerting,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t3, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t3.Add(ResendDelay * 4),
									LastEvaluationTime: t3,
									LastSentAt:         &t2,
								},
							},
						},
					},
					ngmodels.OK: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Normal,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t2, eval.NoData),
									StartsAt:           t1,
									EndsAt:             t1,
									LastEvaluationTime: t2,
								},
							},
							{
								PreviousState: eval.Pending,
								State: &State{
									Labels:             labels["system + rule + labels2"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Normal,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t2, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t2,
								},
							},
						},
						t3: {
							{
								PreviousState:       eval.Normal,
								PreviousStateReason: eval.NoData.String(),
								State: &State{
									Labels:             labels["system + rule + labels1"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Normal,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t3, eval.NoData),
									StartsAt:           t1,
									EndsAt:             t1,
									LastEvaluationTime: t3,
								},
							},
							{
								PreviousState:       eval.Normal,
								PreviousStateReason: eval.NoData.String(),
								State: &State{
									Labels:             labels["system + rule + labels2"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Normal,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t3, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t3,
								},
							},
						},
					},
					ngmodels.KeepLast: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Normal,
									StateReason:        ngmodels.ConcatReasons(eval.NoData.String(), ngmodels.StateReasonKeepLast),
									LatestResult:       newEvaluation(t2, eval.NoData),
									StartsAt:           t1,
									EndsAt:             t1,
									LastEvaluationTime: t2,
								},
							},
							{
								PreviousState: eval.Pending,
								State: &State{
									Labels:             labels["system + rule + labels2"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Alerting,
									StateReason:        ngmodels.ConcatReasons(eval.NoData.String(), ngmodels.StateReasonKeepLast),
									LatestResult:       newEvaluation(t2, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
									LastSentAt:         &t2,
								},
							},
						},
						t3: {
							{
								PreviousState:       eval.Normal,
								PreviousStateReason: ngmodels.ConcatReasons(eval.NoData.String(), ngmodels.StateReasonKeepLast),
								State: &State{
									Labels:             labels["system + rule + labels1"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Normal,
									StateReason:        ngmodels.ConcatReasons(eval.NoData.String(), ngmodels.StateReasonKeepLast),
									LatestResult:       newEvaluation(t3, eval.NoData),
									StartsAt:           t1,
									EndsAt:             t1,
									LastEvaluationTime: t3,
								},
							},
							{
								PreviousState:       eval.Alerting,
								PreviousStateReason: ngmodels.ConcatReasons(eval.NoData.String(), ngmodels.StateReasonKeepLast),
								State: &State{
									Labels:             labels["system + rule + labels2"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Alerting,
									StateReason:        ngmodels.ConcatReasons(eval.NoData.String(), ngmodels.StateReasonKeepLast),
									LatestResult:       newEvaluation(t3, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t3.Add(ResendDelay * 4),
									LastEvaluationTime: t3,
									LastSentAt:         &t2,
								},
							},
						},
					},
				},
			},
			{
				desc:         "t1[1:alerting] t2[NoData] t3[1:alerting] and 'for'=2 at t3",
				ruleMutators: []ngmodels.AlertRuleMutator{ngmodels.RuleMuts.WithForNTimes(2)},
				results: map[time.Time]eval.Results{
					t1: {
						newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
					},
					t2: {
						newResult(eval.WithState(eval.NoData), eval.WithLabels(noDataLabels)),
					},
					t3: {
						newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
					},
				},
				expectedTransitions: map[ngmodels.NoDataState]map[time.Time][]StateTransition{
					ngmodels.NoData: {
						t3: {
							{
								PreviousState: eval.Pending,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									State:              eval.Alerting,
									LatestResult:       newEvaluation(t3, eval.Alerting),
									StartsAt:           t3,
									EndsAt:             t3.Add(ResendDelay * 4),
									LastEvaluationTime: t3,
									LastSentAt:         &t3,
								},
							},
						},
					},
					ngmodels.Alerting: {
						t3: {
							{
								PreviousState: eval.Pending,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									State:              eval.Alerting,
									LatestResult:       newEvaluation(t3, eval.Alerting),
									StartsAt:           t3,
									EndsAt:             t3.Add(ResendDelay * 4),
									LastEvaluationTime: t3,
									LastSentAt:         &t3,
								},
							},
						},
					},
					ngmodels.OK: {
						t3: {
							{
								PreviousState: eval.Pending,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									State:              eval.Alerting,
									LatestResult:       newEvaluation(t3, eval.Alerting),
									StartsAt:           t3,
									EndsAt:             t3.Add(ResendDelay * 4),
									LastEvaluationTime: t3,
									LastSentAt:         &t3,
								},
							},
						},
					},
					ngmodels.KeepLast: {
						t3: {
							{
								PreviousState: eval.Pending,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									State:              eval.Alerting,
									LatestResult:       newEvaluation(t3, eval.Alerting),
									StartsAt:           t3,
									EndsAt:             t3.Add(ResendDelay * 4),
									LastEvaluationTime: t3,
									LastSentAt:         &t3,
								},
							},
						},
					},
				},
				expectedTransitionsApplyNoDataErrorToAllStates: map[ngmodels.NoDataState]map[time.Time][]StateTransition{
					ngmodels.Alerting: {
						t3: {
							{
								PreviousState:       eval.Pending,
								PreviousStateReason: eval.NoData.String(),
								State: &State{
									Labels:             labels["system + rule + labels1"],
									State:              eval.Alerting,
									LatestResult:       newEvaluation(t3, eval.Alerting),
									StartsAt:           t3,
									EndsAt:             t3.Add(ResendDelay * 4),
									LastEvaluationTime: t3,
									LastSentAt:         &t3,
								},
							},
						},
					},
					ngmodels.OK: {
						t3: {
							{
								PreviousState:       eval.Normal,
								PreviousStateReason: eval.NoData.String(),
								State: &State{
									Labels:             labels["system + rule + labels1"],
									State:              eval.Pending,
									LatestResult:       newEvaluation(t3, eval.Alerting),
									StartsAt:           t3,
									EndsAt:             t3.Add(ResendDelay * 4),
									LastEvaluationTime: t3,
								},
							},
						},
					},
					ngmodels.KeepLast: {
						t3: {
							{
								PreviousState:       eval.Pending,
								PreviousStateReason: ngmodels.ConcatReasons(eval.NoData.String(), ngmodels.StateReasonKeepLast),
								State: &State{
									Labels:             labels["system + rule + labels1"],
									State:              eval.Alerting,
									LatestResult:       newEvaluation(t3, eval.Alerting),
									StartsAt:           t3,
									EndsAt:             t3.Add(ResendDelay * 4),
									LastEvaluationTime: t3,
									LastSentAt:         &t3,
								},
							},
						},
					},
				},
			},
			{
				desc: "t1[NoData] t2[1:normal] t3[1:normal] at t3",
				results: map[time.Time]eval.Results{
					t1: {
						newResult(eval.WithState(eval.NoData), eval.WithLabels(noDataLabels)),
					},
					t2: {
						newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
					},
					t3: {
						newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
					},
				},
				expectedTransitions: map[ngmodels.NoDataState]map[time.Time][]StateTransition{
					ngmodels.NoData: {
						t3: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									State:              eval.Normal,
									LatestResult:       newEvaluation(t3, eval.Normal),
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t3,
								},
							},
							{
								PreviousState: eval.NoData,
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.Normal,
									StateReason:        ngmodels.StateReasonMissingSeries,
									LatestResult:       newEvaluation(t1, eval.NoData),
									StartsAt:           t1,
									EndsAt:             t3,
									LastEvaluationTime: t3,
									LastSentAt:         &t1, // We don't bother updating LastSentAt for StateReasonMissingSeries since it's deleted from state.
								},
							},
						},
					},
					ngmodels.Alerting: {
						t3: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									State:              eval.Normal,
									LatestResult:       newEvaluation(t3, eval.Normal),
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t3,
								},
							},
							{
								PreviousState:       eval.Alerting,
								PreviousStateReason: eval.NoData.String(),
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.Normal,
									StateReason:        ngmodels.StateReasonMissingSeries,
									LatestResult:       newEvaluation(t1, eval.NoData),
									StartsAt:           t1,
									EndsAt:             t3,
									LastEvaluationTime: t3,
									ResolvedAt:         &t3,
									LastSentAt:         &t3,
								},
							},
						},
					},
					ngmodels.OK: {
						t3: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									State:              eval.Normal,
									LatestResult:       newEvaluation(t3, eval.Normal),
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t3,
								},
							},
							{
								PreviousState:       eval.Normal,
								PreviousStateReason: eval.NoData.String(),
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.Normal,
									StateReason:        ngmodels.StateReasonMissingSeries,
									LatestResult:       newEvaluation(t1, eval.NoData),
									StartsAt:           t1,
									EndsAt:             t3,
									LastEvaluationTime: t3,
								},
							},
						},
					},
					ngmodels.KeepLast: {
						t3: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									State:              eval.Normal,
									LatestResult:       newEvaluation(t3, eval.Normal),
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t3,
								},
							},
							{
								PreviousState:       eval.Normal,
								PreviousStateReason: ngmodels.ConcatReasons(eval.NoData.String(), ngmodels.StateReasonKeepLast),
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.Normal,
									StateReason:        ngmodels.StateReasonMissingSeries,
									LatestResult:       newEvaluation(t1, eval.NoData),
									StartsAt:           t1,
									EndsAt:             t3,
									LastEvaluationTime: t3,
								},
							},
						},
					},
				},
			},
			{
				desc: "t1[{}:normal] t2[NoData] at t2",
				results: map[time.Time]eval.Results{
					t1: {
						newResult(eval.WithState(eval.Normal)),
					},
					t2: {
						newResult(eval.WithState(eval.NoData), eval.WithLabels(noDataLabels)),
					},
				},
				expectedTransitions: map[ngmodels.NoDataState]map[time.Time][]StateTransition{
					ngmodels.NoData: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.NoData,
									LatestResult:       newEvaluation(t2, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
									LastSentAt:         &t2,
								},
							},
						},
					},
					ngmodels.Alerting: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.Alerting,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t2, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
									LastSentAt:         &t2,
								},
							},
						},
					},
					ngmodels.OK: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.Normal,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t2, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t2,
								},
							},
						},
					},
					ngmodels.KeepLast: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.Normal,
									StateReason:        ngmodels.ConcatReasons(eval.NoData.String(), ngmodels.StateReasonKeepLast),
									LatestResult:       newEvaluation(t2, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t2,
								},
							},
						},
					},
				},
				expectedTransitionsApplyNoDataErrorToAllStates: map[ngmodels.NoDataState]map[time.Time][]StateTransition{
					ngmodels.Alerting: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Alerting,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t2, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
									LastSentAt:         &t2,
								},
							},
						},
					},
					ngmodels.OK: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Normal,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t2, eval.NoData),
									StartsAt:           t1,
									EndsAt:             t1,
									LastEvaluationTime: t2,
								},
							},
						},
					},
					ngmodels.KeepLast: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Normal,
									StateReason:        ngmodels.ConcatReasons(eval.NoData.String(), ngmodels.StateReasonKeepLast),
									LatestResult:       newEvaluation(t2, eval.NoData),
									StartsAt:           t1,
									EndsAt:             t1,
									LastEvaluationTime: t2,
								},
							},
						},
					},
				},
			},
			{
				desc: "t1[{}:alerting] t2[NoData] t3[NoData] at t2,t3",
				results: map[time.Time]eval.Results{
					t1: {
						newResult(eval.WithState(eval.Alerting)),
					},
					t2: {
						newResult(eval.WithState(eval.NoData), eval.WithLabels(noDataLabels)),
					},
					t3: {
						newResult(eval.WithState(eval.NoData), eval.WithLabels(noDataLabels)),
					},
				},
				expectedTransitions: map[ngmodels.NoDataState]map[time.Time][]StateTransition{
					ngmodels.NoData: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.NoData,
									LatestResult:       newEvaluation(t2, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
									LastSentAt:         &t2,
								},
							},
						},
						t3: {
							{
								PreviousState: eval.Alerting,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Normal,
									StateReason:        ngmodels.StateReasonMissingSeries,
									LatestResult:       newEvaluation(t1, eval.Alerting),
									StartsAt:           t1,
									EndsAt:             t3,
									LastEvaluationTime: t3,
									ResolvedAt:         &t3,
									LastSentAt:         &t3,
								},
							},
							{
								PreviousState: eval.NoData,
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.NoData,
									LatestResult:       newEvaluation(t3, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t3.Add(ResendDelay * 4),
									LastEvaluationTime: t3,
									LastSentAt:         &t2,
								},
							},
						},
					},
					ngmodels.Alerting: {
						t3: {
							{
								PreviousState: eval.Alerting,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Normal,
									StateReason:        ngmodels.StateReasonMissingSeries,
									LatestResult:       newEvaluation(t1, eval.Alerting),
									StartsAt:           t1,
									EndsAt:             t3,
									LastEvaluationTime: t3,
									ResolvedAt:         &t3,
									LastSentAt:         &t3,
								},
							},
							{
								PreviousState:       eval.Alerting,
								PreviousStateReason: eval.NoData.String(),
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.Alerting,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t3, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t3.Add(ResendDelay * 4),
									LastEvaluationTime: t3,
									LastSentAt:         &t2,
								},
							},
						},
					},
					ngmodels.OK: {
						t3: {
							{
								PreviousState: eval.Alerting,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Normal,
									StateReason:        ngmodels.StateReasonMissingSeries,
									LatestResult:       newEvaluation(t1, eval.Alerting),
									StartsAt:           t1,
									EndsAt:             t3,
									LastEvaluationTime: t3,
									ResolvedAt:         &t3,
									LastSentAt:         &t3,
								},
							},
							{
								PreviousState:       eval.Normal,
								PreviousStateReason: eval.NoData.String(),
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.Normal,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t3, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t3,
								},
							},
						},
					},
					ngmodels.KeepLast: {
						t3: {
							{
								PreviousState: eval.Alerting,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Normal,
									StateReason:        ngmodels.StateReasonMissingSeries,
									LatestResult:       newEvaluation(t1, eval.Alerting),
									StartsAt:           t1,
									EndsAt:             t3,
									LastEvaluationTime: t3,
									ResolvedAt:         &t3,
									LastSentAt:         &t3,
								},
							},
							{
								PreviousState:       eval.Normal,
								PreviousStateReason: ngmodels.ConcatReasons(eval.NoData.String(), ngmodels.StateReasonKeepLast),
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.Normal,
									StateReason:        ngmodels.ConcatReasons(eval.NoData.String(), ngmodels.StateReasonKeepLast),
									LatestResult:       newEvaluation(t3, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t3,
								},
							},
						},
					},
				},
				expectedTransitionsApplyNoDataErrorToAllStates: map[ngmodels.NoDataState]map[time.Time][]StateTransition{
					ngmodels.Alerting: {
						t2: {
							{
								PreviousState: eval.Alerting,
								State: &State{
									Labels:             labels["system + rule"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Alerting,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t2, eval.NoData),
									StartsAt:           t1,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
									LastSentAt:         &t1,
								},
							},
						},
						t3: {
							{
								PreviousState:       eval.Alerting,
								PreviousStateReason: eval.NoData.String(),
								State: &State{
									Labels:             labels["system + rule"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Alerting,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t3, eval.NoData),
									StartsAt:           t1,
									EndsAt:             t3.Add(ResendDelay * 4),
									LastEvaluationTime: t3,
									LastSentAt:         &t1,
								},
							},
						},
					},
					ngmodels.OK: {
						t2: {
							{
								PreviousState: eval.Alerting,
								State: &State{
									Labels:             labels["system + rule"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Normal,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t2, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t2,
									ResolvedAt:         &t2,
									LastSentAt:         &t2,
								},
							},
						},
						t3: {
							{
								PreviousState:       eval.Normal,
								PreviousStateReason: eval.NoData.String(),
								State: &State{
									Labels:             labels["system + rule"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Normal,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t3, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t3,
									ResolvedAt:         &t2,
									LastSentAt:         &t2,
								},
							},
						},
					},
					ngmodels.KeepLast: {
						t2: {
							{
								PreviousState: eval.Alerting,
								State: &State{
									Labels:             labels["system + rule"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Alerting,
									StateReason:        ngmodels.ConcatReasons(eval.NoData.String(), ngmodels.StateReasonKeepLast),
									LatestResult:       newEvaluation(t2, eval.NoData),
									StartsAt:           t1,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
									LastSentAt:         &t1,
								},
							},
						},
						t3: {
							{
								PreviousState:       eval.Alerting,
								PreviousStateReason: ngmodels.ConcatReasons(eval.NoData.String(), ngmodels.StateReasonKeepLast),
								State: &State{
									Labels:             labels["system + rule"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Alerting,
									StateReason:        ngmodels.ConcatReasons(eval.NoData.String(), ngmodels.StateReasonKeepLast),
									LatestResult:       newEvaluation(t3, eval.NoData),
									StartsAt:           t1,
									EndsAt:             t3.Add(ResendDelay * 4),
									LastEvaluationTime: t3,
									LastSentAt:         &t1,
								},
							},
						},
					},
				},
			},
			{
				desc:         "t1[{}:alerting] t2[NoData] t3[{}:alerting] and 'for'=2 at t2,t3",
				ruleMutators: []ngmodels.AlertRuleMutator{ngmodels.RuleMuts.WithForNTimes(2)},
				results: map[time.Time]eval.Results{
					t1: {
						newResult(eval.WithState(eval.Alerting)),
					},
					t2: {
						newResult(eval.WithState(eval.NoData), eval.WithLabels(noDataLabels)),
					},
					t3: {
						newResult(eval.WithState(eval.Alerting)),
					},
				},
				expectedTransitions: map[ngmodels.NoDataState]map[time.Time][]StateTransition{
					ngmodels.NoData: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + no-data"],
									State:              eval.NoData,
									LatestResult:       newEvaluation(t2, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
									LastSentAt:         &t2,
								},
							},
						},
						t3: {
							{
								PreviousState: eval.Pending,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Alerting,
									LatestResult:       newEvaluation(t3, eval.Alerting),
									StartsAt:           t3,
									EndsAt:             t3.Add(ResendDelay * 4),
									LastEvaluationTime: t3,
									LastSentAt:         &t3,
								},
							},
						},
					},
					ngmodels.Alerting: {
						t3: {
							{
								PreviousState: eval.Pending,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Alerting,
									LatestResult:       newEvaluation(t3, eval.Alerting),
									StartsAt:           t3,
									EndsAt:             t3.Add(ResendDelay * 4),
									LastEvaluationTime: t3,
									LastSentAt:         &t3,
								},
							},
						},
					},
					ngmodels.OK: {
						t3: {
							{
								PreviousState: eval.Pending,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Alerting,
									LatestResult:       newEvaluation(t3, eval.Alerting),
									StartsAt:           t3,
									EndsAt:             t3.Add(ResendDelay * 4),
									LastEvaluationTime: t3,
									LastSentAt:         &t3,
								},
							},
						},
					},
					ngmodels.KeepLast: {
						t3: {
							{
								PreviousState: eval.Pending,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Alerting,
									LatestResult:       newEvaluation(t3, eval.Alerting),
									StartsAt:           t3,
									EndsAt:             t3.Add(ResendDelay * 4),
									LastEvaluationTime: t3,
									LastSentAt:         &t3,
								},
							},
						},
					},
				},
				expectedTransitionsApplyNoDataErrorToAllStates: map[ngmodels.NoDataState]map[time.Time][]StateTransition{
					ngmodels.Alerting: {
						t2: {
							{
								PreviousState: eval.Pending,
								State: &State{
									Labels:             labels["system + rule"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Pending,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t2, eval.NoData),
									StartsAt:           t1,
									EndsAt:             t1.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
								},
							},
						},
						t3: {
							{
								PreviousState:       eval.Pending,
								PreviousStateReason: eval.NoData.String(),
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Alerting,
									LatestResult:       newEvaluation(t3, eval.Alerting),
									StartsAt:           t3,
									EndsAt:             t3.Add(ResendDelay * 4),
									LastEvaluationTime: t3,
									LastSentAt:         &t3,
								},
							},
						},
					},
					ngmodels.OK: {
						t2: {
							{
								PreviousState: eval.Pending,
								State: &State{
									Labels:             labels["system + rule"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Normal,
									StateReason:        eval.NoData.String(),
									LatestResult:       newEvaluation(t2, eval.NoData),
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t2,
								},
							},
						},
						t3: {
							{
								PreviousState:       eval.Normal,
								PreviousStateReason: eval.NoData.String(),
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Pending,
									LatestResult:       newEvaluation(t3, eval.Alerting),
									StartsAt:           t3,
									EndsAt:             t3.Add(ResendDelay * 4),
									LastEvaluationTime: t3,
								},
							},
						},
					},
					ngmodels.KeepLast: {
						t2: {
							{
								PreviousState: eval.Pending,
								State: &State{
									Labels:             labels["system + rule"],
									Annotations:        mergeLabels(baseRule.Annotations, noDataAnnotations),
									State:              eval.Pending,
									StateReason:        ngmodels.ConcatReasons(eval.NoData.String(), ngmodels.StateReasonKeepLast),
									LatestResult:       newEvaluation(t2, eval.NoData),
									StartsAt:           t1,
									EndsAt:             t1.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
								},
							},
						},
						t3: {
							{
								PreviousState:       eval.Pending,
								PreviousStateReason: ngmodels.ConcatReasons(eval.NoData.String(), ngmodels.StateReasonKeepLast),
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Alerting,
									LatestResult:       newEvaluation(t3, eval.Alerting),
									StartsAt:           t3,
									EndsAt:             t3.Add(ResendDelay * 4),
									LastEvaluationTime: t3,
									LastSentAt:         &t3,
								},
							},
						},
					},
				},
			},
		}

		for _, tc := range testCases {
			t.Run(tc.desc, func(t *testing.T) {
				executeForEachRule(t, tc)
			})
		}
	})

	t.Run("error", func(t *testing.T) {
		rules := map[ngmodels.ExecutionErrorState]*ngmodels.AlertRule{
			ngmodels.ErrorErrState:    baseRuleWith(ngmodels.RuleMuts.WithErrorExecAs(ngmodels.ErrorErrState)),
			ngmodels.AlertingErrState: baseRuleWith(ngmodels.RuleMuts.WithErrorExecAs(ngmodels.AlertingErrState)),
			ngmodels.OkErrState:       baseRuleWith(ngmodels.RuleMuts.WithErrorExecAs(ngmodels.OkErrState)),
			ngmodels.KeepLastErrState: baseRuleWith(ngmodels.RuleMuts.WithErrorExecAs(ngmodels.KeepLastErrState)),
		}

		type errorTestCase struct {
			desc                string
			ruleMutators        []ngmodels.AlertRuleMutator
			results             map[time.Time]eval.Results
			expectedTransitions map[ngmodels.ExecutionErrorState]map[time.Time][]StateTransition

			expectedTransitionsApplyNoDataErrorToAllStates map[ngmodels.ExecutionErrorState]map[time.Time][]StateTransition
		}

		executeForEachRule := func(t *testing.T, tc errorTestCase) {
			t.Helper()
			for stateExec, rule := range rules {
				r := rule
				if len(tc.ruleMutators) > 0 {
					r = ngmodels.CopyRule(r, tc.ruleMutators...)
				}
				t.Run(fmt.Sprintf("execute as %s", stateExec), func(t *testing.T) {
					expectedTransitions, ok := tc.expectedTransitionsApplyNoDataErrorToAllStates[stateExec]
					overridden := "[*]"
					if !ok {
						expectedTransitions, ok = tc.expectedTransitions[stateExec]
						overridden = ""
					}
					if !ok {
						require.Fail(t, "no expected state transitions")
					}
					t.Run("applyNoDataErrorToAllStates=true"+overridden, func(t *testing.T) {
						executeTest(t, r, tc.results, expectedTransitions, true)
					})
					t.Run("applyNoDataErrorToAllStates=false", func(t *testing.T) {
						expectedTransitions, ok := tc.expectedTransitions[stateExec]
						if !ok {
							require.Fail(t, "no expected state transitions")
						}
						executeTest(t, r, tc.results, expectedTransitions, false)
					})
				})
			}
		}

		testCases := []errorTestCase{
			{
				desc: "t1[QueryError] at t1",
				results: map[time.Time]eval.Results{
					t1: {
						newResult(eval.WithError(datasourceError)),
					},
				},
				expectedTransitions: map[ngmodels.ExecutionErrorState]map[time.Time][]StateTransition{
					ngmodels.ErrorErrState: {
						t1: {
							{
								PreviousState: eval.Normal,
								State: &State{
									CacheID:            labels["system + rule"].Fingerprint(),
									Labels:             labels["system + rule + datasource-error"],
									State:              eval.Error,
									Error:              datasourceError,
									LatestResult:       newEvaluation(t1, eval.Error),
									StartsAt:           t1,
									EndsAt:             t1.Add(ResendDelay * 4),
									LastEvaluationTime: t1,
									LastSentAt:         &t1,
									Annotations: mergeLabels(baseRule.Annotations, data.Labels{
										"Error": datasourceError.Error(),
									}),
								},
							},
						},
					},
					ngmodels.AlertingErrState: {
						t1: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Alerting,
									StateReason:        eval.Error.String(),
									Error:              datasourceError,
									Annotations:        datasourceErrorAnnotations,
									LatestResult:       newEvaluation(t1, eval.Error),
									StartsAt:           t1,
									EndsAt:             t1.Add(ResendDelay * 4),
									LastEvaluationTime: t1,
									LastSentAt:         &t1,
								},
							},
						},
					},
					ngmodels.OkErrState: {
						t1: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Normal,
									StateReason:        eval.Error.String(),
									LatestResult:       newEvaluation(t1, eval.Error),
									Annotations:        datasourceErrorAnnotations,
									StartsAt:           t1,
									EndsAt:             t1,
									LastEvaluationTime: t1,
								},
							},
						},
					},
					ngmodels.KeepLastErrState: {
						t1: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Normal,
									StateReason:        ngmodels.ConcatReasons(eval.Error.String(), ngmodels.StateReasonKeepLast),
									Annotations:        datasourceErrorAnnotations,
									LatestResult:       newEvaluation(t1, eval.Error),
									StartsAt:           t1,
									EndsAt:             t1,
									LastEvaluationTime: t1,
								},
							},
						},
					},
				},
			},
			{
				desc: "t1[GenericError] at t1",
				results: map[time.Time]eval.Results{
					t1: {
						newResult(eval.WithError(genericError)),
					},
				},
				expectedTransitions: map[ngmodels.ExecutionErrorState]map[time.Time][]StateTransition{
					ngmodels.ErrorErrState: {
						t1: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Error,
									Error:              genericError,
									LatestResult:       newEvaluation(t1, eval.Error),
									StartsAt:           t1,
									EndsAt:             t1.Add(ResendDelay * 4),
									LastEvaluationTime: t1,
									LastSentAt:         &t1,
									Annotations:        genericErrorAnnotations,
								},
							},
						},
					},
					ngmodels.AlertingErrState: {
						t1: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Alerting,
									StateReason:        eval.Error.String(),
									Error:              genericError,
									Annotations:        genericErrorAnnotations,
									LatestResult:       newEvaluation(t1, eval.Error),
									StartsAt:           t1,
									EndsAt:             t1.Add(ResendDelay * 4),
									LastEvaluationTime: t1,
									LastSentAt:         &t1,
								},
							},
						},
					},
					ngmodels.OkErrState: {
						t1: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Normal,
									StateReason:        eval.Error.String(),
									Annotations:        genericErrorAnnotations,
									LatestResult:       newEvaluation(t1, eval.Error),
									StartsAt:           t1,
									EndsAt:             t1,
									LastEvaluationTime: t1,
								},
							},
						},
					},
					ngmodels.KeepLastErrState: {
						t1: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Normal,
									StateReason:        ngmodels.ConcatReasons(eval.Error.String(), ngmodels.StateReasonKeepLast),
									Annotations:        genericErrorAnnotations,
									LatestResult:       newEvaluation(t1, eval.Error),
									StartsAt:           t1,
									EndsAt:             t1,
									LastEvaluationTime: t1,
								},
							},
						},
					},
				},
			},
			{
				desc:         "t1[1:alerting] t2[QueryError] and 'for'=1 at t2",
				ruleMutators: []ngmodels.AlertRuleMutator{ngmodels.RuleMuts.WithForNTimes(1)},
				results: map[time.Time]eval.Results{
					t1: {
						newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1), eval.WithValues(map[string]eval.NumberValueCapture{"A": {Var: "A", Value: util.Pointer(1.0)}})),
					},
					t2: {
						newResult(eval.WithError(datasourceError)),
					},
				},
				expectedTransitions: map[ngmodels.ExecutionErrorState]map[time.Time][]StateTransition{
					ngmodels.ErrorErrState: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									CacheID:            labels["system + rule"].Fingerprint(),
									Labels:             labels["system + rule + datasource-error"],
									State:              eval.Error,
									Error:              datasourceError,
									LatestResult:       newEvaluation(t2, eval.Error),
									StartsAt:           t2,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
									LastSentAt:         &t2,
									Annotations: mergeLabels(baseRule.Annotations, data.Labels{
										"Error": datasourceError.Error(),
									}),
								},
							},
						},
					},
					ngmodels.AlertingErrState: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Pending,
									StateReason:        eval.Error.String(),
									Error:              datasourceError,
									Annotations:        datasourceErrorAnnotations,
									LatestResult:       newEvaluation(t2, eval.Error),
									StartsAt:           t2,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
								},
							},
						},
					},
					ngmodels.OkErrState: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Normal,
									StateReason:        eval.Error.String(),
									LatestResult:       newEvaluation(t2, eval.Error),
									Annotations:        datasourceErrorAnnotations,
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t2,
								},
							},
						},
					},
					ngmodels.KeepLastErrState: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Normal,
									StateReason:        ngmodels.ConcatReasons(eval.Error.String(), ngmodels.StateReasonKeepLast),
									LatestResult:       newEvaluation(t2, eval.Error),
									Annotations:        datasourceErrorAnnotations,
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t2,
								},
							},
						},
					},
				},
				expectedTransitionsApplyNoDataErrorToAllStates: map[ngmodels.ExecutionErrorState]map[time.Time][]StateTransition{
					ngmodels.AlertingErrState: {
						t2: {
							{
								PreviousState: eval.Pending,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									State:              eval.Alerting,
									StateReason:        eval.Error.String(),
									Error:              datasourceError,
									Annotations:        datasourceErrorAnnotations,
									LatestResult:       newEvaluationWithValues(t2, eval.Error, map[string]float64{"A": float64(-1)}),
									StartsAt:           t2,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
									LastSentAt:         &t2,
									Values:             map[string]float64{"A": float64(-1)},
								},
							},
						},
					},
					ngmodels.OkErrState: {
						t2: {
							{
								PreviousState: eval.Pending,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									State:              eval.Normal,
									StateReason:        eval.Error.String(),
									Annotations:        datasourceErrorAnnotations,
									LatestResult:       newEvaluationWithValues(t2, eval.Error, map[string]float64{"A": float64(-1)}),
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t2,
									Values:             map[string]float64{"A": float64(-1)},
								},
							},
						},
					},
					ngmodels.KeepLastErrState: {
						t2: {
							{
								PreviousState: eval.Pending,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									State:              eval.Alerting,
									StateReason:        ngmodels.ConcatReasons(eval.Error.String(), ngmodels.StateReasonKeepLast),
									Annotations:        datasourceErrorAnnotations,
									LatestResult:       newEvaluationWithValues(t2, eval.Error, map[string]float64{"A": float64(-1)}),
									StartsAt:           t2,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
									LastSentAt:         &t2,
									Values:             map[string]float64{"A": float64(-1)},
								},
							},
						},
					},
				},
			},
			{
				desc: "t1[1:normal] t2[QueryError] at t2",
				results: map[time.Time]eval.Results{
					t1: {
						newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1), eval.WithValues(map[string]eval.NumberValueCapture{"A": {Var: "A", Value: util.Pointer(1.0)}})),
					},
					t2: {
						newResult(eval.WithError(datasourceError)),
					},
				},
				expectedTransitions: map[ngmodels.ExecutionErrorState]map[time.Time][]StateTransition{
					ngmodels.ErrorErrState: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									CacheID:            labels["system + rule"].Fingerprint(),
									Labels:             labels["system + rule + datasource-error"],
									State:              eval.Error,
									Error:              datasourceError,
									LatestResult:       newEvaluation(t2, eval.Error),
									StartsAt:           t2,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
									LastSentAt:         &t2,
									Annotations: mergeLabels(baseRule.Annotations, data.Labels{
										"Error": datasourceError.Error(),
									}),
								},
							},
						},
					},
					ngmodels.AlertingErrState: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Alerting,
									StateReason:        eval.Error.String(),
									Error:              datasourceError,
									Annotations:        datasourceErrorAnnotations,
									LatestResult:       newEvaluation(t2, eval.Error),
									StartsAt:           t2,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
									LastSentAt:         &t2,
								},
							},
						},
					},
					ngmodels.OkErrState: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Normal,
									StateReason:        eval.Error.String(),
									LatestResult:       newEvaluation(t2, eval.Error),
									Annotations:        datasourceErrorAnnotations,
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t2,
								},
							},
						},
					},
					ngmodels.KeepLastErrState: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Normal,
									StateReason:        ngmodels.ConcatReasons(eval.Error.String(), ngmodels.StateReasonKeepLast),
									LatestResult:       newEvaluation(t2, eval.Error),
									Annotations:        datasourceErrorAnnotations,
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t2,
								},
							},
						},
					},
				},
				expectedTransitionsApplyNoDataErrorToAllStates: map[ngmodels.ExecutionErrorState]map[time.Time][]StateTransition{
					ngmodels.AlertingErrState: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									State:              eval.Alerting,
									StateReason:        eval.Error.String(),
									Error:              datasourceError,
									Annotations:        datasourceErrorAnnotations,
									LatestResult:       newEvaluationWithValues(t2, eval.Error, map[string]float64{"A": float64(-1)}),
									StartsAt:           t2,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
									LastSentAt:         &t2,
									Values:             map[string]float64{"A": float64(-1)},
								},
							},
						},
					},
					ngmodels.OkErrState: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									State:              eval.Normal,
									StateReason:        eval.Error.String(),
									LatestResult:       newEvaluationWithValues(t2, eval.Error, map[string]float64{"A": float64(-1)}),
									Annotations:        datasourceErrorAnnotations,
									StartsAt:           t1,
									EndsAt:             t1,
									LastEvaluationTime: t2,
									Values:             map[string]float64{"A": float64(-1)},
								},
							},
						},
					},
					ngmodels.KeepLastErrState: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									State:              eval.Normal,
									StateReason:        ngmodels.ConcatReasons(eval.Error.String(), ngmodels.StateReasonKeepLast),
									LatestResult:       newEvaluationWithValues(t2, eval.Error, map[string]float64{"A": float64(-1)}),
									Annotations:        datasourceErrorAnnotations,
									StartsAt:           t1,
									EndsAt:             t1,
									LastEvaluationTime: t2,
									Values:             map[string]float64{"A": float64(-1)},
								},
							},
						},
					},
				},
			},
			{
				desc: "t1[QueryError] t2[1:normal] t3[1:normal] at t3",
				results: map[time.Time]eval.Results{
					t1: {
						newResult(eval.WithError(datasourceError)),
					},
					t2: {
						newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
					},
					t3: {
						newResult(eval.WithState(eval.Normal), eval.WithLabels(labels1)),
					},
				},
				expectedTransitions: map[ngmodels.ExecutionErrorState]map[time.Time][]StateTransition{
					ngmodels.ErrorErrState: {
						t3: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									State:              eval.Normal,
									LatestResult:       newEvaluation(t3, eval.Normal),
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t3,
								},
							},
							{
								PreviousState: eval.Error,
								State: &State{
									CacheID:            labels["system + rule"].Fingerprint(),
									Labels:             labels["system + rule + datasource-error"],
									Error:              datasourceError,
									State:              eval.Normal,
									StateReason:        ngmodels.StateReasonMissingSeries,
									LatestResult:       newEvaluation(t1, eval.Error),
									StartsAt:           t1,
									EndsAt:             t3,
									LastEvaluationTime: t3,
									LastSentAt:         &t1, // We don't bother updating LastSentAt for StateReasonMissingSeries since it's deleted from state.
									Annotations: mergeLabels(baseRule.Annotations, data.Labels{
										"Error": datasourceError.Error(),
									}),
								},
							},
						},
					},
					ngmodels.AlertingErrState: {
						t3: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									State:              eval.Normal,
									LatestResult:       newEvaluation(t3, eval.Normal),
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t3,
								},
							},
							{
								PreviousState:       eval.Alerting,
								PreviousStateReason: eval.Error.String(),
								State: &State{
									Labels:             labels["system + rule"],
									Error:              datasourceError,
									Annotations:        datasourceErrorAnnotations,
									State:              eval.Normal,
									StateReason:        ngmodels.StateReasonMissingSeries,
									LatestResult:       newEvaluation(t1, eval.Error),
									StartsAt:           t1,
									EndsAt:             t3,
									LastEvaluationTime: t3,
									ResolvedAt:         &t3,
									LastSentAt:         &t3,
								},
							},
						},
					},
					ngmodels.OkErrState: {
						t3: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									State:              eval.Normal,
									LatestResult:       newEvaluation(t3, eval.Normal),
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t3,
								},
							},
							{
								PreviousState:       eval.Normal,
								PreviousStateReason: eval.Error.String(),
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Normal,
									StateReason:        ngmodels.StateReasonMissingSeries,
									LatestResult:       newEvaluation(t1, eval.Error),
									Annotations:        datasourceErrorAnnotations,
									StartsAt:           t1,
									EndsAt:             t3,
									LastEvaluationTime: t3,
								},
							},
						},
					},
					ngmodels.KeepLastErrState: {
						t3: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule + labels1"],
									State:              eval.Normal,
									LatestResult:       newEvaluation(t3, eval.Normal),
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t3,
								},
							},
							{
								PreviousState:       eval.Normal,
								PreviousStateReason: ngmodels.ConcatReasons(eval.Error.String(), ngmodels.StateReasonKeepLast),
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Normal,
									StateReason:        ngmodels.StateReasonMissingSeries,
									LatestResult:       newEvaluation(t1, eval.Error),
									Annotations:        datasourceErrorAnnotations,
									StartsAt:           t1,
									EndsAt:             t3,
									LastEvaluationTime: t3,
								},
							},
						},
					},
				},
			},
			{
				desc: "t1[{}:normal] t2[QueryError] at t2",
				results: map[time.Time]eval.Results{
					t1: {
						newResult(eval.WithState(eval.Normal)),
					},
					t2: {
						newResult(eval.WithError(datasourceError)),
					},
				},
				expectedTransitions: map[ngmodels.ExecutionErrorState]map[time.Time][]StateTransition{
					ngmodels.ErrorErrState: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									CacheID:            labels["system + rule"].Fingerprint(),
									Labels:             labels["system + rule + datasource-error"],
									State:              eval.Error,
									Error:              datasourceError,
									LatestResult:       newEvaluation(t2, eval.Error),
									StartsAt:           t2,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
									LastSentAt:         &t2,
									Annotations: mergeLabels(baseRule.Annotations, data.Labels{
										"Error": datasourceError.Error(),
									}),
								},
							},
						},
					},
					ngmodels.AlertingErrState: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Alerting,
									StateReason:        eval.Error.String(),
									Error:              datasourceError,
									Annotations:        datasourceErrorAnnotations,
									LatestResult:       newEvaluation(t2, eval.Error),
									StartsAt:           t2,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
									LastSentAt:         &t2,
								},
							},
						},
					},
					ngmodels.OkErrState: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Normal,
									StateReason:        eval.Error.String(),
									LatestResult:       newEvaluation(t2, eval.Error),
									Annotations:        datasourceErrorAnnotations,
									StartsAt:           t1,
									EndsAt:             t1,
									LastEvaluationTime: t2,
								},
							},
						},
					},
					ngmodels.KeepLastErrState: {
						t2: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Normal,
									StateReason:        ngmodels.ConcatReasons(eval.Error.String(), ngmodels.StateReasonKeepLast),
									LatestResult:       newEvaluation(t2, eval.Error),
									Annotations:        datasourceErrorAnnotations,
									StartsAt:           t1,
									EndsAt:             t1,
									LastEvaluationTime: t2,
								},
							},
						},
					},
				},
			},
			{
				desc:         "t1[{}:alerting] t2[QueryError] and 'for'=1 at t1*,t2",
				ruleMutators: []ngmodels.AlertRuleMutator{ngmodels.RuleMuts.WithForNTimes(1)},
				results: map[time.Time]eval.Results{
					t1: {
						newResult(eval.WithState(eval.Alerting)),
					},
					t2: {
						newResult(eval.WithError(datasourceError)),
					},
				},
				expectedTransitions: map[ngmodels.ExecutionErrorState]map[time.Time][]StateTransition{
					ngmodels.ErrorErrState: {
						t1: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Pending,
									LatestResult:       newEvaluation(t1, eval.Alerting),
									StartsAt:           t1,
									EndsAt:             t1.Add(ResendDelay * 4),
									LastEvaluationTime: t1,
								},
							},
						},
						t2: {
							{
								PreviousState: eval.Pending,
								State: &State{
									CacheID:            labels["system + rule"].Fingerprint(),
									Labels:             labels["system + rule + datasource-error"],
									State:              eval.Error,
									Error:              datasourceError,
									LatestResult:       newEvaluation(t2, eval.Error),
									StartsAt:           t2,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
									LastSentAt:         &t2,
									Annotations: mergeLabels(baseRule.Annotations, data.Labels{
										"Error": datasourceError.Error(),
									}),
								},
							},
						},
					},
					ngmodels.AlertingErrState: {
						t2: {
							{
								PreviousState: eval.Pending,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Alerting,
									StateReason:        eval.Error.String(),
									Error:              datasourceError,
									Annotations:        datasourceErrorAnnotations,
									LatestResult:       newEvaluation(t2, eval.Error),
									StartsAt:           t2,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
									LastSentAt:         &t2,
								},
							},
						},
					},
					ngmodels.OkErrState: {
						t2: {
							{
								PreviousState: eval.Pending,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Normal,
									StateReason:        eval.Error.String(),
									Annotations:        datasourceErrorAnnotations,
									LatestResult:       newEvaluation(t2, eval.Error),
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t2,
								},
							},
						},
					},
					ngmodels.KeepLastErrState: {
						t2: {
							{
								PreviousState: eval.Pending,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Alerting,
									StateReason:        ngmodels.ConcatReasons(eval.Error.String(), ngmodels.StateReasonKeepLast),
									Annotations:        datasourceErrorAnnotations,
									LatestResult:       newEvaluation(t2, eval.Error),
									StartsAt:           t2,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
									LastSentAt:         &t2,
								},
							},
						},
					},
				},
			},
			{
				desc:         "t1[{}:alerting] t2[QueryError] t3[{}:alerting] and 'for'=2 at t2,t3",
				ruleMutators: []ngmodels.AlertRuleMutator{ngmodels.RuleMuts.WithForNTimes(2)},
				results: map[time.Time]eval.Results{
					t1: {
						newResult(eval.WithState(eval.Alerting)),
					},
					t2: {
						newResult(eval.WithError(datasourceError)),
					},
					t3: {
						newResult(eval.WithState(eval.Alerting)),
					},
				},
				expectedTransitions: map[ngmodels.ExecutionErrorState]map[time.Time][]StateTransition{
					ngmodels.ErrorErrState: {
						t2: {
							{
								PreviousState: eval.Pending,
								State: &State{
									CacheID:            labels["system + rule"].Fingerprint(),
									Labels:             labels["system + rule + datasource-error"],
									State:              eval.Error,
									Error:              datasourceError,
									LatestResult:       newEvaluation(t2, eval.Error),
									StartsAt:           t2,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
									LastSentAt:         &t2,
									Annotations: mergeLabels(baseRule.Annotations, data.Labels{
										"Error": datasourceError.Error(),
									}),
								},
							},
						},
						t3: {
							{
								PreviousState: eval.Error,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Pending,
									LatestResult:       newEvaluation(t3, eval.Alerting),
									StartsAt:           t3,
									EndsAt:             t3.Add(ResendDelay * 4),
									LastEvaluationTime: t3,
									LastSentAt:         &t2,
								},
							},
						},
					},
					ngmodels.AlertingErrState: {
						t2: {
							{
								PreviousState: eval.Pending,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Pending,
									StateReason:        eval.Error.String(),
									Error:              datasourceError,
									Annotations:        datasourceErrorAnnotations,
									LatestResult:       newEvaluation(t2, eval.Error),
									StartsAt:           t1,
									EndsAt:             t1.Add(ResendDelay * 4), // TODO probably it should be t1 (semantic of Normal)?
									LastEvaluationTime: t2,
								},
							},
						},
						t3: {
							{
								PreviousState:       eval.Pending,
								PreviousStateReason: eval.Error.String(),
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Alerting,
									LatestResult:       newEvaluation(t3, eval.Alerting),
									StartsAt:           t3,
									EndsAt:             t3.Add(ResendDelay * 4),
									LastEvaluationTime: t3,
									LastSentAt:         &t3,
								},
							},
						},
					},
					ngmodels.OkErrState: {
						t2: {
							{
								PreviousState: eval.Pending,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Normal,
									StateReason:        eval.Error.String(),
									LatestResult:       newEvaluation(t2, eval.Error),
									Annotations:        datasourceErrorAnnotations,
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t2,
								},
							},
						},
						t3: {
							{
								PreviousState:       eval.Normal,
								PreviousStateReason: eval.Error.String(),
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Pending,
									LatestResult:       newEvaluation(t3, eval.Alerting),
									StartsAt:           t3,
									EndsAt:             t3.Add(ResendDelay * 4),
									LastEvaluationTime: t3,
								},
							},
						},
					},
					ngmodels.KeepLastErrState: {
						t2: {
							{
								PreviousState: eval.Pending,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Pending,
									StateReason:        ngmodels.ConcatReasons(eval.Error.String(), ngmodels.StateReasonKeepLast),
									LatestResult:       newEvaluation(t2, eval.Error),
									Annotations:        datasourceErrorAnnotations,
									StartsAt:           t1,
									EndsAt:             t1.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
								},
							},
						},
						t3: {
							{
								PreviousState:       eval.Pending,
								PreviousStateReason: ngmodels.ConcatReasons(eval.Error.String(), ngmodels.StateReasonKeepLast),
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Alerting,
									LatestResult:       newEvaluation(t3, eval.Alerting),
									StartsAt:           t3,
									EndsAt:             t3.Add(ResendDelay * 4),
									LastEvaluationTime: t3,
									LastSentAt:         &t3,
								},
							},
						},
					},
				},
			},
			{
				desc: "t1[QueryError] t2[{}:normal] at t2",
				results: map[time.Time]eval.Results{
					t1: {
						newResult(eval.WithError(datasourceError)),
					},
					t2: {
						newResult(eval.WithState(eval.Normal)),
					},
				},
				expectedTransitions: map[ngmodels.ExecutionErrorState]map[time.Time][]StateTransition{
					ngmodels.ErrorErrState: {
						t2: {
							{
								PreviousState: eval.Error,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Normal,
									LatestResult:       newEvaluation(t2, eval.Normal),
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t2,
									LastSentAt:         &t1, // TODO: Fix me. This should be t2 since we should be resolving the previous DatasourceError alert.
								},
							},
						},
					},
					ngmodels.AlertingErrState: {
						t2: {
							{
								PreviousState:       eval.Alerting,
								PreviousStateReason: eval.Error.String(),
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Normal,
									LatestResult:       newEvaluation(t2, eval.Normal),
									StartsAt:           t2,
									EndsAt:             t2,
									LastEvaluationTime: t2,
									ResolvedAt:         &t2,
									LastSentAt:         &t2,
								},
							},
						},
					},
					ngmodels.OkErrState: {
						t2: {
							{
								PreviousState:       eval.Normal,
								PreviousStateReason: eval.Error.String(),
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Normal,
									LatestResult:       newEvaluation(t2, eval.Normal),
									StartsAt:           t1,
									EndsAt:             t1,
									LastEvaluationTime: t2,
								},
							},
						},
					},
					ngmodels.KeepLastErrState: {
						t2: {
							{
								PreviousState:       eval.Normal,
								PreviousStateReason: ngmodels.ConcatReasons(eval.Error.String(), ngmodels.StateReasonKeepLast),
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Normal,
									LatestResult:       newEvaluation(t2, eval.Normal),
									StartsAt:           t1,
									EndsAt:             t1,
									LastEvaluationTime: t2,
								},
							},
						},
					},
				},
			},
			{
				desc: "t1[QueryError] t2[GenericError] at t1, t2",

				results: map[time.Time]eval.Results{
					t1: {
						newResult(eval.WithError(datasourceError)),
					},
					t2: {
						newResult(eval.WithError(genericError)),
					},
				},
				expectedTransitions: map[ngmodels.ExecutionErrorState]map[time.Time][]StateTransition{
					ngmodels.ErrorErrState: {
						t1: {
							{
								PreviousState: eval.Normal,
								State: &State{
									CacheID:            labels["system + rule"].Fingerprint(),
									Labels:             labels["system + rule + datasource-error"],
									State:              eval.Error,
									Error:              datasourceError,
									LatestResult:       newEvaluation(t1, eval.Error),
									StartsAt:           t1,
									EndsAt:             t1.Add(ResendDelay * 4),
									LastEvaluationTime: t1,
									LastSentAt:         &t1,
									Annotations: mergeLabels(baseRule.Annotations, data.Labels{
										"Error": datasourceError.Error(),
									}),
								},
							},
						},
						t2: {
							{
								PreviousState: eval.Error,
								State: &State{
									CacheID:            labels["system + rule"].Fingerprint(),
									Labels:             labels["system + rule + datasource-error"],
									State:              eval.Error,
									Error:              genericError,
									LatestResult:       newEvaluation(t2, eval.Error),
									StartsAt:           t1,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
									LastSentAt:         &t1,
									Annotations:        genericErrorAnnotations,
								},
							},
						},
					},
					ngmodels.AlertingErrState: {
						t1: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Alerting,
									StateReason:        eval.Error.String(),
									Error:              datasourceError,
									Annotations:        datasourceErrorAnnotations,
									LatestResult:       newEvaluation(t1, eval.Error),
									StartsAt:           t1,
									EndsAt:             t1.Add(ResendDelay * 4),
									LastEvaluationTime: t1,
									LastSentAt:         &t1,
								},
							},
						},
						t2: {
							{
								PreviousState:       eval.Alerting,
								PreviousStateReason: eval.Error.String(),
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Alerting,
									StateReason:        eval.Error.String(),
									Error:              genericError,
									Annotations:        genericErrorAnnotations,
									LatestResult:       newEvaluation(t2, eval.Error),
									StartsAt:           t1,
									EndsAt:             t2.Add(ResendDelay * 4),
									LastEvaluationTime: t2,
									LastSentAt:         &t1,
								},
							},
						},
					},
					ngmodels.OkErrState: {
						t1: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Normal,
									StateReason:        eval.Error.String(),
									LatestResult:       newEvaluation(t1, eval.Error),
									Annotations:        datasourceErrorAnnotations,
									StartsAt:           t1,
									EndsAt:             t1,
									LastEvaluationTime: t1,
								},
							},
						},
						t2: {
							{
								PreviousState:       eval.Normal,
								PreviousStateReason: eval.Error.String(),
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Normal,
									StateReason:        eval.Error.String(),
									LatestResult:       newEvaluation(t2, eval.Error),
									Annotations:        genericErrorAnnotations,
									StartsAt:           t1,
									EndsAt:             t1,
									LastEvaluationTime: t2,
								},
							},
						},
					},
					ngmodels.KeepLastErrState: {
						t1: {
							{
								PreviousState: eval.Normal,
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Normal,
									StateReason:        ngmodels.ConcatReasons(eval.Error.String(), ngmodels.StateReasonKeepLast),
									LatestResult:       newEvaluation(t1, eval.Error),
									Annotations:        datasourceErrorAnnotations,
									StartsAt:           t1,
									EndsAt:             t1,
									LastEvaluationTime: t1,
								},
							},
						},
						t2: {
							{
								PreviousState:       eval.Normal,
								PreviousStateReason: ngmodels.ConcatReasons(eval.Error.String(), ngmodels.StateReasonKeepLast),
								State: &State{
									Labels:             labels["system + rule"],
									State:              eval.Normal,
									StateReason:        ngmodels.ConcatReasons(eval.Error.String(), ngmodels.StateReasonKeepLast),
									LatestResult:       newEvaluation(t2, eval.Error),
									Annotations:        genericErrorAnnotations,
									StartsAt:           t1,
									EndsAt:             t1,
									LastEvaluationTime: t2,
								},
							},
						},
					},
				},
			},
		}

		for _, tc := range testCases {
			t.Run(tc.desc, func(t *testing.T) {
				executeForEachRule(t, tc)
			})
		}
	})
}

func TestProcessEvalResults_Screenshots(t *testing.T) {
	gen := ngmodels.RuleGen
	baseRule := gen.With(
		gen.WithDashboardAndPanel(util.Pointer(util.GenerateShortUID()), util.Pointer(rand.Int63())),
		gen.WithLabels(nil),
		gen.WithFor(0),
	).Generate()

	evalDuration := time.Duration(baseRule.IntervalSeconds) * time.Second

	t0 := time.Now()
	tn := func(n int) time.Time {
		return t0.Add(time.Duration(n) * evalDuration)
	}
	t1 := tn(1)

	randomImage := func() *ngmodels.Image {
		return &ngmodels.Image{Token: fmt.Sprint(rand.Int())}
	}

	newState := func(s eval.State, labels data.Labels, image *ngmodels.Image) State {
		res := State{
			AlertRuleUID:      baseRule.UID,
			OrgID:             baseRule.OrgID,
			Image:             image,
			Labels:            labels,
			ResultFingerprint: labels.Fingerprint(),
			State:             s,
			LatestResult: &Evaluation{
				EvaluationState: s,
			},
			StartsAt:           t0,
			LastEvaluationTime: t0,
			CacheID:            data.Fingerprint(0),
		}
		setCacheID(&res)
		return res
	}

	newResult := func(mutators ...eval.ResultMutator) eval.Result {
		r := eval.Result{
			State: eval.Normal,
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
	labels3 := data.Labels{
		"instance_label": "test-3",
	}

	testCases := []struct {
		desc                string
		rule                ngmodels.AlertRule
		initStates          []State
		results             [][]eval.Result
		imageService        *CountingImageService
		expectedCalledTimes int
	}{
		{
			desc:       "when transition to Alerting from empty state",
			rule:       baseRule,
			initStates: []State{},
			results: [][]eval.Result{
				{
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels2)),
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels3)),
				},
			},
			imageService:        newSuccessfulCountingImageService(),
			expectedCalledTimes: 1,
		},
		{
			desc: "when transition to Alerting from Normal states, existing images ignored",
			initStates: []State{
				newState(eval.Normal, labels1, randomImage()),
				newState(eval.Normal, labels2, nil),
				newState(eval.Normal, labels3, randomImage()),
			},
			results: [][]eval.Result{
				{
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels2)),
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels3)),
				},
			},
			imageService:        newSuccessfulCountingImageService(),
			expectedCalledTimes: 1,
		},
		{
			desc: "when Alerting and no screenshot",
			initStates: []State{
				newState(eval.Alerting, labels1, nil),
				newState(eval.Alerting, labels2, nil),
				newState(eval.Alerting, labels3, nil),
			},
			results: [][]eval.Result{
				{
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels1)),
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels2)),
					newResult(eval.WithState(eval.Alerting), eval.WithLabels(labels3)),
				},
			},
			imageService:        newSuccessfulCountingImageService(),
			expectedCalledTimes: 1,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			clk := clock.NewMock()

			ctx := context.Background()
			cfg := ManagerCfg{
				Metrics:       metrics.NewNGAlert(prometheus.NewPedanticRegistry()).GetStateMetrics(),
				ExternalURL:   nil,
				InstanceStore: &FakeInstanceStore{},
				Images:        tc.imageService,
				Clock:         clk,
				Historian:     &FakeHistorian{},
				Tracer:        tracing.InitializeTracerForTest(),
				Log:           &logtest.Fake{},
			}

			mgr := NewManager(cfg, NewNoopPersister())
			for _, s := range tc.initStates {
				mgr.cache.set(&s)
			}
			for n, results := range tc.results {
				tx := tn(n)
				clk.Set(t1)
				for idx := range results {
					results[idx].EvaluatedAt = tx
				}
				transitions := mgr.ProcessEvalResults(ctx, t1, &baseRule, results, nil, nil)

				for _, transition := range transitions {
					assert.Equalf(t, tc.imageService.Image, transition.Image, "Transition %s does not have image but should", transition.Labels.String())
				}
			}

			assert.Equal(t, tc.expectedCalledTimes, tc.imageService.Called)
		})
	}
}

func setCacheID(s *State) *State {
	if s.CacheID != 0 {
		return s
	}

	s.CacheID = s.Labels.Fingerprint()

	return s
}
