package tsdb

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type FakeExecutor struct {
	results   map[string]*QueryResult
	resultsFn map[string]ResultsFn
}

type ResultsFn func(context *TsdbQuery) *QueryResult

func NewFakeExecutor(dsInfo *models.DataSource) (*FakeExecutor, error) {
	return &FakeExecutor{
		results:   make(map[string]*QueryResult),
		resultsFn: make(map[string]ResultsFn),
	}, nil
}

func (e *FakeExecutor) Query(ctx context.Context, dsInfo *models.DataSource, context *TsdbQuery) (*Response, error) {
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

func (e *FakeExecutor) Return(refId string, series TimeSeriesSlice) {
	e.results[refId] = &QueryResult{
		RefId: refId, Series: series,
	}
}

func (e *FakeExecutor) HandleQuery(refId string, fn ResultsFn) {
	e.resultsFn[refId] = fn
}
