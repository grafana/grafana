package pluginmod

import (
	"context"
	"fmt"

	"github.com/grafana/dskit/services"
)

type Server struct {
	*services.BasicService
}

func NewServer() *Server {
	s := &Server{}
	s.BasicService = services.NewBasicService(s.start, s.run, s.stop)
	fmt.Println("Creating server service...")
	return s
}

func (s *Server) start(ctx context.Context) error {
	fmt.Println("Starting server...")
	return nil
}

func (s *Server) run(ctx context.Context) error {
	fmt.Println("Running server...")
	return nil
}

func (s *Server) stop(failure error) error {
	fmt.Println("Stopping server...")
	return nil
}
