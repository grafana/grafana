package api

import (
	"context"
	"sort"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/tsdb/testdatasource"
	"github.com/grafana/grafana/pkg/util"
)

// QueryMetricsV2 returns query metrics
// POST /api/ds/query   DataSource query w/ expressions
func (hs *HTTPServer) QueryMetricsV2(c *models.ReqContext, reqDto dtos.MetricRequest) Response {
	if len(reqDto.Queries) == 0 {
		return Error(500, "No queries found in query", nil)
	}

	request := &tsdb.TsdbQuery{
		TimeRange: tsdb.NewTimeRange(reqDto.From, reqDto.To),
		Debug:     reqDto.Debug,
		User:      c.SignedInUser,
	}

	expr := false
	var ds *models.DataSource
	for i, query := range reqDto.Queries {
		name := query.Get("datasource").MustString("")
		if name == "__expr__" {
			expr = true
		}

		datasourceID, err := query.Get("datasourceId").Int64()
		if err != nil {
			return Error(500, "datasource missing ID", nil)
		}

		if i == 0 && !expr {
			ds, err = hs.DatasourceCache.GetDatasource(datasourceID, c.SignedInUser, c.SkipCache)
			if err != nil {
				if err == models.ErrDataSourceAccessDenied {
					return Error(403, "Access denied to datasource", err)
				}
				return Error(500, "Unable to load datasource meta data", err)
			}
		}

		request.Queries = append(request.Queries, &tsdb.Query{
			RefId:         query.Get("refId").MustString("A"),
			MaxDataPoints: query.Get("maxDataPoints").MustInt64(100),
			IntervalMs:    query.Get("intervalMs").MustInt64(1000),
			QueryType:     query.Get("queryType").MustString(""),
			Model:         query,
			DataSource:    ds,
		})
	}

	var resp *tsdb.Response
	var err error
	if !expr {
		resp, err = tsdb.HandleRequest(c.Req.Context(), ds, request)
		if err != nil {
			return Error(500, "Metric request error", err)
		}
	} else {
		if !setting.IsExpressionsEnabled() {
			return Error(404, "Expressions feature toggle is not enabled", nil)
		}

		resp, err = plugins.Transform.Transform(c.Req.Context(), request)
		if err != nil {
			return Error(500, "Transform request error", err)
		}
	}

	statusCode := 200
	for _, res := range resp.Results {
		if res.Error != nil {
			res.ErrorString = res.Error.Error()
			resp.Message = res.ErrorString
			statusCode = 400
		}
	}

	return JSON(statusCode, &resp)
}

// QueryMetrics returns query metrics
// POST /api/tsdb/query
func (hs *HTTPServer) QueryMetrics(c *models.ReqContext, reqDto dtos.MetricRequest) Response {
	timeRange := tsdb.NewTimeRange(reqDto.From, reqDto.To)

	if len(reqDto.Queries) == 0 {
		return Error(400, "No queries found in query", nil)
	}

	datasourceId, err := reqDto.Queries[0].Get("datasourceId").Int64()
	if err != nil {
		return Error(400, "Query missing datasourceId", nil)
	}

	ds, err := hs.DatasourceCache.GetDatasource(datasourceId, c.SignedInUser, c.SkipCache)
	if err != nil {
		if err == models.ErrDataSourceAccessDenied {
			return Error(403, "Access denied to datasource", err)
		}
		return Error(500, "Unable to load datasource meta data", err)
	}

	request := &tsdb.TsdbQuery{
		TimeRange: timeRange,
		Debug:     reqDto.Debug,
		User:      c.SignedInUser,
	}

	for _, query := range reqDto.Queries {
		request.Queries = append(request.Queries, &tsdb.Query{
			RefId:         query.Get("refId").MustString("A"),
			MaxDataPoints: query.Get("maxDataPoints").MustInt64(100),
			IntervalMs:    query.Get("intervalMs").MustInt64(1000),
			Model:         query,
			DataSource:    ds,
		})
	}

	resp, err := tsdb.HandleRequest(c.Req.Context(), ds, request)
	if err != nil {
		return Error(500, "Metric request error", err)
	}

	statusCode := 200
	for _, res := range resp.Results {
		if res.Error != nil {
			res.ErrorString = res.Error.Error()
			resp.Message = res.ErrorString
			statusCode = 400
		}
	}

	return JSON(statusCode, &resp)
}

// GET /api/tsdb/testdata/scenarios
func GetTestDataScenarios(c *models.ReqContext) Response {
	result := make([]interface{}, 0)

	scenarioIds := make([]string, 0)
	for id := range testdatasource.ScenarioRegistry {
		scenarioIds = append(scenarioIds, id)
	}
	sort.Strings(scenarioIds)

	for _, scenarioId := range scenarioIds {
		scenario := testdatasource.ScenarioRegistry[scenarioId]
		result = append(result, map[string]interface{}{
			"id":          scenario.Id,
			"name":        scenario.Name,
			"description": scenario.Description,
			"stringInput": scenario.StringInput,
		})
	}

	return JSON(200, &result)
}

// GenerateError generates a index out of range error
func GenerateError(c *models.ReqContext) Response {
	var array []string
	// nolint: govet
	return JSON(200, array[20])
}

// GET /api/tsdb/testdata/gensql
func GenerateSQLTestData(c *models.ReqContext) Response {
	if err := bus.Dispatch(&models.InsertSqlTestDataCommand{}); err != nil {
		return Error(500, "Failed to insert test data", err)
	}

	return JSON(200, &util.DynMap{"message": "OK"})
}

// GET /api/tsdb/testdata/random-walk
func GetTestDataRandomWalk(c *models.ReqContext) Response {
	from := c.Query("from")
	to := c.Query("to")
	intervalMs := c.QueryInt64("intervalMs")

	timeRange := tsdb.NewTimeRange(from, to)
	request := &tsdb.TsdbQuery{TimeRange: timeRange}

	dsInfo := &models.DataSource{Type: "testdata"}
	request.Queries = append(request.Queries, &tsdb.Query{
		RefId:      "A",
		IntervalMs: intervalMs,
		Model: simplejson.NewFromAny(&util.DynMap{
			"scenario": "random_walk",
		}),
		DataSource: dsInfo,
	})

	resp, err := tsdb.HandleRequest(context.Background(), dsInfo, request)
	if err != nil {
		return Error(500, "Metric request error", err)
	}

	return JSON(200, &resp)
}
