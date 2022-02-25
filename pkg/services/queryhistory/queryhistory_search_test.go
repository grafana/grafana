package queryhistory

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetQueriesFromQueryHistory(t *testing.T) {
	testScenario(t, "When users tries to get query in empty query history, it should return empty result",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.Req.Form.Add("datasourceUid", "test")
			resp := sc.service.searchHandler(sc.reqContext)
			var queryHistory []QueryHistoryDTO
			json.Unmarshal(resp.Body(), &queryHistory)
			require.Equal(t, 200, resp.Status())
			require.Equal(t, 0, len(queryHistory))
		})

	testScenarioWithQueryInQueryHistory(t, "When users tries to get query without datasourceUid, it should fail",
		func(t *testing.T, sc scenarioContext) {
			resp := sc.service.searchHandler(sc.reqContext)
			require.Equal(t, 500, resp.Status())
		})

	testScenarioWithQueryInQueryHistory(t, "When users tries to get query with valid datasourceUid, it should succeed",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.Req.Form.Add("datasourceUid", sc.initialResult.Result.DatasourceUID)
			resp := sc.service.searchHandler(sc.reqContext)
			var response QueryHistorySearchResponse
			json.Unmarshal(resp.Body(), &response)
			require.Equal(t, 200, resp.Status())
			require.Equal(t, 1, len(response.Result))
		})
}
