package state

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/stretchr/testify/assert"
)

func TestProcessEvalResults(t *testing.T) {
	evaluationTime, err := time.Parse("2006-01-02", "2021-03-25")
	if err != nil {
		t.Fatalf("error parsing date format: %s", err.Error())
	}
	testCases := []struct {
		desc                       string
		uid                        string
		evalResults                eval.Results
		condition                  models.Condition
		expectedState              eval.State
		expectedReturnedStateCount int
		expectedResultCount        int
		expectedCacheEntries       []AlertState
	}{
		{
			desc: "given a single evaluation result",
			uid:  "test_uid",
			evalResults: eval.Results{
				eval.Result{
					Instance:    data.Labels{"label1": "value1", "label2": "value2"},
					State:       eval.Normal,
					EvaluatedAt: evaluationTime,
				},
			},
			condition: models.Condition{
				Condition: "A",
				OrgID:     123,
			},
			expectedState:              eval.Normal,
			expectedReturnedStateCount: 0,
			expectedResultCount:        1,
			expectedCacheEntries: []AlertState{
				{
					UID:         "test_uid",
					OrgID:       123,
					CacheId:     "test_uid label1=value1, label2=value2",
					Labels:      data.Labels{"label1": "value1", "label2": "value2"},
					State:       eval.Normal,
					Results:     []eval.State{eval.Normal},
					StartsAt:    time.Time{},
					EndsAt:      time.Time{},
					EvaluatedAt: evaluationTime,
				},
			},
		},
		{
			desc: "given a state change from normal to alerting for a single entity",
			uid:  "test_uid",
			evalResults: eval.Results{
				eval.Result{
					Instance:    data.Labels{"label1": "value1", "label2": "value2"},
					State:       eval.Normal,
					EvaluatedAt: evaluationTime,
				},
				eval.Result{
					Instance:    data.Labels{"label1": "value1", "label2": "value2"},
					State:       eval.Alerting,
					EvaluatedAt: evaluationTime.Add(1 * time.Minute),
				},
			},
			condition: models.Condition{
				Condition: "A",
				OrgID:     123,
			},
			expectedState:              eval.Alerting,
			expectedReturnedStateCount: 1,
			expectedResultCount:        2,
			expectedCacheEntries: []AlertState{
				{
					UID:         "test_uid",
					OrgID:       123,
					CacheId:     "test_uid label1=value1, label2=value2",
					Labels:      data.Labels{"label1": "value1", "label2": "value2"},
					State:       eval.Alerting,
					Results:     []eval.State{eval.Normal, eval.Alerting},
					StartsAt:    evaluationTime.Add(1 * time.Minute),
					EndsAt:      evaluationTime.Add(100 * time.Second),
					EvaluatedAt: evaluationTime.Add(1 * time.Minute),
				},
			},
		},
		{
			desc: "given a state change from alerting to normal for a single entity",
			uid:  "test_uid",
			evalResults: eval.Results{
				eval.Result{
					Instance:    data.Labels{"label1": "value1", "label2": "value2"},
					State:       eval.Alerting,
					EvaluatedAt: evaluationTime,
				},
				eval.Result{
					Instance:    data.Labels{"label1": "value1", "label2": "value2"},
					State:       eval.Normal,
					EvaluatedAt: evaluationTime.Add(1 * time.Minute),
				},
			},
			condition: models.Condition{
				Condition: "A",
				OrgID:     123,
			},
			expectedState:              eval.Normal,
			expectedReturnedStateCount: 1,
			expectedResultCount:        2,
			expectedCacheEntries: []AlertState{
				{
					UID:         "test_uid",
					OrgID:       123,
					CacheId:     "test_uid label1=value1, label2=value2",
					Labels:      data.Labels{"label1": "value1", "label2": "value2"},
					State:       eval.Normal,
					Results:     []eval.State{eval.Alerting, eval.Normal},
					StartsAt:    time.Time{},
					EndsAt:      evaluationTime.Add(1 * time.Minute),
					EvaluatedAt: evaluationTime.Add(1 * time.Minute),
				},
			},
		},
		{
			desc: "given a constant alerting state for a single entity",
			uid:  "test_uid",
			evalResults: eval.Results{
				eval.Result{
					Instance:    data.Labels{"label1": "value1", "label2": "value2"},
					State:       eval.Alerting,
					EvaluatedAt: evaluationTime,
				},
				eval.Result{
					Instance:    data.Labels{"label1": "value1", "label2": "value2"},
					State:       eval.Alerting,
					EvaluatedAt: evaluationTime,
				},
			},
			condition: models.Condition{
				Condition: "A",
				OrgID:     123,
			},
			expectedState:              eval.Alerting,
			expectedReturnedStateCount: 0,
			expectedResultCount:        2,
			expectedCacheEntries: []AlertState{
				{
					UID:         "test_uid",
					OrgID:       123,
					CacheId:     "test_uid label1=value1, label2=value2",
					Labels:      data.Labels{"label1": "value1", "label2": "value2"},
					State:       eval.Alerting,
					Results:     []eval.State{eval.Alerting, eval.Alerting},
					StartsAt:    time.Time{},
					EndsAt:      time.Time{},
					EvaluatedAt: evaluationTime,
				},
			},
		},
		{
			desc: "given a constant normal state for a single entity",
			uid:  "test_uid",
			evalResults: eval.Results{
				eval.Result{
					Instance:    data.Labels{"label1": "value1", "label2": "value2"},
					State:       eval.Normal,
					EvaluatedAt: evaluationTime,
				},
				eval.Result{
					Instance:    data.Labels{"label1": "value1", "label2": "value2"},
					State:       eval.Normal,
					EvaluatedAt: evaluationTime,
				},
			},
			condition: models.Condition{
				Condition: "A",
				OrgID:     123,
			},
			expectedState:              eval.Normal,
			expectedReturnedStateCount: 0,
			expectedResultCount:        2,
			expectedCacheEntries: []AlertState{
				{
					UID:         "test_uid",
					OrgID:       123,
					CacheId:     "test_uid label1=value1, label2=value2",
					Labels:      data.Labels{"label1": "value1", "label2": "value2"},
					State:       eval.Normal,
					Results:     []eval.State{eval.Normal, eval.Normal},
					StartsAt:    time.Time{},
					EndsAt:      time.Time{},
					EvaluatedAt: evaluationTime,
				},
			},
		},
	}

	for _, tc := range testCases {
		t.Run("all fields for a cache entry are set correctly", func(t *testing.T) {
			st := NewStateTracker(log.New("test_state_tracker"))
			_ = st.ProcessEvalResults(tc.uid, tc.evalResults, tc.condition)
			for _, entry := range tc.expectedCacheEntries {
				assert.True(t, entry.Equals(st.get(entry.CacheId)))
			}
		})

		t.Run("the correct number of entries are added to the cache", func(t *testing.T) {
			st := NewStateTracker(log.New("test_state_tracker"))
			st.ProcessEvalResults(tc.uid, tc.evalResults, tc.condition)
			assert.Equal(t, len(tc.expectedCacheEntries), len(st.stateCache.cacheMap))
		})

		t.Run("the correct number of states are returned to the caller", func(t *testing.T) {
			st := NewStateTracker(log.New("test_state_tracker"))
			results := st.ProcessEvalResults(tc.uid, tc.evalResults, tc.condition)
			assert.Equal(t, tc.expectedReturnedStateCount, len(results))
		})
	}
}
