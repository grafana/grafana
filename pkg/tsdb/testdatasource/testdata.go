package testdatasource

import (
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideService(cfg *setting.Cfg) (*Service, error) {
	s := &Service{
		QueryMux:  datasource.NewQueryTypeMux(),
		scenarios: map[string]*Scenario{},
		frame: data.NewFrame("testdata",
			data.NewField("Time", nil, make([]time.Time, 1)),
			data.NewField("Value", nil, make([]float64, 1)),
			data.NewField("Min", nil, make([]float64, 1)),
			data.NewField("Max", nil, make([]float64, 1)),
		),
		logger: log.New("tsdb.testdata"),
		cfg:    cfg,
	}

	return s, nil
}

type Service struct {
	cfg       *setting.Cfg
	logger    log.Logger
	scenarios map[string]*Scenario
	frame     *data.Frame
	QueryMux  *datasource.QueryTypeMux
}

func (s *Service) NewMux() *datasource.QueryTypeMux {
	mux := datasource.NewQueryTypeMux()
	s.registerScenarios(mux)
	return mux
}
