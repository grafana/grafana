package server

import (
	"github.com/torkelo/grafana-pro/backend/httpApi"
	"github.com/torkelo/grafana-pro/backend/stores"
)

type Server struct {
	HttpServer *httpApi.HttpServer
	Store      stores.Store
}

func NewServer(port string) (*Server, error) {
	store := stores.New()
	httpServer := httpApi.NewHttpServer(port, store)

	return &Server{
		HttpServer: httpServer,
		Store:      store,
	}, nil
}

func (self *Server) ListenAndServe() error {
	self.HttpServer.ListenAndServe()

	return nil
}
