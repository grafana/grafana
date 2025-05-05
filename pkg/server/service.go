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

func (s *coreService) start(_ context.Context) error {
	serv, err := Initialize(s.cfg, s.opts, s.apiOpts)
	if err != nil {
		return err
	}
	s.server = serv
	return s.server.Init()
}

func (s *coreService) running(ctx context.Context) error {
	errChan := make(chan error, 1)

	go func() {
		err := s.server.Run()
		if err != nil {
			errChan <- err
		}
	}()

	select {
	case err := <-errChan:
		return err
	case <-ctx.Done():
		return nil
	}
}

func (s *coreService) stop(failureReason error) error {
	ctx := context.Background()
	reason := "context canceled"
	if failureReason != nil {
		reason = failureReason.Error()
	}
	err := s.server.Shutdown(ctx, reason)
	return err
}
