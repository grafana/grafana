package hello

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
)

func init() {
	registry.RegisterService(&HelloService{})
}

type HelloService struct {
	Bus            bus.Bus           `inject:""`
	RouterRegister api.RouteRegister `inject:""`
	log            log.Logger
}

func (s *HelloService) Init() error {
	s.log = log.New("helloservice")

	s.RouterRegister.Get("/hello-service", s.GetHello)
	return nil
}

func (s *HelloService) GetHello(c *models.ReqContext) {
	c.JsonOK("H e l l o")
}

func (s *HelloService) Run(ctx context.Context) error {
	ticker := time.NewTicker(time.Minute * 10)
	defer ticker.Stop()

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
