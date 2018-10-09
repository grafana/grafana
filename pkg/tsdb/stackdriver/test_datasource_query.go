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
	"golang.org/x/oauth2/google"

	"github.com/grafana/grafana/pkg/tsdb"
)

func (e *StackdriverExecutor) executeTestDataSource(ctx context.Context, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	gceAutomaticAuthentication := e.dsInfo.JsonData.Get("gceAutomaticAuthentication").MustBool()
	if gceAutomaticAuthentication {
		defaultProject, err := e.getDefaultProject(ctx)
		if err != nil {
			return nil, err
		}
		e.dsInfo.JsonData.Set("defaultProject", defaultProject)
	}

	queryResult := &tsdb.QueryResult{Meta: simplejson.New(), RefId: tsdbQuery.Queries[0].RefId}
	result := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult),
	}

	req, err := e.createRequest(ctx, e.dsInfo, "metricDescriptors")
	if err != nil {
		slog.Error("Failed to create request", "error", err)
		return nil, fmt.Errorf("Failed to create request. error: %v", err)
	}
	res, err := ctxhttp.Do(ctx, e.httpClient, req)
	if err != nil {
		return nil, err
	}

	data, err := e.unmarshalMetricDescriptors(res)
	if err != nil {
		return nil, err
	}

	parts := strings.Split(req.URL.Path, "/")
	defaultProject := parts[3]

	table := transformMetricDescriptorResponseToTable(data)
	queryResult.Tables = append(queryResult.Tables, table)
	result.Results[tsdbQuery.Queries[0].RefId] = queryResult
	result.Results[tsdbQuery.Queries[0].RefId].Meta.Set("defaultProject", defaultProject)

	return result, nil
}

func (e *StackdriverExecutor) getDefaultProject(ctx context.Context) (string, error) {
	defaultCredentials, err := google.FindDefaultCredentials(ctx, "https://www.googleapis.com/auth/monitoring.read")
	if err != nil {
		return "", err
	} else {
		logger.Info("projectName", "projectName", defaultCredentials.ProjectID)
		return defaultCredentials.ProjectID, nil
	}
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
		return MetricDescriptorsResponse{}, fmt.Errorf(`%s`, string(body))
	}

	var data MetricDescriptorsResponse
	err = json.Unmarshal(body, &data)
	if err != nil {
		slog.Error("Failed to unmarshal MetricDescriptorResponse", "error", err, "status", res.Status, "body", string(body))
		return MetricDescriptorsResponse{}, err
	}

	return data, nil
}
