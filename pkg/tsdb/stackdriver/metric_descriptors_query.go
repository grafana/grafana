package stackdriver

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"golang.org/x/net/context/ctxhttp"

	"github.com/grafana/grafana/pkg/tsdb"
)

func (e *StackdriverExecutor) executeMetricDescriptors(ctx context.Context, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	logger.Info("metricDescriptors", "metricDescriptors", tsdbQuery.Queries[0].RefId)
	queryResult := &tsdb.QueryResult{Meta: simplejson.New(), RefId: tsdbQuery.Queries[0].RefId}
	result := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult),
	}

	req, err := e.createRequest(ctx, e.dsInfo, "metricDescriptorss")
	if err != nil {
		slog.Error("Failed to create request", "error", err)
		return nil, fmt.Errorf("Failed to create request. error: %v", err)
	}
	res, err := ctxhttp.Do(ctx, e.httpClient, req)
	if err != nil {
		logger.Info("error2", err)
		return nil, err
	}

	data, err := e.unmarshalMetricDescriptors(res)
	if err != nil {
		queryResult.ErrorString = fmt.Sprintf(`Status code: %d`, res.StatusCode)
		logger.Info("error2", "ErrorString", queryResult.ErrorString)
		queryResult.Error = err
		result.Results[tsdbQuery.Queries[0].RefId] = queryResult
		return result, nil
	}

	parts := strings.Split(req.URL.Path, "/")
	defaultProject := parts[3]

	table := transformMetricDescriptorResponseToTable(data)
	queryResult.Tables = append(queryResult.Tables, table)
	result.Results[tsdbQuery.Queries[0].RefId] = queryResult
	result.Results[tsdbQuery.Queries[0].RefId].Meta.Set("defaultProject", defaultProject)

	return result, nil
}

func transformMetricDescriptorResponseToTable(data MetricDescriptorsResponse) *tsdb.Table {
	table := &tsdb.Table{
		Columns: make([]tsdb.TableColumn, 1),
		Rows:    make([]tsdb.RowValues, 0),
	}
	table.Columns[0].Text = "metricDescriptor"

	for _, r := range data.MetricDescriptors {
		values := make([]interface{}, 1)
		values[0] = r
		table.Rows = append(table.Rows, values)
	}
	return table
}

func (e *StackdriverExecutor) unmarshalMetricDescriptors(res *http.Response) (MetricDescriptorsResponse, error) {
	body, err := ioutil.ReadAll(res.Body)
	defer res.Body.Close()
	if err != nil {
		return MetricDescriptorsResponse{}, err
	}

	if res.StatusCode/100 != 2 {
		slog.Error("Request failed", "status", res.Status, "body", string(body))
		return MetricDescriptorsResponse{}, fmt.Errorf(`Status code: %d - %s`, res.StatusCode, string(body))
	}

	var data MetricDescriptorsResponse
	err = json.Unmarshal(body, &data)
	if err != nil {
		slog.Error("Failed to unmarshal MetricDescriptorResponse", "error", err, "status", res.Status, "body", string(body))
		return MetricDescriptorsResponse{}, err
	}

	return data, nil
}
