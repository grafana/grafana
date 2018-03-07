package tsdb

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type FakeExecutor struct {
	results   map[string]*QueryResult
	resultsFn map[string]ResultsFn
}

type ResultsFn func(context *QueryContext) *QueryResult

func NewFakeExecutor(dsInfo *models.DataSource) (*FakeExecutor, error) {
	return &FakeExecutor{
		results:   make(map[string]*QueryResult),
		resultsFn: make(map[string]ResultsFn),
	}, nil
}

func (e *FakeExecutor) Execute(ctx context.Context, queries QuerySlice, context *QueryContext) *BatchResult {
	result := &BatchResult{QueryResults: make(map[string]*QueryResult)}
	for _, query := range queries {
		if results, has := e.results[query.RefId]; has {
			result.QueryResults[query.RefId] = results
		}
		if testFunc, has := e.resultsFn[query.RefId]; has {
			result.QueryResults[query.RefId] = testFunc(context)
		}
	}

	return result
}

func (e *FakeExecutor) Return(refId string, series TimeSeriesSlice) {
	e.results[refId] = &QueryResult{
		RefId: refId, Series: series,
	}
}

func (e *FakeExecutor) HandleQuery(refId string, fn ResultsFn) {
	e.resultsFn[refId] = fn
}
