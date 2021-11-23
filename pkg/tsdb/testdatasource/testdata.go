package testdatasource

import (
	"net/http"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideService(cfg *setting.Cfg, registrar plugins.CoreBackendRegistrar) (*Service, error) {
	s := &Service{
		queryMux:  datasource.NewQueryTypeMux(),
		scenarios: map[string]*Scenario{},
		frame: data.NewFrame("testdata",
			data.NewField("Time", nil, make([]time.Time, 1)),
			data.NewField("Value", nil, make([]float64, 1)),
			data.NewField("Min", nil, make([]float64, 1)),
			data.NewField("Max", nil, make([]float64, 1)),
		),
		labelFrame: data.NewFrame("labeled",
			data.NewField("labels", nil, make([]string, 1)),
			data.NewField("Time", nil, make([]time.Time, 1)),
			data.NewField("Value", nil, make([]float64, 1)),
		),
		logger: log.New("tsdb.testdata"),
		cfg:    cfg,
	}

	s.registerScenarios()

	rMux := http.NewServeMux()
	s.RegisterRoutes(rMux)

	factory := coreplugin.New(backend.ServeOpts{
		QueryDataHandler:    s.queryMux,
		CallResourceHandler: httpadapter.New(rMux),
		StreamHandler:       s,
	})
	err := registrar.LoadAndRegister("testdata", factory)
	if err != nil {
		return nil, err
	}

	return s, nil
}

type Service struct {
	cfg        *setting.Cfg
	logger     log.Logger
	scenarios  map[string]*Scenario
	frame      *data.Frame
	labelFrame *data.Frame
	queryMux   *datasource.QueryTypeMux
}
