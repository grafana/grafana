package stackdriver

import (
	"context"

	"github.com/grafana/grafana/pkg/tsdb"
)

func (e *StackdriverExecutor) executeAnnotationQuery(ctx context.Context, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	result := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult),
	}

	_, err := e.buildAnnotationQuery(tsdbQuery)
	if err != nil {
		return nil, err
	}

	return result, nil
}

func (e *StackdriverExecutor) buildAnnotationQuery(tsdbQuery *tsdb.TsdbQuery) (*StackdriverQuery, error) {
	return &StackdriverQuery{}, nil
}
