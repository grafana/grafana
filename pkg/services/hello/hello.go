package hello

import (
	"context"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/registry"
)

func init() {
	registry.RegisterService(&HelloService{})
}

type HelloService struct {
	Bus bus.Bus `inject:""`
	log log.Logger
}

func (s *HelloService) Init() error {
	s.log = log.New("hello init")
	return nil
}

func (s *HelloService) Run(ctx context.Context) error {
	s.log.Info("Start")
	return nil
}
