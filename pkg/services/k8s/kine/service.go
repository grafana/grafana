package kine

import (
	"context"

	"github.com/grafana/dskit/services"
	"github.com/k3s-io/kine/pkg/endpoint"
)

// Service is the interface for the kine service.
type Service interface {
	services.Service
}

type EtcdProvider interface {
	GetConfig() *endpoint.ETCDConfig
}

type service struct {
	*services.BasicService
	etcdConfig *endpoint.ETCDConfig
}

func ProvideService() *service {
	s := &service{}
	s.BasicService = services.NewBasicService(s.start, s.running, nil)
	return s
}

func (s *service) GetConfig() *endpoint.ETCDConfig {
	return s.etcdConfig
}

func (s *service) start(ctx context.Context) error {
	config := endpoint.Config{
		Endpoint: "sqlite://data/kine.db",
		Listener: "tcp://127.0.0.1:9990",
	}
	etcdConfig, err := endpoint.Listen(ctx, config)
	if err != nil {
		return err
	}
	s.etcdConfig = &etcdConfig
	return nil
}

func (s *service) running(ctx context.Context) error {
	<-ctx.Done()
	return nil
}
