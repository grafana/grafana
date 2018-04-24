package hello

import (
	"context"
	"time"

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
	return nil
}

func (s *HelloService) Run(ctx context.Context) error {

	ticker := time.NewTicker(time.Minute * 10)

	for {
		select {
		case <-ticker.C:
			s.log.Info("ticker")
		case <-ctx.Done():
			return ctx.Err()
		}
	}

	return nil
}
