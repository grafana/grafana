package alerting

import (
	"encoding/json"
	"testing"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/stretchr/testify/require"
)

func TestGenerateAggr(t *testing.T) {
	aggrTypes := []string{aggrFirst, aggrLast, aggrMean, aggrAvg, aggrMin, aggrMax, aggrCount, "", "invalid"}

	for _, aggr := range aggrTypes {
		t.Run(aggr, func(t *testing.T) {
			result, err := generateAggr(aggr)
			if aggr == "" {
				aggr = aggrLast
			}
			if aggr == "invalid" {
				require.Error(t, err)
			} else {
				require.NoError(t, err)

				require.Equal(t, refIDAggr, result.RefID)
				require.Equal(t, models.RelativeTimeRange{From: 600, To: 0}, result.RelativeTimeRange)
				require.Equal(t, exprDatasourceUID, result.DatasourceUID)

				var m map[string]interface{}
				err = json.Unmarshal(result.Model, &m)
				require.NoError(t, err)

				require.Equal(t, "__expr__", m["datasource"].(map[string]interface{})["type"])
				require.Equal(t, "__expr__", m["datasource"].(map[string]interface{})["uid"])
				require.Equal(t, refIDAggr, m["refId"])
				require.Equal(t, "reduce", m["type"])
				require.Equal(t, aggr, m["reducer"])
				require.Equal(t, "dropNN", m["settings"].(map[string]interface{})["mode"])
				require.Equal(t, refIDAggr, m["conditions"].([]interface{})[0].(map[string]interface{})["query"].(map[string]interface{})["params"].([]interface{})[0])
				require.Equal(t, aggr, m["conditions"].([]interface{})[0].(map[string]interface{})["reducer"].(map[string]interface{})["type"])
			}
		})
	}
}
