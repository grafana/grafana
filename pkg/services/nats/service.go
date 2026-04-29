package nats

import (
	"context"
	"fmt"
	"time"

	"github.com/nats-io/nats-server/v2/server"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

type natsService struct {
	*services.BasicService
	cfg *setting.Cfg

	server *server.Server
}

func ProvideNATSService(cfg *setting.Cfg, features featuremgmt.FeatureToggles) (*natsService, error) {
	s := &natsService{
		cfg: cfg,
	}
	s.BasicService = services.NewBasicService(s.start, s.running, s.stop)
	return s, nil
}

func (s *natsService) start(ctx context.Context) error {
	opts := &server.Options{}
	ns, err := server.NewServer(opts)
	if err != nil {
		return err
	}

	s.server = ns
	go s.server.Start()
	return nil
}

func (s *natsService) running(ctx context.Context) error {
	if s.server.ReadyForConnections(100 * time.Millisecond) {
		return nil
	}
	return fmt.Errorf("not ready")
}

func (s *natsService) stop(failureReason error) error {
	s.server.Shutdown()
	s.server = nil
	return nil
}
