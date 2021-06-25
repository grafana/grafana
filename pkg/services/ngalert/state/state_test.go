package state

import (
	"testing"
	"time"

	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"

	"github.com/stretchr/testify/assert"
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
		testState  *State
		testRule   *ngmodels.AlertRule
		testResult eval.Result
	}{
		{
			name:      "For: unset Interval: 10s EndsAt should be evaluation time + 2X IntervalSeconds",
			expected:  evaluationTime.Add(20 * time.Second),
			testState: &State{},
			testRule: &ngmodels.AlertRule{
				IntervalSeconds: 10,
			},
			testResult: eval.Result{
				EvaluatedAt: evaluationTime,
			},
		},
		{
			name:      "For: 0s Interval: 10s EndsAt should be evaluation time + 2X IntervalSeconds",
			expected:  evaluationTime.Add(20 * time.Second),
			testState: &State{},
			testRule: &ngmodels.AlertRule{
				For:             0 * time.Second,
				IntervalSeconds: 10,
			},
			testResult: eval.Result{
				EvaluatedAt: evaluationTime,
			},
		},
		{
			name:      "For: 1s Interval: 10s EndsAt should be evaluation time + 2X IntervalSeconds",
			expected:  evaluationTime.Add(20 * time.Second),
			testState: &State{},
			testRule: &ngmodels.AlertRule{
				For:             0 * time.Second,
				IntervalSeconds: 10,
			},
			testResult: eval.Result{
				EvaluatedAt: evaluationTime,
			},
		},
		{
			name:      "For: 10s Interval: 10s EndsAt should be evaluation time + 2X IntervalSeconds",
			expected:  evaluationTime.Add(20 * time.Second),
			testState: &State{},
			testRule: &ngmodels.AlertRule{
				For:             10 * time.Second,
				IntervalSeconds: 10,
			},
			testResult: eval.Result{
				EvaluatedAt: evaluationTime,
			},
		},
		{
			name:      "For: 11s Interval: 10s EndsAt should be evaluation time + For duration",
			expected:  evaluationTime.Add(11 * time.Second),
			testState: &State{},
			testRule: &ngmodels.AlertRule{
				For:             11 * time.Second,
				IntervalSeconds: 10,
			},
			testResult: eval.Result{
				EvaluatedAt: evaluationTime,
			},
		},
		{
			name:      "For: 20s Interval: 10s EndsAt should be evaluation time + For duration",
			expected:  evaluationTime.Add(20 * time.Second),
			testState: &State{},
			testRule: &ngmodels.AlertRule{
				For:             20 * time.Second,
				IntervalSeconds: 10,
			},
			testResult: eval.Result{
				EvaluatedAt: evaluationTime,
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			tc.testState.setEndsAt(tc.testRule, tc.testResult)
			assert.Equal(t, tc.expected, tc.testState.EndsAt)
		})
	}
}
