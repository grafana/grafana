package server

import (
	"github.com/torkelo/grafana-pro/backend/httpApi"
	"github.com/torkelo/grafana-pro/backend/stores"
)

type Server struct {
	HttpServer *httpApi.HttpServer
}

func NewServer(port string) (*Server, error) {
	httpServer := httpApi.NewHttpServer(port)
	dashStore := stores.New()

	return &Server{
		HttpServer: httpServer,
	}, nil
}

func (self *Server) ListenAndServe() error {
	self.HttpServer.ListenAndServe()

	return nil
}
