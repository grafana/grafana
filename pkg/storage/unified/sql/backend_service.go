package sql

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type backendLifecycle interface {
	Init(context.Context) error
	Stop(context.Context) error
}

type storageBackendService struct {
	resource.StorageBackend
	resourcepb.DiagnosticsServer
	services.Service

	lifecycle backendLifecycle
}

func newStorageBackendService(backend resource.StorageBackend) (*storageBackendService, error) {
	diagnostics, ok := backend.(resourcepb.DiagnosticsServer)
	if !ok {
		return nil, fmt.Errorf("storage backend does not implement diagnostics")
	}

	svc := &storageBackendService{
		StorageBackend:    backend,
		DiagnosticsServer: diagnostics,
	}

	if lifecycle, ok := backend.(backendLifecycle); ok {
		svc.lifecycle = lifecycle
	}

	svc.Service = services.NewBasicService(svc.starting, svc.running, svc.stopping).
		WithName("unified-storage-backend")
	return svc, nil
}

func (s *storageBackendService) starting(ctx context.Context) error {
	if s.lifecycle == nil {
		return nil
	}
	return s.lifecycle.Init(ctx)
}

func (s *storageBackendService) running(ctx context.Context) error {
	<-ctx.Done()
	return nil
}

func (s *storageBackendService) stopping(_ error) error {
	if s.lifecycle == nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return s.lifecycle.Stop(ctx)
}
