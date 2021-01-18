package testdatasource

import (
	"context"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/tsdb"
)

func init() {
	registry.RegisterService(&testDataPlugin{})
}

type testDataPlugin struct {
	BackendPluginManager backendplugin.Manager `inject:""`
	logger               log.Logger
}

func (p *testDataPlugin) Init() error {
	p.logger = log.New("tsdb.testdata")
	queryMux := datasource.NewQueryTypeMux()
	RegisterScenarioQueryHandlers(p.logger, queryMux)
	factory := coreplugin.New(backend.ServeOpts{
		QueryDataHandler: queryMux,
	})
	err := p.BackendPluginManager.Register("testdata", factory)
	if err != nil {
		p.logger.Error("Failed to register plugin", "error", err)
	}
	return nil
}

func executeFallbackScenario(ctx context.Context, logger log.Logger, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	tsdbQuery := &tsdb.TsdbQuery{
		TimeRange: tsdb.NewTimeRange(strconv.FormatInt(req.Queries[0].TimeRange.From.UnixNano()/int64(time.Millisecond), 10), strconv.FormatInt(req.Queries[0].TimeRange.To.UnixNano()/int64(time.Millisecond), 10)),
		User: &models.SignedInUser{
			OrgId:   req.PluginContext.OrgID,
			Name:    req.PluginContext.User.Name,
			Login:   req.PluginContext.User.Login,
			Email:   req.PluginContext.User.Email,
			OrgRole: models.RoleType(req.PluginContext.User.Role),
		},
		Headers: map[string]string{},
		Queries: []*tsdb.Query{},
	}

	for _, q := range req.Queries {
		model, err := simplejson.NewJson(q.JSON)
		if err != nil {
			logger.Error("Failed to unmarschal query model to JSON", "error", err)
			continue
		}
		tsdbQuery.Queries = append(tsdbQuery.Queries, &tsdb.Query{
			DataSource:    &models.DataSource{},
			IntervalMs:    q.Interval.Milliseconds(),
			MaxDataPoints: q.MaxDataPoints,
			QueryType:     "",
			RefId:         q.RefID,
			Model:         model,
		})
	}

	result := &tsdb.Response{}
	result.Results = make(map[string]*tsdb.QueryResult)

	for _, query := range tsdbQuery.Queries {
		scenarioId := query.Model.Get("scenarioId").MustString("random_walk")
		if scenario, exist := ScenarioRegistry[scenarioId]; exist {
			result.Results[query.RefId] = scenario.Handler(query, tsdbQuery)
			result.Results[query.RefId].RefId = query.RefId
		} else {
			logger.Error("Scenario not found", "scenarioId", scenarioId)
		}
	}

	for refID, r := range result.Results {
		for _, series := range r.Series {
			frame, err := tsdb.SeriesToFrame(series)
			frame.RefID = refID
			if err != nil {
				return nil, err
			}
			respD := resp.Responses[refID]
			logger.Info("appending frame", "frame", frame)
			respD.Frames = append(respD.Frames, frame)
			resp.Responses[refID] = respD
		}
	}

	logger.Info("Payload", "payload", resp, "tsdb", result)

	return resp, nil
}
