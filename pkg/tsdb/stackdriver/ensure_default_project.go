package stackdriver

import (
	"context"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
)

func (e *StackdriverExecutor) ensureDefaultProject(ctx context.Context, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	queryResult := &tsdb.QueryResult{Meta: simplejson.New(), RefId: tsdbQuery.Queries[0].RefId}
	result := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult),
	}
	defaultProject, err := e.getDefaultProject(ctx)
	if err != nil {
		return nil, err
	}

	e.dsInfo.JsonData.Set("defaultProject", defaultProject)
	queryResult.Meta.Set("defaultProject", defaultProject)
	result.Results[tsdbQuery.Queries[0].RefId] = queryResult
	return result, nil
}
