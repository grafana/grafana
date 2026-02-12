package backtesting

import (
	"context"
	"encoding/json"
	"errors"
	"math/rand"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/eval/eval_mocks"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/schedule"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/util"
)

func TestNewBacktestingEvaluator(t *testing.T) {
	t.Run("creates data evaluator", func(t *testing.T) {
		frame := GenerateWideSeriesFrame(10, time.Second)
		d := struct {
			Data *data.Frame `json:"data"`
		}{
			Data: frame,
		}
		validData, err := json.Marshal(d)
		require.NoError(t, err)
		refID := util.GenerateShortUID()

		evalFactory := eval_mocks.NewEvaluatorFactory(&eval_mocks.ConditionEvaluatorMock{})

		testCases := []struct {
			name         string
			condition    models.Condition
			error        bool
			expectedEval backtestingEvaluator
		}{
			{
				name: "creates data evaluator when there is one query with type __data__",
				condition: models.Condition{
					Condition: refID,
					Data: []models.AlertQuery{
						{
							RefID:             refID,
							QueryType:         "__data__",
							RelativeTimeRange: models.RelativeTimeRange{},
							DatasourceUID:     "",
							Model:             json.RawMessage(validData),
						},
					},
				},
				expectedEval: &dataEvaluator{},
			},
			{
				name: "creates data evaluator when there is one query with datasource UID __data__",
				condition: models.Condition{
					Condition: refID,
					Data: []models.AlertQuery{
						{
							RefID:             refID,
							QueryType:         "",
							RelativeTimeRange: models.RelativeTimeRange{},
							DatasourceUID:     "__data__",
							Model:             json.RawMessage(validData),
						},
					},
				},
				expectedEval: &dataEvaluator{},
			}, {
				name: "fails if queries contain data and other queries",
				condition: models.Condition{
					Condition: refID,
					Data: []models.AlertQuery{
						{
							RefID:             refID,
							QueryType:         "__data__",
							RelativeTimeRange: models.RelativeTimeRange{},
							DatasourceUID:     "",
							Model:             json.RawMessage(validData),
						},
						{
							RefID:             "D",
							QueryType:         "",
							RelativeTimeRange: models.RelativeTimeRange{},
							DatasourceUID:     util.GenerateShortUID(),
						},
					},
				},
				error: true,
			},
			{
				name: "fails if data query does not contain data",
				condition: models.Condition{
					Condition: refID,
					Data: []models.AlertQuery{
						{
							RefID:             refID,
							QueryType:         "__data__",
							RelativeTimeRange: models.RelativeTimeRange{},
							DatasourceUID:     "",
							Model:             json.RawMessage(nil),
						},
					},
				},
				error: true,
			},
			{
				name: "fails if data query does not contain frame in data",
				condition: models.Condition{
					Condition: refID,
					Data: []models.AlertQuery{
						{
							RefID:             refID,
							QueryType:         "__data__",
							RelativeTimeRange: models.RelativeTimeRange{},
							DatasourceUID:     "",
							Model:             json.RawMessage(`{ "data": "test"}`),
						},
					},
				},
				error: true,
			}, {
				name: "fails if condition refID and data refID does not match",
				condition: models.Condition{
					Condition: refID,
					Data: []models.AlertQuery{
						{
							RefID:             "B",
							QueryType:         "__data__",
							RelativeTimeRange: models.RelativeTimeRange{},
							DatasourceUID:     "",
							Model:             json.RawMessage(validData),
						},
					},
				},
				error: true,
			},
		}

		for _, testCase := range testCases {
			t.Run(testCase.name, func(t *testing.T) {
				e, err := newBacktestingEvaluator(context.Background(), evalFactory, nil, testCase.condition, nil)
				if testCase.error {
					require.Error(t, err)
					return
				}
				require.NoError(t, err)
				require.IsType(t, &dataEvaluator{}, e)
			})
		}
	})
}

func TestEvaluatorTest(t *testing.T) {
	randomResultCallback := func(now time.Time) (eval.Results, error) {
		return eval.GenerateResults(rand.Intn(5)+1, eval.ResultGen()), nil
	}
	evaluator := &fakeBacktestingEvaluator{
		evalCallback: randomResultCallback,
	}
	manager := &fakeStateManager{}

	backtestingEvaluatorFactory = func(ctx context.Context, evalFactory eval.EvaluatorFactory, user identity.Requester, condition models.Condition, r eval.AlertingResultsReader) (backtestingEvaluator, error) {
		return evaluator, nil
	}

	t.Cleanup(func() {
		backtestingEvaluatorFactory = newBacktestingEvaluator
	})

	engine := &Engine{
		evalFactory: nil,
		createStateManager: func() stateManager {
			return manager
		},
		disableGrafanaFolder: false,
		featureToggles:       featuremgmt.WithFeatures(),
		minInterval:          1 * time.Second,
		baseInterval:         1 * time.Second,
		jitterStrategy:       schedule.JitterNever,
		maxEvaluations:       10000,
	}
	gen := models.RuleGen
	rule := gen.With(gen.WithInterval(time.Second)).GenerateRef()
	ruleInterval := time.Duration(rule.IntervalSeconds) * time.Second

	t.Run("should not fail if 'to-from' is not times of interval", func(t *testing.T) {
		from := time.Unix(0, 0)
		to := from.Add(5 * ruleInterval)

		labels := models.GenerateAlertLabels(rand.Intn(5)+1, "test-")
		states := []state.StateTransition{
			{
				State: &state.State{
					CacheID:     labels.Fingerprint(),
					Labels:      labels,
					State:       eval.Normal,
					StateReason: util.GenerateShortUID(),
				},
			},
		}

		manager.stateCallback = func(now time.Time) []state.StateTransition {
			return states
		}

		frame, err := engine.Test(context.Background(), nil, rule, from, to, "")
		require.NoError(t, err)
		expectedLen := frame.Rows()
		for i := 0; i < 100; i++ {
			jitter := time.Duration(rand.Int63n(ruleInterval.Milliseconds())) * time.Millisecond
			frame, err = engine.Test(context.Background(), nil, rule, from, to.Add(jitter), "")
			require.NoError(t, err)
			require.Equalf(t, expectedLen, frame.Rows(), "jitter %v caused result to be different that base-line", jitter)
		}
	})

	t.Run("should fail", func(t *testing.T) {
		manager.stateCallback = func(now time.Time) []state.StateTransition {
			return nil
		}
		t.Run("when interval is not correct", func(t *testing.T) {
			from := time.Now()
			t.Run("when from > to", func(t *testing.T) {
				to := from.Add(-ruleInterval)
				_, err := engine.Test(context.Background(), nil, rule, from, to, "")
				require.ErrorIs(t, err, ErrInvalidInputData)
			})
		})

		t.Run("when evaluation fails", func(t *testing.T) {
			expectedError := errors.New("test-error")
			evaluator.evalCallback = func(now time.Time) (eval.Results, error) {
				return nil, expectedError
			}
			from := time.Now()
			to := from.Add(ruleInterval)
			_, err := engine.Test(context.Background(), nil, rule, from, to, "")
			require.ErrorIs(t, err, expectedError)
		})
	})
}

type fakeStateManager struct {
	stateCallback func(now time.Time) []state.StateTransition
}

func (f *fakeStateManager) ProcessEvalResults(_ context.Context, evaluatedAt time.Time, _ *models.AlertRule, _ eval.Results, _ data.Labels, _ state.Sender) state.StateTransitions {
	return f.stateCallback(evaluatedAt)
}

func (f *fakeStateManager) GetStatesForRuleUID(_ context.Context, orgID int64, alertRuleUID string) []*state.State {
	return nil
}

type fakeBacktestingEvaluator struct {
	evalCallback func(now time.Time) (eval.Results, error)
}

func (f *fakeBacktestingEvaluator) Eval(_ context.Context, from time.Time, interval time.Duration, evaluations int, callback callbackFunc) error {
	for idx, now := 0, from; idx < evaluations; idx, now = idx+1, now.Add(interval) {
		results, err := f.evalCallback(now)
		if err != nil {
			return err
		}
		c, err := callback(idx, now, results)
		if err != nil {
			return err
		}
		if !c {
			break
		}
	}
	return nil
}

func TestGetNextEvaluationTime(t *testing.T) {
	baseInterval := 10 * time.Second

	testCases := []struct {
		name             string
		ruleInterval     int64
		currentTimestamp int64
		jitterOffset     time.Duration
		expectError      bool
		expectedNext     int64
	}{
		{
			name:             "interval not divisible by base interval",
			ruleInterval:     15,
			currentTimestamp: 0,
			jitterOffset:     0,
			expectError:      true,
		},
		{
			name:             "no jitter - from tick 0",
			ruleInterval:     20,
			currentTimestamp: 0,
			jitterOffset:     0,
			expectedNext:     0,
		},
		{
			name:             "no jitter - from tick 1",
			ruleInterval:     20,
			currentTimestamp: 10,
			jitterOffset:     0,
			expectedNext:     20,
		},
		{
			name:             "no jitter - from tick 2",
			ruleInterval:     20,
			currentTimestamp: 20,
			jitterOffset:     0,
			expectedNext:     20,
		},
		{
			name:             "with 20s jitter - from tick 0",
			ruleInterval:     60,
			currentTimestamp: 0,
			jitterOffset:     20 * time.Second,
			expectedNext:     20,
		},
		{
			name:             "with 20s jitter - from tick 2",
			ruleInterval:     60,
			currentTimestamp: 20,
			jitterOffset:     20 * time.Second,
			expectedNext:     20,
		},
		{
			name:             "with 20s jitter - from tick 3",
			ruleInterval:     60,
			currentTimestamp: 30,
			jitterOffset:     20 * time.Second,
			expectedNext:     80,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			rule := &models.AlertRule{IntervalSeconds: tc.ruleInterval}
			currentTime := time.Unix(tc.currentTimestamp, 0)
			result, err := getNextEvaluationTime(currentTime, rule, baseInterval, tc.jitterOffset)

			if tc.expectError {
				require.Error(t, err)
				require.Contains(t, err.Error(), "is not divisible by base interval")
				return
			}

			require.NoError(t, err)
			require.Equal(t, tc.expectedNext, result.Unix())
		})
	}
}

func TestGetFirstEvaluationTime(t *testing.T) {
	baseInterval := 10 * time.Second

	testCases := []struct {
		name         string
		ruleInterval int64
		fromUnix     int64
		jitterOffset time.Duration
		expectError  bool
		expectedUnix int64
	}{
		{
			name:         "interval not divisible by base interval",
			ruleInterval: 15,
			fromUnix:     0,
			jitterOffset: 0,
			expectError:  true,
		},
		{
			name:         "no jitter - from at tick 0",
			ruleInterval: 20,
			fromUnix:     0,
			jitterOffset: 0,
			expectedUnix: 0,
		},
		{
			name:         "no jitter - from at tick 1",
			ruleInterval: 20,
			fromUnix:     10,
			jitterOffset: 0,
			expectedUnix: 20,
		},
		{
			name:         "no jitter - from before first tick",
			ruleInterval: 20,
			fromUnix:     5,
			jitterOffset: 0,
			expectedUnix: 20,
		},
		{
			name:         "no jitter - from after first aligned tick",
			ruleInterval: 20,
			fromUnix:     25,
			jitterOffset: 0,
			expectedUnix: 40,
		},
		{
			name:         "no jitter - from at tick boundary",
			ruleInterval: 10,
			fromUnix:     10,
			jitterOffset: 0,
			expectedUnix: 10,
		},
		{
			name:         "with 20s jitter - from epoch",
			ruleInterval: 60,
			fromUnix:     0,
			jitterOffset: 20 * time.Second,
			expectedUnix: 20,
		},
		{
			name:         "with 20s jitter - from 70s",
			ruleInterval: 60,
			fromUnix:     70,
			jitterOffset: 20 * time.Second,
			expectedUnix: 80,
		},
		{
			name:         "with 50s jitter - from 25s",
			ruleInterval: 60,
			fromUnix:     25,
			jitterOffset: 50 * time.Second,
			expectedUnix: 50,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			rule := &models.AlertRule{IntervalSeconds: tc.ruleInterval}
			from := time.Unix(tc.fromUnix, 0)
			result, err := getFirstEvaluationTime(from, rule, baseInterval, tc.jitterOffset)

			if tc.expectError {
				require.Error(t, err)
				require.Contains(t, err.Error(), "is not divisible by base interval")
				return
			}

			require.NoError(t, err)
			require.Equal(t, tc.expectedUnix, result.Unix())
			require.GreaterOrEqual(t, result.Unix(), from.Unix(), "first eval should be at or after from")
		})
	}
}
