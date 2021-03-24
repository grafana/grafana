package state

import (
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/stretchr/testify/assert"
	"testing"
)

func TestProcessEvalResults(t *testing.T) {
	st := NewStateTracker()
	testCases := []struct {
		desc                 string
		uid                  string
		evalResults          eval.Results
		condition            models.Condition
		expectedCacheEntries int
		expectedState        eval.State
	}{
		{
			desc: "given a single evaluation result",
			uid:  "test_uid",
			evalResults: eval.Results{
				eval.Result{
					Instance: data.Labels{"label1": "value1", "label2": "value2"},
				},
			},
			condition: models.Condition{
				RefID:                 "A",
				OrgID:                 1,
				QueriesAndExpressions: nil,
			},
			expectedCacheEntries: 1,
			expectedState:        eval.Normal,
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
		},
	}

	for _, tc := range testCases {
		t.Run("the correct number of entries are added to the cache", func(t *testing.T) {
			st.ProcessEvalResults(tc.uid, tc.evalResults, tc.condition)
			assert.Equal(t, len(st.stateCache.cacheMap), tc.expectedCacheEntries)
		})

		t.Run("the correct state is set", func(t *testing.T) {
			st.ProcessEvalResults(tc.uid, tc.evalResults, tc.condition)
			assert.Equal(t, st.stateCache.getStateForEntry("test_uid label1=value1, label2=value2"), tc.expectedState)
		})
	}
}
