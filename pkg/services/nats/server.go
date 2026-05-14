package nats

import (
	"context"
	"fmt"
	"time"

	"github.com/nats-io/nats-server/v2/server"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/setting"
)

type natsServer struct {
	*services.BasicService
	cfg *setting.Cfg

	server *server.Server
}

func ProvideNATSServer(cfg *setting.Cfg) (*natsServer, error) {
	s := &natsServer{
		cfg: cfg,
	}
	s.BasicService = services.NewBasicService(s.start, s.running, s.stop)
	return s, nil
}

func (s *natsServer) start(ctx context.Context) error {
	opts := &server.Options{}
	ns, err := server.NewServer(opts)
	if err != nil {
		return err
	}

	s.server = ns
	go s.server.Start()
	return nil
}

func (s *natsServer) running(ctx context.Context) error {
	if s.server.ReadyForConnections(100 * time.Millisecond) {
		return nil
	}
	return fmt.Errorf("not ready")
}

func (s *natsServer) stop(failureReason error) error {
	s.server.Shutdown()
	s.server = nil
	return nil
}
