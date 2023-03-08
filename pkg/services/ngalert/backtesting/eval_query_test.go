package backtesting

import (
	"context"
	"errors"
	"math/rand"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/eval/eval_mocks"
)

func TestQueryEvaluator_Eval(t *testing.T) {
	ctx := context.Background()
	interval := time.Duration(rand.Int63n(9)+1) * time.Second
	times := rand.Intn(11) + 5
	to := time.Now()
	from := to.Add(-time.Duration(times) * interval)

	t.Run("should evaluate query", func(t *testing.T) {
		m := &eval_mocks.ConditionEvaluatorMock{}
		expectedResults := eval.Results{}
		m.EXPECT().Evaluate(mock.Anything, mock.Anything).Return(expectedResults, nil)
		evaluator := queryEvaluator{
			eval: m,
		}

		intervals := make([]time.Time, 0, times)

		err := evaluator.Eval(ctx, from, to, interval, func(now time.Time, results eval.Results) error {
			intervals = append(intervals, now)
			return nil
		})
		require.NoError(t, err)
		require.Len(t, intervals, times)

		m.AssertNumberOfCalls(t, "Evaluate", times)
		for _, now := range intervals {
			m.AssertCalled(t, "Evaluate", ctx, now)
		}
	})

	t.Run("should stop evaluation if error", func(t *testing.T) {
		t.Run("when evaluation fails", func(t *testing.T) {
			m := &eval_mocks.ConditionEvaluatorMock{}
			expectedResults := eval.Results{}
			expectedError := errors.New("test")
			m.EXPECT().Evaluate(mock.Anything, mock.Anything).Return(expectedResults, nil).Times(3)
			m.EXPECT().Evaluate(mock.Anything, mock.Anything).Return(nil, expectedError).Once()
			evaluator := queryEvaluator{
				eval: m,
			}

			intervals := make([]time.Time, 0, times)

			err := evaluator.Eval(ctx, from, to, interval, func(now time.Time, results eval.Results) error {
				intervals = append(intervals, now)
				return nil
			})
			require.ErrorIs(t, err, expectedError)
			require.Len(t, intervals, 3)
		})

		t.Run("when callback fails", func(t *testing.T) {
			m := &eval_mocks.ConditionEvaluatorMock{}
			expectedResults := eval.Results{}
			expectedError := errors.New("test")
			m.EXPECT().Evaluate(mock.Anything, mock.Anything).Return(expectedResults, nil)
			evaluator := queryEvaluator{
				eval: m,
			}

			intervals := make([]time.Time, 0, times)

			err := evaluator.Eval(ctx, from, to, interval, func(now time.Time, results eval.Results) error {
				if len(intervals) > 3 {
					return expectedError
				}
				intervals = append(intervals, now)
				return nil
			})
			require.ErrorIs(t, err, expectedError)
		})
	})
}
