package server

import (
	"github.com/torkelo/grafana-pro/backend/api"
	"github.com/torkelo/grafana-pro/backend/stores"
)

type Server struct {
	HttpServer *api.HttpServer
	Store      stores.Store
}

func NewServer(port string) (*Server, error) {
	store := stores.New()
	httpServer := api.NewHttpServer(port, store)

	return &Server{
		HttpServer: httpServer,
		Store:      store,
	}, nil
}

func (self *Server) ListenAndServe() error {
	self.HttpServer.ListenAndServe()

	return nil
}
