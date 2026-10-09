// Package server composes storage, search, and their background workers.
package server

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed"
	searchmodel "github.com/grafana/grafana/pkg/storage/unified/search/model"
	searchservice "github.com/grafana/grafana/pkg/storage/unified/search/service"
)

type StorageServer interface {
	resource.ResourceServer
	BeginShutdown(context.Context)
	WriteEvents() resource.Broadcaster[*resource.WrittenEvent]
}

type Server struct {
	storage  StorageServer
	search   searchmodel.SearchServer
	builders embed.BuilderProvider
	workers  *searchservice.Workers
	once     sync.Once
	initErr  error
}

func New(storage StorageServer, search searchmodel.SearchServer, builders embed.BuilderProvider, worker resource.BroadcasterConsumer) *Server {
	if search == nil {
		search = &searchmodel.DisabledServer{Stats: storage}
	} else {
		// Local search validates its enrollment during Init.
		builders = nil
	}
	return &Server{
		storage:  storage,
		search:   searchservice.WithStorageNamespaceChecks(search),
		builders: builders,
		workers:  searchservice.NewWorkers(worker),
	}
}

func (s *Server) StorageHandler() resource.ResourceServer { return s.storage }
func (s *Server) SearchHandler() searchmodel.SearchServer { return s.search }

func (s *Server) Init(ctx context.Context) error {
	s.once.Do(func() {
		if s.builders != nil {
			if err := s.builders.Validate(); err != nil {
				s.initErr = fmt.Errorf("embedding enrollment: %w", err)
				return
			}
		}
		if s.initErr = s.search.Init(ctx); s.initErr != nil {
			return
		}
		if s.initErr = s.storage.Init(ctx); s.initErr != nil {
			return
		}
		s.workers.Start(s.storage.WriteEvents())
	})
	return s.initErr
}

func (s *Server) Stop(ctx context.Context) error {
	s.storage.BeginShutdown(ctx)
	s.workers.Stop(ctx)
	searchErr := s.search.Stop(ctx)
	storageErr := s.storage.Stop(ctx)
	return errors.Join(searchErr, storageErr)
}
