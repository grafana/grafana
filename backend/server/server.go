package server

import (
	"github.com/torkelo/grafana-pro/backend/httpApi"
)

type Server struct {
	HttpServer *httpApi.HttpServer
}

func NewServer(port string) (*Server, error) {
	httpServer := httpApi.NewHttpServer(port)

	return &Server{
		HttpServer: httpServer,
	}, nil
}

func (self *Server) ListenAndServe() error {
	self.HttpServer.ListenAndServe()

	return nil
}
