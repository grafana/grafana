package server

import (
	"github.com/torkelo/grafana-pro/pkg/api"
	"github.com/torkelo/grafana-pro/pkg/configuration"
	"github.com/torkelo/grafana-pro/pkg/stores"
)

type Server struct {
	HttpServer *api.HttpServer
	Store      stores.Store
}

func NewServer(cfg *configuration.Cfg) (*Server, error) {
	store := stores.New()

	httpServer := api.NewHttpServer(cfg, store)

	return &Server{
		HttpServer: httpServer,
		Store:      store,
	}, nil
}

func (self *Server) ListenAndServe() error {
	self.HttpServer.ListenAndServe()

	return nil
}
