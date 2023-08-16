package server

import (
	"context"

	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/setting"
)

type service struct {
	*services.BasicService
	cla     setting.CommandLineArgs
	opts    Options
	apiOpts api.ServerOptions
	server  *Server
}

func NewService(cla setting.CommandLineArgs, opts Options, apiOpts api.ServerOptions) (*service, error) {
	s := &service{
		cla:     cla,
		opts:    opts,
		apiOpts: apiOpts,
	}
	s.BasicService = services.NewBasicService(s.start, s.running, s.stop)
	return s, nil
}

func (s *service) start(_ context.Context) error {
	serv, err := Initialize(s.cla, s.opts, s.apiOpts)
	if err != nil {
		return err
	}
	s.server = serv
	return s.server.Init()
}

func (s *service) running(_ context.Context) error {
	return s.server.Run()
}

func (s *service) stop(failureReason error) error {
	return s.server.Shutdown(context.Background(), failureReason.Error())
}
