package tsdb

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type fakeExecutor struct {
	results   map[string]*QueryResult
	resultsFn map[string]ResultsFn
}

type ResultsFn func(context *TsdbQuery) *QueryResult

func (e *fakeExecutor) Query(ctx context.Context, dsInfo *models.DataSource, context *TsdbQuery) (*Response, error) {
	result := &Response{Results: make(map[string]*QueryResult)}
	for _, query := range context.Queries {
		if results, has := e.results[query.RefId]; has {
			result.Results[query.RefId] = results
		}
		if testFunc, has := e.resultsFn[query.RefId]; has {
			result.Results[query.RefId] = testFunc(context)
		}
	}

	return result, nil
}

func (e *fakeExecutor) Return(refId string, series TimeSeriesSlice) {
	e.results[refId] = &QueryResult{
		RefId: refId, Series: series,
	}
}

func (e *fakeExecutor) HandleQuery(refId string, fn ResultsFn) {
	e.resultsFn[refId] = fn
}
