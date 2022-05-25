//go:build integration
// +build integration

package queryhistory

import (
	"encoding/json"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestIntegrationGetQueriesFromQueryHistory(t *testing.T) {
	testScenario(t, "When users tries to get query in empty query history, it should return empty result",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.Req.Form.Add("datasourceUid", "test")
			resp := sc.service.searchHandler(sc.reqContext)
			var response QueryHistorySearchResponse
			err := json.Unmarshal(resp.Body(), &response)
			require.NoError(t, err)
			require.Equal(t, 200, resp.Status())
			require.Equal(t, 0, response.Result.TotalCount)
		})

	testScenarioWithQueryInQueryHistory(t, "When users tries to get query with valid datasourceUid, it should succeed",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.Req.Form.Add("datasourceUid", sc.initialResult.Result.DatasourceUID)
			resp := sc.service.searchHandler(sc.reqContext)
			var response QueryHistorySearchResponse
			err := json.Unmarshal(resp.Body(), &response)
			require.NoError(t, err)
			require.Equal(t, 200, resp.Status())
			require.Equal(t, 1, response.Result.TotalCount)
		})

	testScenarioWithMultipleQueriesInQueryHistory(t, "When users tries to get queries without datasourceUid, it should return correct queries",
		func(t *testing.T, sc scenarioContext) {
			resp := sc.service.searchHandler(sc.reqContext)
			var response QueryHistorySearchResponse
			err := json.Unmarshal(resp.Body(), &response)
			require.NoError(t, err)
			require.Equal(t, 200, resp.Status())
			require.Equal(t, 3, response.Result.TotalCount)
		})

	testScenarioWithMultipleQueriesInQueryHistory(t, "When users tries to get queries with datasourceUid, it should return correct queries",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.Req.Form.Add("datasourceUid", sc.initialResult.Result.DatasourceUID)
			resp := sc.service.searchHandler(sc.reqContext)
			var response QueryHistorySearchResponse
			err := json.Unmarshal(resp.Body(), &response)
			require.NoError(t, err)
			require.Equal(t, 200, resp.Status())
			require.Equal(t, 2, response.Result.TotalCount)
			require.Equal(t, true, response.Result.QueryHistory[0].Starred)
			require.Equal(t, false, response.Result.QueryHistory[1].Starred)
		})

	testScenarioWithMultipleQueriesInQueryHistory(t, "When users tries to get queries with datasourceUid and sort, it should return correct queries",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.Req.Form.Add("datasourceUid", sc.initialResult.Result.DatasourceUID)
			sc.reqContext.Req.Form.Add("sort", "time-asc")
			resp := sc.service.searchHandler(sc.reqContext)
			var response QueryHistorySearchResponse
			err := json.Unmarshal(resp.Body(), &response)
			require.NoError(t, err)
			require.Equal(t, 200, resp.Status())
			require.Equal(t, 2, response.Result.TotalCount)
			require.Equal(t, false, response.Result.QueryHistory[0].Starred)
			require.Equal(t, true, response.Result.QueryHistory[1].Starred)
		})

	testScenarioWithMultipleQueriesInQueryHistory(t, "When users tries to get queries with invalid datasourceUid, it should return empty result",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.Req.Form.Add("datasourceUid", "non-existent")
			resp := sc.service.searchHandler(sc.reqContext)
			var response QueryHistorySearchResponse
			err := json.Unmarshal(resp.Body(), &response)
			require.NoError(t, err)
			require.Equal(t, 200, resp.Status())
			require.Equal(t, 0, response.Result.TotalCount)
		})

	testScenarioWithMultipleQueriesInQueryHistory(t, "When users tries to get queries with multiple datasourceUid, it should return correct queries",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.Req.Form.Add("datasourceUid", testDsUID1)
			sc.reqContext.Req.Form.Add("datasourceUid", testDsUID2)
			resp := sc.service.searchHandler(sc.reqContext)
			var response QueryHistorySearchResponse
			err := json.Unmarshal(resp.Body(), &response)
			require.NoError(t, err)
			require.Equal(t, 200, resp.Status())
			require.Equal(t, 3, response.Result.TotalCount)
		})

	testScenarioWithMultipleQueriesInQueryHistory(t, "When users tries to get starred queries, it should return correct queries",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.Req.Form.Add("datasourceUid", testDsUID1)
			sc.reqContext.Req.Form.Add("onlyStarred", "true")
			resp := sc.service.searchHandler(sc.reqContext)
			var response QueryHistorySearchResponse
			err := json.Unmarshal(resp.Body(), &response)
			require.NoError(t, err)
			require.Equal(t, 200, resp.Status())
			require.Equal(t, 1, response.Result.TotalCount)
			require.Equal(t, true, response.Result.QueryHistory[0].Starred)
		})

	testScenarioWithMultipleQueriesInQueryHistory(t, "When users tries to get queries including search string, it should return correct queries",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.Req.Form.Add("datasourceUid", testDsUID1)
			sc.reqContext.Req.Form.Add("searchString", "2")
			resp := sc.service.searchHandler(sc.reqContext)
			var response QueryHistorySearchResponse
			err := json.Unmarshal(resp.Body(), &response)
			require.NoError(t, err)
			require.Equal(t, 200, resp.Status())
			require.Equal(t, 2, response.Result.TotalCount)
			require.Equal(t, true, response.Result.QueryHistory[0].Starred)
		})

	testScenarioWithMultipleQueriesInQueryHistory(t, "When users tries to get queries using from filter, it should return correct queries",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.Req.Form.Add("from", strconv.FormatInt(time.Now().UnixMilli()-60*1000, 10))
			resp := sc.service.searchHandler(sc.reqContext)
			var response QueryHistorySearchResponse
			err := json.Unmarshal(resp.Body(), &response)
			require.NoError(t, err)
			require.Equal(t, 200, resp.Status())
			require.Equal(t, 3, response.Result.TotalCount)
		})

	testScenarioWithMultipleQueriesInQueryHistory(t, "When users tries to get queries using relative from filter, it should return correct queries",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.Req.Form.Add("from", "now-1m")
			resp := sc.service.searchHandler(sc.reqContext)
			var response QueryHistorySearchResponse
			err := json.Unmarshal(resp.Body(), &response)
			require.NoError(t, err)
			require.Equal(t, 200, resp.Status())
			require.Equal(t, 3, response.Result.TotalCount)
		})

	testScenarioWithMultipleQueriesInQueryHistory(t, "When users tries to get queries using from filter, it should return no queries",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.Req.Form.Add("from", strconv.FormatInt(time.Now().UnixMilli()+60*1000, 10))
			resp := sc.service.searchHandler(sc.reqContext)
			var response QueryHistorySearchResponse
			err := json.Unmarshal(resp.Body(), &response)
			require.NoError(t, err)
			require.Equal(t, 200, resp.Status())
			require.Equal(t, 0, response.Result.TotalCount)
		})

	testScenarioWithMultipleQueriesInQueryHistory(t, "When users tries to get queries using from filter, it should return no queries",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.Req.Form.Add("from", "now+1m")
			resp := sc.service.searchHandler(sc.reqContext)
			var response QueryHistorySearchResponse
			err := json.Unmarshal(resp.Body(), &response)
			require.NoError(t, err)
			require.Equal(t, 200, resp.Status())
			require.Equal(t, 0, response.Result.TotalCount)
		})

	testScenarioWithMultipleQueriesInQueryHistory(t, "When users tries to get queries using to filter, it should return correct queries",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.Req.Form.Add("to", strconv.FormatInt(time.Now().UnixMilli(), 10))
			resp := sc.service.searchHandler(sc.reqContext)
			var response QueryHistorySearchResponse
			err := json.Unmarshal(resp.Body(), &response)
			require.NoError(t, err)
			require.Equal(t, 200, resp.Status())
			require.Equal(t, 3, response.Result.TotalCount)
		})

	testScenarioWithMultipleQueriesInQueryHistory(t, "When users tries to get queries using to filter, it should return correct queries",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.Req.Form.Add("to", "now")
			resp := sc.service.searchHandler(sc.reqContext)
			var response QueryHistorySearchResponse
			err := json.Unmarshal(resp.Body(), &response)
			require.NoError(t, err)
			require.Equal(t, 200, resp.Status())
			require.Equal(t, 3, response.Result.TotalCount)
		})

	testScenarioWithMultipleQueriesInQueryHistory(t, "When users tries to get queries using to filter, it should return no queries",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.Req.Form.Add("to", strconv.FormatInt(time.Now().UnixMilli()-60*1000, 10))
			resp := sc.service.searchHandler(sc.reqContext)
			var response QueryHistorySearchResponse
			err := json.Unmarshal(resp.Body(), &response)
			require.NoError(t, err)
			require.Equal(t, 200, resp.Status())
			require.Equal(t, 0, response.Result.TotalCount)
		})

	testScenarioWithMultipleQueriesInQueryHistory(t, "When users tries to get queries using to filter, it should return no queries",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.Req.Form.Add("to", "now-1m")
			resp := sc.service.searchHandler(sc.reqContext)
			var response QueryHistorySearchResponse
			err := json.Unmarshal(resp.Body(), &response)
			require.NoError(t, err)
			require.Equal(t, 200, resp.Status())
			require.Equal(t, 0, response.Result.TotalCount)
		})

	testScenarioWithMultipleQueriesInQueryHistory(t, "When users tries to get queries using from and to filter, it should return correct queries",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.Req.Form.Add("to", strconv.FormatInt(time.Now().UnixMilli(), 10))
			sc.reqContext.Req.Form.Add("from", strconv.FormatInt(time.Now().UnixMilli()-60*1000, 10))
			resp := sc.service.searchHandler(sc.reqContext)
			var response QueryHistorySearchResponse
			err := json.Unmarshal(resp.Body(), &response)
			require.NoError(t, err)
			require.Equal(t, 200, resp.Status())
			require.Equal(t, 3, response.Result.TotalCount)
		})

	testScenarioWithMultipleQueriesInQueryHistory(t, "When users tries to get queries using from and to filter with other filters, it should return correct queries",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.Req.Form.Add("to", strconv.FormatInt(time.Now().UnixMilli(), 10))
			sc.reqContext.Req.Form.Add("from", strconv.FormatInt(time.Now().UnixMilli()-60*1000, 10))
			sc.reqContext.Req.Form.Add("datasourceUid", testDsUID1)
			sc.reqContext.Req.Form.Add("searchString", "2")
			resp := sc.service.searchHandler(sc.reqContext)
			var response QueryHistorySearchResponse
			err := json.Unmarshal(resp.Body(), &response)
			require.NoError(t, err)
			require.Equal(t, 200, resp.Status())
			require.Equal(t, 2, response.Result.TotalCount)
		})

	testScenarioWithMultipleQueriesInQueryHistory(t, "When users tries to get queries using from and to filter with other filters, it should return correct queries",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.Req.Form.Add("to", "now")
			sc.reqContext.Req.Form.Add("from", "now-1m")
			sc.reqContext.Req.Form.Add("datasourceUid", testDsUID1)
			sc.reqContext.Req.Form.Add("searchString", "2")
			resp := sc.service.searchHandler(sc.reqContext)
			var response QueryHistorySearchResponse
			err := json.Unmarshal(resp.Body(), &response)
			require.NoError(t, err)
			require.Equal(t, 200, resp.Status())
			require.Equal(t, 2, response.Result.TotalCount)
		})

	testScenarioWithMultipleQueriesInQueryHistory(t, "When users tries to get queries using from and to filter with other filters, it should return no query",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.Req.Form.Add("to", strconv.FormatInt(time.Now().UnixMilli()-60, 10))
			sc.reqContext.Req.Form.Add("from", strconv.FormatInt(time.Now().UnixMilli()+60, 10))
			sc.reqContext.Req.Form.Add("datasourceUid", testDsUID1)
			sc.reqContext.Req.Form.Add("searchString", "2")
			resp := sc.service.searchHandler(sc.reqContext)
			var response QueryHistorySearchResponse
			err := json.Unmarshal(resp.Body(), &response)
			require.NoError(t, err)
			require.Equal(t, 200, resp.Status())
			require.Equal(t, 0, response.Result.TotalCount)
		})
}
