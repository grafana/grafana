package server

import (
	"github.com/torkelo/grafana-pro/backend/http"
)

type Server struct {
	HttpApi *http.HttpServer
}

func NewServer(port string) (*Server, error) {
	httpApi := http.NewHttpServer(port)

	return &Server{
		HttpApi: httpApi,
	}, nil
}

func (self *Server) ListenAndServe() error {
	self.HttpApi.ListenAndServe()

	return nil
}
