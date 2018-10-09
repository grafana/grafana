package stackdriver

import (
	"context"
	"fmt"
	"io/ioutil"

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

	req, err := e.createRequest(ctx, e.dsInfo, "metricDescriptors")
	if err != nil {
		slog.Error("Failed to create request", "error", err)
		return nil, fmt.Errorf("Failed to create request. error: %v", err)
	}
	res, err := ctxhttp.Do(ctx, e.httpClient, req)
	if err != nil {
		logger.Info("error2", err)
		return nil, err
	}
	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		logger.Info("error3", err)
		return nil, err
	}
	defer res.Body.Close()
	if err != nil {
		return nil, err
	}

	queryResult.Meta.Set("test", string(body))
	logger.Info("string(body)", "string(body)", string(body))
	result.Results[tsdbQuery.Queries[0].RefId] = queryResult

	return result, nil
}
