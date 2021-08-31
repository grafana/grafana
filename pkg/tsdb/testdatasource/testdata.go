package testdatasource

import (
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideService(cfg *setting.Cfg, manager backendplugin.Manager) (*TestDataPlugin, error) {
	resourceMux := http.NewServeMux()
	p := new(cfg, resourceMux)
	factory := coreplugin.New(backend.ServeOpts{
		QueryDataHandler:    p.queryMux,
		CallResourceHandler: httpadapter.New(resourceMux),
		StreamHandler:       newTestStreamHandler(p.logger),
	})
	err := manager.Register("testdata", factory)
	if err != nil {
		return nil, err
	}

	return p, nil
}

func new(cfg *setting.Cfg, resourceMux *http.ServeMux) *TestDataPlugin {
	p := &TestDataPlugin{
		logger:    log.New("tsdb.testdata"),
		cfg:       cfg,
		scenarios: map[string]*Scenario{},
		queryMux:  datasource.NewQueryTypeMux(),
	}

	p.registerScenarios()
	p.registerRoutes(resourceMux)

	return p
}

type TestDataPlugin struct {
	cfg       *setting.Cfg
	logger    log.Logger
	scenarios map[string]*Scenario
	queryMux  *datasource.QueryTypeMux
}
