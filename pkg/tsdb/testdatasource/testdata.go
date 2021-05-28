package testdatasource

import (
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/setting"
)

func New(cfg *setting.Cfg) (coreplugin.ServeOpts, error) {
	p := testDataPlugin{
		logger:    log.New("tsdb.testdata"),
		cfg:       cfg,
		scenarios: map[string]*Scenario{},
		queryMux:  datasource.NewQueryTypeMux(),
	}

	p.registerScenarios()
	resourceMux := http.NewServeMux()
	p.registerRoutes(resourceMux)
	return coreplugin.ServeOpts{
		QueryDataHandler:    p.queryMux,
		CallResourceHandler: httpadapter.New(resourceMux),
		StreamHandler:       newTestStreamHandler(p.logger),
	}, nil
}

type testDataPlugin struct {
	cfg       *setting.Cfg
	logger    log.Logger
	scenarios map[string]*Scenario
	queryMux  *datasource.QueryTypeMux
}
