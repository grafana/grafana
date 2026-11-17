package folderimpl

import (
	"context"

	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/folder"
)

// NewServiceForMoveTest builds a Service with only what canMove needs.
func NewServiceForMoveTest(ac accesscontrol.AccessControl, store folder.Store) *Service {
	return &Service{accessControl: ac, unifiedStore: store, tracer: noop.NewTracerProvider().Tracer("test")}
}

func (s *Service) CanMove(ctx context.Context, cmd *folder.MoveFolderCommand) (bool, error) {
	return s.canMove(ctx, cmd)
}
