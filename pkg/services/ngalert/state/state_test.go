package state

import (
	"math/rand"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"

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
