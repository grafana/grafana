package state

import (
	"testing"
	"time"

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
