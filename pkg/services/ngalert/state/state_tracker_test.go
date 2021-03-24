package state

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/stretchr/testify/assert"
)

func TestProcessEvalResults(t *testing.T) {
	testCases := []struct {
		desc                 string
		uid                  string
		evalResults          eval.Results
		condition            models.Condition
		expectedCacheEntries int
		expectedState        eval.State
		expectedResultCount  int
	}{
		{
			desc: "given a single evaluation result",
			uid:  "test_uid",
			evalResults: eval.Results{
				eval.Result{
					Instance: data.Labels{"label1": "value1", "label2": "value2"},
				},
			},
			expectedCacheEntries: 1,
			expectedState:        eval.Normal,
			expectedResultCount:  0,
		},
		{
			desc: "given a state change from normal to alerting",
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
			expectedCacheEntries: 1,
			expectedState:        eval.Alerting,
			expectedResultCount:  1,
		},
		{
			desc: "given a state change from alerting to normal",
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
			expectedCacheEntries: 1,
			expectedState:        eval.Normal,
			expectedResultCount:  1,
		},
		{
			desc: "given a constant alerting state",
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
			expectedCacheEntries: 1,
			expectedState:        eval.Alerting,
			expectedResultCount:  0,
		},
		{
			desc: "given a constant normal state",
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
			expectedCacheEntries: 1,
			expectedState:        eval.Normal,
			expectedResultCount:  0,
		},
	}

	for _, tc := range testCases {
		t.Run("the correct number of entries are added to the cache", func(t *testing.T) {
			st := NewStateTracker()
			st.ProcessEvalResults(tc.uid, tc.evalResults, tc.condition)
			assert.Equal(t, len(st.stateCache.cacheMap), tc.expectedCacheEntries)
		})

		t.Run("the correct state is set", func(t *testing.T) {
			st := NewStateTracker()
			st.ProcessEvalResults(tc.uid, tc.evalResults, tc.condition)
			assert.Equal(t, st.stateCache.getStateForEntry("test_uid label1=value1, label2=value2"), tc.expectedState)
		})

		t.Run("the correct number of results are returned", func(t *testing.T) {
			st := NewStateTracker()
			results := st.ProcessEvalResults(tc.uid, tc.evalResults, tc.condition)
			assert.Equal(t, len(results), tc.expectedResultCount)
		})
	}
}
