package translate

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/stretchr/testify/require"
)

func TestDashboardAlertConditions(t *testing.T) {
	registerGetDsInfoHandler()
	var tests = []struct {
		name string
		// rawJSON, at least for now, is as "conditions" will appear within the alert table
		// settings column JSON. Which means it has already run through the dashboard
		// alerting Extractor. It is the input.
		rawJSON string

		// Condition is quite large (and unexported things), so check misc attributes.
		spotCheckFn func(t *testing.T, cond *eval.Condition)
	}{
		{
			name:    "two conditions one query but different time ranges",
			rawJSON: twoCondOneQueryDiffTime,
			spotCheckFn: func(t *testing.T, cond *eval.Condition) {
				require.Equal(t, "C", cond.RefID, "unexpected refId for condition")
				require.Equal(t, 3, len(cond.QueriesAndExpressions), "unexpected query/expression array length")

				firstQuery := cond.QueriesAndExpressions[0]
				require.Equal(t, "A", firstQuery.RefID, "unexpected refId for first query")
				require.Equal(t, eval.RelativeTimeRange{
					From: eval.Duration(time.Second * 600),
					To:   eval.Duration(time.Second * 300),
				}, firstQuery.RelativeTimeRange, "unexpected timerange for first query")
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cond, err := DashboardAlertConditions([]byte(tt.rawJSON), 1)
			require.NoError(t, err)

			tt.spotCheckFn(t, cond)
		})
	}
}

var twoCondOneQueryDiffTime = `{ 
	"conditions": [
	{
	  "evaluator": {
		"params": [
		  0
		],
		"type": "gt"
	  },
	  "operator": {
		"type": "and"
	  },
	  "query": {
		"datasourceId": 2,
		"model": {
		  "expr": "avg_over_time(sum by (instance) (up)[1h:5m])",
		  "interval": "",
		  "legendFormat": "",
		  "refId": "A"
		},
		"params": [
		  "A",
		  "5m",
		  "now"
		]
	  },
	  "reducer": {
		"params": [],
		"type": "avg"
	  },
	  "type": "query"
	},
	{
	  "evaluator": {
		"params": [
		  0
		],
		"type": "gt"
	  },
	  "operator": {
		"type": "and"
	  },
	  "query": {
		"datasourceId": 2,
		"model": {
		  "expr": "avg_over_time(sum by (instance) (up)[1h:5m])",
		  "interval": "",
		  "legendFormat": "",
		  "refId": "A"
		},
		"params": [
		  "A",
		  "10m",
		  "now-5m"
		]
	  },
	  "reducer": {
		"params": [],
		"type": "avg"
	  },
	  "type": "query"
	}
  ]}`

func registerGetDsInfoHandler() {
	bus.AddHandler("test", func(query *models.GetDataSourceQuery) error {
		query.Result = &models.DataSource{Id: 2, OrgId: 1, Uid: "000000002"}
		return nil
	})
}
