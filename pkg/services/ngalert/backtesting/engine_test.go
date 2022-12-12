package backtesting

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/eval/eval_mocks"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/user"
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
				e, err := newBacktestingEvaluator(context.Background(), evalFactory, nil, testCase.condition)
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
	states := []eval.State{eval.Normal, eval.Alerting, eval.Pending}
	generateState := func(prefix string) *state.State {
		return &state.State{
			CacheID: "state-" + prefix,
			Labels:  models.GenerateAlertLabels(rand.Intn(5)+1, prefix+"-"),
			State:   states[rand.Intn(len(states))],
		}
	}

	randomResultCallback := func(now time.Time) (eval.Results, error) {
		return eval.GenerateResults(rand.Intn(5)+1, eval.ResultGen()), nil
	}
	evaluator := &fakeBacktestingEvaluator{
		evalCallback: randomResultCallback,
	}
	manager := &fakeStateManager{}

	backtestingEvaluatorFactory = func(ctx context.Context, evalFactory eval.EvaluatorFactory, user *user.SignedInUser, condition models.Condition) (backtestingEvaluator, error) {
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
	}
	rule := models.AlertRuleGen(models.WithInterval(time.Second))()
	ruleInterval := time.Duration(rule.IntervalSeconds) * time.Second

	t.Run("should return data frame in specific format", func(t *testing.T) {
		from := time.Unix(0, 0)
		to := from.Add(5 * ruleInterval)
		allStates := [...]eval.State{eval.Normal, eval.Alerting, eval.Pending, eval.NoData, eval.Error}

		var states []state.StateTransition

		for _, s := range allStates {
			states = append(states, state.StateTransition{
				State: &state.State{
					CacheID:     "state-" + s.String(),
					Labels:      models.GenerateAlertLabels(rand.Intn(5)+1, s.String()+"-"),
					State:       s,
					StateReason: util.GenerateShortUID(),
				},
			})
		}

		manager.stateCallback = func(now time.Time) []state.StateTransition {
			return states
		}

		frame, err := engine.Test(context.Background(), nil, rule, from, to)

		require.NoError(t, err)
		require.Len(t, frame.Fields, len(states)+1) // +1 - timestamp

		t.Run("should contain field Time", func(t *testing.T) {
			timestampField, _ := frame.FieldByName("Time")
			require.NotNil(t, timestampField, "frame does not contain field 'Time'")
			require.Equal(t, data.FieldTypeTime, timestampField.Type())
		})

		fieldByState := make(map[string]*data.Field, len(states))

		t.Run("should contain a field per state", func(t *testing.T) {
			for _, s := range states {
				var f *data.Field
				for _, field := range frame.Fields {
					if field.Labels.String() == s.Labels.String() {
						f = field
						break
					}
				}
				require.NotNilf(t, f, "Cannot find a field by state labels")
				fieldByState[s.CacheID] = f
			}
		})

		t.Run("should be populated with correct values", func(t *testing.T) {
			timestampField, _ := frame.FieldByName("Time")
			expectedLength := timestampField.Len()
			for _, field := range frame.Fields {
				require.Equalf(t, expectedLength, field.Len(), "Field %s should have the size %d", field.Name, expectedLength)
			}
			for i := 0; i < expectedLength; i++ {
				expectedTime := from.Add(time.Duration(int64(i)*rule.IntervalSeconds) * time.Second)
				require.Equal(t, expectedTime, timestampField.At(i).(time.Time))
				for _, s := range states {
					f := fieldByState[s.CacheID]
					if s.State.State == eval.NoData {
						require.Nil(t, f.At(i))
					} else {
						v := f.At(i).(*string)
						require.NotNilf(t, v, "Field [%s] value at index %d should not be nil", s.CacheID, i)
						require.Equal(t, fmt.Sprintf("%s (%s)", s.State.State, s.StateReason), *v)
					}
				}
			}
		})
	})

	t.Run("should backfill field with nulls if a new dimension created in the middle", func(t *testing.T) {
		from := time.Unix(0, 0)

		state1 := state.StateTransition{
			State: generateState("1"),
		}
		state2 := state.StateTransition{
			State: generateState("2"),
		}
		state3 := state.StateTransition{
			State: generateState("3"),
		}
		stateByTime := map[time.Time][]state.StateTransition{
			from:                       {state1, state2},
			from.Add(1 * ruleInterval): {state1, state2},
			from.Add(2 * ruleInterval): {state1, state2},
			from.Add(3 * ruleInterval): {state1, state2, state3},
			from.Add(4 * ruleInterval): {state1, state2, state3},
		}
		to := from.Add(time.Duration(len(stateByTime)) * ruleInterval)

		manager.stateCallback = func(now time.Time) []state.StateTransition {
			return stateByTime[now]
		}

		frame, err := engine.Test(context.Background(), nil, rule, from, to)
		require.NoError(t, err)

		var field3 *data.Field
		for _, field := range frame.Fields {
			if field.Labels.String() == state3.Labels.String() {
				field3 = field
				break
			}
		}
		require.NotNilf(t, field3, "Result for state 3 was not found")
		require.Equalf(t, len(stateByTime), field3.Len(), "State3 result has unexpected number of values")

		idx := 0
		for curTime, states := range stateByTime {
			value := field3.At(idx).(*string)
			if len(states) == 2 {
				require.Nilf(t, value, "The result should be nil if state3 was not available for time %v", curTime)
			}
		}
	})

	t.Run("should fail", func(t *testing.T) {
		manager.stateCallback = func(now time.Time) []state.StateTransition {
			return nil
		}

		t.Run("when interval is not correct", func(t *testing.T) {
			from := time.Now()
			t.Run("when from=to", func(t *testing.T) {
				to := from
				_, err := engine.Test(context.Background(), nil, rule, from, to)
				require.ErrorIs(t, err, ErrInvalidInputData)
			})
			t.Run("when from > to", func(t *testing.T) {
				to := from.Add(-ruleInterval)
				_, err := engine.Test(context.Background(), nil, rule, from, to)
				require.ErrorIs(t, err, ErrInvalidInputData)
			})
			t.Run("when to-from < interval", func(t *testing.T) {
				to := from.Add(ruleInterval).Add(-time.Millisecond)
				_, err := engine.Test(context.Background(), nil, rule, from, to)
				require.ErrorIs(t, err, ErrInvalidInputData)
			})
		})

		t.Run("when evalution fails", func(t *testing.T) {
			expectedError := errors.New("test-error")
			evaluator.evalCallback = func(now time.Time) (eval.Results, error) {
				return nil, expectedError
			}
			from := time.Now()
			to := from.Add(ruleInterval)
			_, err := engine.Test(context.Background(), nil, rule, from, to)
			require.ErrorIs(t, err, expectedError)
		})
	})
}

type fakeStateManager struct {
	stateCallback func(now time.Time) []state.StateTransition
}

func (f *fakeStateManager) ProcessEvalResults(_ context.Context, evaluatedAt time.Time, _ *models.AlertRule, _ eval.Results, _ data.Labels) []state.StateTransition {
	return f.stateCallback(evaluatedAt)
}

type fakeBacktestingEvaluator struct {
	evalCallback func(now time.Time) (eval.Results, error)
}

func (f *fakeBacktestingEvaluator) Eval(_ context.Context, from, to time.Time, interval time.Duration, callback callbackFunc) error {
	idx := 0
	for now := from; now.Before(to); now = now.Add(interval) {
		results, err := f.evalCallback(now)
		if err != nil {
			return err
		}
		err = callback(now, results)
		if err != nil {
			return err
		}
		idx++
	}
	return nil
}
