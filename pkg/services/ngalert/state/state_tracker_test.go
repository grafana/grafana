package state

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/go-openapi/strfmt"

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
					Instance: data.Labels{"label1": "value1", "label2": "value2"},
				},
			},
			expectedState:              eval.Normal,
			expectedReturnedStateCount: 0,
			expectedResultCount:        1,
			expectedCacheEntries: []AlertState{
				{
					UID:         "test_uid",
					CacheId:     "test_uid label1=value1, label2=value2",
					Labels:      data.Labels{"label1": "value1", "label2": "value2"},
					State:       eval.Normal,
					Results:     []eval.State{eval.Normal},
					StartsAt:    strfmt.DateTime{},
					EndsAt:      strfmt.DateTime{},
					EvaluatedAt: strfmt.DateTime(evaluationTime),
				},
			},
		},
		{
			desc: "given a state change from normal to alerting for a single entity",
			uid:  "test_uid",
			evalResults: eval.Results{
				eval.Result{
					Instance: data.Labels{"label1": "value1", "label2": "value2"},
					State:    eval.Normal,
				},
				eval.Result{
					Instance: data.Labels{"label1": "value1", "label2": "value2"},
					State:    eval.Alerting,
				},
			},
			expectedState:              eval.Alerting,
			expectedReturnedStateCount: 1,
			expectedResultCount:        2,
			expectedCacheEntries: []AlertState{
				{
					UID:         "test_uid",
					CacheId:     "test_uid label1=value1, label2=value2",
					Labels:      data.Labels{"label1": "value1", "label2": "value2"},
					State:       eval.Alerting,
					Results:     []eval.State{eval.Normal, eval.Alerting},
					StartsAt:    strfmt.DateTime{},
					EndsAt:      strfmt.DateTime{},
					EvaluatedAt: strfmt.DateTime(evaluationTime),
				},
			},
		},
		{
			desc: "given a state change from alerting to normal for a single entity",
			uid:  "test_uid",
			evalResults: eval.Results{
				eval.Result{
					Instance: data.Labels{"label1": "value1", "label2": "value2"},
					State:    eval.Alerting,
				},
				eval.Result{
					Instance: data.Labels{"label1": "value1", "label2": "value2"},
					State:    eval.Normal,
				},
			},
			expectedState:              eval.Normal,
			expectedReturnedStateCount: 1,
			expectedResultCount:        2,
			expectedCacheEntries: []AlertState{
				{
					UID:         "test_uid",
					CacheId:     "test_uid label1=value1, label2=value2",
					Labels:      data.Labels{"label1": "value1", "label2": "value2"},
					State:       eval.Normal,
					Results:     []eval.State{eval.Alerting, eval.Normal},
					StartsAt:    strfmt.DateTime{},
					EndsAt:      strfmt.DateTime{},
					EvaluatedAt: strfmt.DateTime(evaluationTime),
				},
			},
		},
		{
			desc: "given a constant alerting state for a single entity",
			uid:  "test_uid",
			evalResults: eval.Results{
				eval.Result{
					Instance: data.Labels{"label1": "value1", "label2": "value2"},
					State:    eval.Alerting,
				},
				eval.Result{
					Instance: data.Labels{"label1": "value1", "label2": "value2"},
					State:    eval.Alerting,
				},
			},
			expectedState:              eval.Alerting,
			expectedReturnedStateCount: 0,
			expectedResultCount:        2,
			expectedCacheEntries: []AlertState{
				{
					UID:         "test_uid",
					CacheId:     "test_uid label1=value1, label2=value2",
					Labels:      data.Labels{"label1": "value1", "label2": "value2"},
					State:       eval.Alerting,
					Results:     []eval.State{eval.Alerting, eval.Alerting},
					StartsAt:    strfmt.DateTime{},
					EndsAt:      strfmt.DateTime{},
					EvaluatedAt: strfmt.DateTime(evaluationTime),
				},
			},
		},
		{
			desc: "given a constant normal state for a single entity",
			uid:  "test_uid",
			evalResults: eval.Results{
				eval.Result{
					Instance: data.Labels{"label1": "value1", "label2": "value2"},
					State:    eval.Normal,
				},
				eval.Result{
					Instance: data.Labels{"label1": "value1", "label2": "value2"},
					State:    eval.Normal,
				},
			},
			expectedState:              eval.Normal,
			expectedReturnedStateCount: 0,
			expectedResultCount:        2,
			expectedCacheEntries: []AlertState{
				{
					UID:         "test_uid",
					CacheId:     "test_uid label1=value1, label2=value2",
					Labels:      data.Labels{"label1": "value1", "label2": "value2"},
					State:       eval.Normal,
					Results:     []eval.State{eval.Normal, eval.Normal},
					StartsAt:    strfmt.DateTime{},
					EndsAt:      strfmt.DateTime{},
					EvaluatedAt: strfmt.DateTime(evaluationTime),
				},
			},
		},
	}

	for _, tc := range testCases {
		t.Run("the correct number of entries are added to the cache", func(t *testing.T) {
			st := NewStateTracker(log.New("test_state_tracker"))
			st.ProcessEvalResults(tc.uid, tc.evalResults, tc.condition)
			assert.Equal(t, len(tc.expectedCacheEntries), len(st.stateCache.cacheMap))
		})

		t.Run("the correct state is set for each evaluation result", func(t *testing.T) {
			st := NewStateTracker(log.New("test_state_tracker"))
			st.ProcessEvalResults(tc.uid, tc.evalResults, tc.condition)
			for _, entry := range tc.expectedCacheEntries {
				testState := st.get(entry.CacheId)
				assert.Equal(t, tc.expectedState, testState.State)
			}
		})

		t.Run("the correct number of states are returned to the caller", func(t *testing.T) {
			st := NewStateTracker(log.New("test_state_tracker"))
			results := st.ProcessEvalResults(tc.uid, tc.evalResults, tc.condition)
			assert.Equal(t, tc.expectedReturnedStateCount, len(results))
		})

		t.Run("the correct results are set for each cache entry", func(t *testing.T) {
			st := NewStateTracker(log.New("test_state_tracker"))
			_ = st.ProcessEvalResults(tc.uid, tc.evalResults, tc.condition)
			for _, entry := range tc.expectedCacheEntries {
				testState := st.get(entry.CacheId)
				assert.Equal(t, len(entry.Results), len(testState.Results))
				for i, res := range entry.Results {
					assert.Equal(t, res, testState.Results[i])
				}
			}
		})
	}
}
