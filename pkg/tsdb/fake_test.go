package tsdb

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	pluginmodels "github.com/grafana/grafana/pkg/plugins/models"
)

type FakeExecutor struct {
	results   map[string]pluginmodels.DataQueryResult
	resultsFn map[string]ResultsFn
}

type ResultsFn func(context pluginmodels.DataQuery) pluginmodels.DataQueryResult

func NewFakeExecutor(dsInfo *models.DataSource) (*FakeExecutor, error) {
	return &FakeExecutor{
		results:   make(map[string]pluginmodels.DataQueryResult),
		resultsFn: make(map[string]ResultsFn),
	}, nil
}

func (e *FakeExecutor) Query(ctx context.Context, dsInfo *models.DataSource, context pluginmodels.DataQuery) (
	pluginmodels.DataResponse, error) {
	result := pluginmodels.DataResponse{Results: make(map[string]pluginmodels.DataQueryResult)}
	for _, query := range context.Queries {
		if results, has := e.results[query.RefID]; has {
			result.Results[query.RefID] = results
		}
		if testFunc, has := e.resultsFn[query.RefID]; has {
			result.Results[query.RefID] = testFunc(context)
		}
	}

	return result, nil
}

func (e *FakeExecutor) Return(refId string, series pluginmodels.DataTimeSeriesSlice) {
	e.results[refId] = pluginmodels.DataQueryResult{
		RefID: refId, Series: series,
	}
}

func (e *FakeExecutor) HandleQuery(refId string, fn ResultsFn) {
	e.resultsFn[refId] = fn
}
