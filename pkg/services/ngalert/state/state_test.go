package state

import (
	"testing"
	"time"

	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"

	"github.com/stretchr/testify/assert"
)

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
