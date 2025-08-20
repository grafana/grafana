package server

import (
	"context"

	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/setting"
)

type coreService struct {
	*services.BasicService
	cfg     *setting.Cfg
	opts    Options
	apiOpts api.ServerOptions
	server  *Server
}

func NewService(cfg *setting.Cfg, opts Options, apiOpts api.ServerOptions) (*coreService, error) {
	s := &coreService{
		opts:    opts,
		apiOpts: apiOpts,
		cfg:     cfg,
	}
	s.BasicService = services.NewBasicService(s.start, s.running, s.stop)
	return s, nil
}

func (s *coreService) start(ctx context.Context) error {
	serv, err := Initialize(ctx, s.cfg, s.opts, s.apiOpts)
	if err != nil {
		return err
	}
	s.server = serv
	return s.server.Init()
}

func (s *coreService) running(_ context.Context) error {
	return s.server.Run()
}

func (s *coreService) stop(failureReason error) error {
	return s.server.Shutdown(context.Background(), failureReason.Error())
}
