package state

import (
	"math"
	"math/rand"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	ptr "github.com/xorcare/pointer"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestNeedsSending(t *testing.T) {
	evaluationTime, _ := time.Parse("2006-01-02", "2021-03-25")
	testCases := []struct {
		name        string
		resendDelay time.Duration
		expected    bool
		testState   *State
	}{
		{
			name:        "state: alerting and LastSentAt before LastEvaluationTime + ResendDelay",
			resendDelay: 1 * time.Minute,
			expected:    true,
			testState: &State{
				State:              eval.Alerting,
				LastEvaluationTime: evaluationTime,
				LastSentAt:         evaluationTime.Add(-2 * time.Minute),
			},
		},
		{
			name:        "state: alerting and LastSentAt after LastEvaluationTime + ResendDelay",
			resendDelay: 1 * time.Minute,
			expected:    false,
			testState: &State{
				State:              eval.Alerting,
				LastEvaluationTime: evaluationTime,
				LastSentAt:         evaluationTime,
			},
		},
		{
			name:        "state: alerting and LastSentAt equals LastEvaluationTime + ResendDelay",
			resendDelay: 1 * time.Minute,
			expected:    true,
			testState: &State{
				State:              eval.Alerting,
				LastEvaluationTime: evaluationTime,
				LastSentAt:         evaluationTime.Add(-1 * time.Minute),
			},
		},
		{
			name:        "state: pending",
			resendDelay: 1 * time.Minute,
			expected:    false,
			testState: &State{
				State: eval.Pending,
			},
		},
		{
			name:        "state: alerting and ResendDelay is zero",
			resendDelay: 0 * time.Minute,
			expected:    true,
			testState: &State{
				State:              eval.Alerting,
				LastEvaluationTime: evaluationTime,
				LastSentAt:         evaluationTime,
			},
		},
		{
			name:        "state: normal + resolved sends after a minute",
			resendDelay: 1 * time.Minute,
			expected:    true,
			testState: &State{
				State:              eval.Normal,
				Resolved:           true,
				LastEvaluationTime: evaluationTime,
				LastSentAt:         evaluationTime.Add(-1 * time.Minute),
			},
		},
		{
			name:        "state: normal + resolved does _not_ send after 30 seconds (before one minute)",
			resendDelay: 1 * time.Minute,
			expected:    false,
			testState: &State{
				State:              eval.Normal,
				Resolved:           true,
				LastEvaluationTime: evaluationTime,
				LastSentAt:         evaluationTime.Add(-30 * time.Second),
			},
		},
		{
			name:        "state: normal but not resolved does not send after a minute",
			resendDelay: 1 * time.Minute,
			expected:    false,
			testState: &State{
				State:              eval.Normal,
				Resolved:           false,
				LastEvaluationTime: evaluationTime,
				LastSentAt:         evaluationTime.Add(-1 * time.Minute),
			},
		},
		{
			name:        "state: no-data, needs to be re-sent",
			expected:    true,
			resendDelay: 1 * time.Minute,
			testState: &State{
				State:              eval.NoData,
				LastEvaluationTime: evaluationTime,
				LastSentAt:         evaluationTime.Add(-1 * time.Minute),
			},
		},
		{
			name:        "state: no-data, should not be re-sent",
			expected:    false,
			resendDelay: 1 * time.Minute,
			testState: &State{
				State:              eval.NoData,
				LastEvaluationTime: evaluationTime,
				LastSentAt:         evaluationTime.Add(-time.Duration(rand.Int63n(59)+1) * time.Second),
			},
		},
		{
			name:        "state: error, needs to be re-sent",
			expected:    true,
			resendDelay: 1 * time.Minute,
			testState: &State{
				State:              eval.Error,
				LastEvaluationTime: evaluationTime,
				LastSentAt:         evaluationTime.Add(-1 * time.Minute),
			},
		},
		{
			name:        "state: error, should not be re-sent",
			expected:    false,
			resendDelay: 1 * time.Minute,
			testState: &State{
				State:              eval.Error,
				LastEvaluationTime: evaluationTime,
				LastSentAt:         evaluationTime.Add(-time.Duration(rand.Int63n(59)+1) * time.Second),
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, tc.testState.NeedsSending(tc.resendDelay))
		})
	}
}

func TestSetEndsAt(t *testing.T) {
	evaluationTime, _ := time.Parse("2006-01-02", "2021-03-25")
	testCases := []struct {
		name       string
		expected   time.Time
		testRule   *ngmodels.AlertRule
		testResult eval.Result
	}{
		{
			name:     "less than resend delay: for=unset,interval=10s - endsAt = resendDelay * 3",
			expected: evaluationTime.Add(ResendDelay * 3),
			testRule: &ngmodels.AlertRule{
				IntervalSeconds: 10,
			},
		},
		{
			name:     "less than resend delay: for=0s,interval=10s - endsAt = resendDelay * 3",
			expected: evaluationTime.Add(ResendDelay * 3),
			testRule: &ngmodels.AlertRule{
				For:             0 * time.Second,
				IntervalSeconds: 10,
			},
		},
		{
			name:     "less than resend delay: for=10s,interval=10s - endsAt = resendDelay * 3",
			expected: evaluationTime.Add(ResendDelay * 3),
			testRule: &ngmodels.AlertRule{
				For:             10 * time.Second,
				IntervalSeconds: 10,
			},
		},
		{
			name:     "less than resend delay: for=10s,interval=20s - endsAt = resendDelay * 3",
			expected: evaluationTime.Add(ResendDelay * 3),
			testRule: &ngmodels.AlertRule{
				For:             10 * time.Second,
				IntervalSeconds: 20,
			},
		},
		{
			name:     "more than resend delay: for=unset,interval=1m - endsAt = interval * 3",
			expected: evaluationTime.Add(time.Second * 60 * 3),
			testRule: &ngmodels.AlertRule{
				IntervalSeconds: 60,
			},
		},
		{
			name:     "more than resend delay: for=0s,interval=1m - endsAt = resendDelay * 3",
			expected: evaluationTime.Add(time.Second * 60 * 3),
			testRule: &ngmodels.AlertRule{
				For:             0 * time.Second,
				IntervalSeconds: 60,
			},
		},
		{
			name:     "more than resend delay: for=1m,interval=5m - endsAt = interval * 3",
			expected: evaluationTime.Add(time.Second * 300 * 3),
			testRule: &ngmodels.AlertRule{
				For:             60 * time.Second,
				IntervalSeconds: 300,
			},
		},
		{
			name:     "more than resend delay: for=5m,interval=1m - endsAt = interval * 3",
			expected: evaluationTime.Add(time.Second * 60 * 3),
			testRule: &ngmodels.AlertRule{
				For:             300 * time.Second,
				IntervalSeconds: 60,
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			s := &State{}
			r := eval.Result{EvaluatedAt: evaluationTime}
			s.setEndsAt(tc.testRule, r)
			assert.Equal(t, tc.expected, s.EndsAt)
		})
	}
}

func TestGetLastEvaluationValuesForCondition(t *testing.T) {
	genState := func(results []Evaluation) *State {
		return &State{
			Results: results,
		}
	}

	t.Run("should return nil if no results", func(t *testing.T) {
		result := genState(nil).GetLastEvaluationValuesForCondition()
		require.Nil(t, result)
	})
	t.Run("should return value of the condition of the last result", func(t *testing.T) {
		expected := rand.Float64()
		evals := []Evaluation{
			{
				EvaluationTime:  time.Time{},
				EvaluationState: 0,
				Values: map[string]*float64{
					"A": ptr.Float64(rand.Float64()),
				},
				Condition: "A",
			},
			{
				EvaluationTime:  time.Time{},
				EvaluationState: 0,
				Values: map[string]*float64{
					"B": ptr.Float64(rand.Float64()),
					"A": ptr.Float64(expected),
				},
				Condition: "A",
			},
		}
		result := genState(evals).GetLastEvaluationValuesForCondition()
		require.Len(t, result, 1)
		require.Contains(t, result, "A")
		require.Equal(t, result["A"], expected)
	})
	t.Run("should return empty map if there is no value for condition", func(t *testing.T) {
		evals := []Evaluation{
			{
				EvaluationTime:  time.Time{},
				EvaluationState: 0,
				Values: map[string]*float64{
					"C": ptr.Float64(rand.Float64()),
				},
				Condition: "A",
			},
		}
		result := genState(evals).GetLastEvaluationValuesForCondition()
		require.NotNil(t, result)
		require.Len(t, result, 0)
	})
	t.Run("should use NaN if value is not defined", func(t *testing.T) {
		evals := []Evaluation{
			{
				EvaluationTime:  time.Time{},
				EvaluationState: 0,
				Values: map[string]*float64{
					"A": nil,
				},
				Condition: "A",
			},
		}
		result := genState(evals).GetLastEvaluationValuesForCondition()
		require.NotNil(t, result)
		require.Len(t, result, 1)
		require.Contains(t, result, "A")
		require.Truef(t, math.IsNaN(result["A"]), "expected NaN but got %v", result["A"])
	})
}
