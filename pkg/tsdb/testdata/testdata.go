package testdata

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
)

type TestDataExecutor struct {
	*models.DataSource
	log log.Logger
}

func NewTestDataExecutor(dsInfo *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	return &TestDataExecutor{
		DataSource: dsInfo,
		log:        log.New("tsdb.testdata"),
	}, nil
}

func init() {
	tsdb.RegisterTsdbQueryEndpoint("testdata", NewTestDataExecutor)
}

func (e *TestDataExecutor) Query(ctx context.Context, dsInfo *models.DataSource, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	result := &tsdb.Response{}
	result.Results = make(map[string]*tsdb.QueryResult)

	for _, query := range tsdbQuery.Queries {
		scenarioId := query.Model.Get("scenarioId").MustString("random_walk")
		if scenario, exist := ScenarioRegistry[scenarioId]; exist {
			result.Results[query.RefId] = scenario.Handler(query, tsdbQuery)
			result.Results[query.RefId].RefId = query.RefId
		} else {
			e.log.Error("Scenario not found", "scenarioId", scenarioId)
		}
	}

	return result, nil
}
