package teamdelete

import (
	"context"
	"fmt"
	"sync"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

type Query struct {
	SQL  string
	Args []any
}

type Renderer func(dbHelper *legacysql.LegacyDatabaseHelper, orgID, teamID int64) (Query, error)

type Registrar interface {
	RegisterDelete(renderer Renderer)
}

// Deleted describes a team that has been deleted.
type Deleted struct {
	OrgID   int64
	TeamID  int64
	TeamUID string
}

// DeletedHandler runs after a team is deleted. Its error is logged and never fails the deletion.
type DeletedHandler func(ctx context.Context, deleted Deleted) error

type DeletedRegistrar interface {
	RegisterDeleted(handler DeletedHandler)
}

// DeletedRegistry holds the handlers shared by every team deletion path.
type DeletedRegistry struct {
	mu       sync.RWMutex
	handlers []DeletedHandler
	logger   log.Logger
}

var _ DeletedRegistrar = (*DeletedRegistry)(nil)

func ProvideDeletedRegistry() *DeletedRegistry {
	return &DeletedRegistry{logger: log.New("team.deleted")}
}

func (r *DeletedRegistry) RegisterDeleted(handler DeletedHandler) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.handlers = append(r.handlers, handler)
}

// Run calls every handler in registration order, logging errors and panics so they never fail a completed deletion.
func (r *DeletedRegistry) Run(ctx context.Context, deleted Deleted) {
	r.mu.RLock()
	handlers := r.handlers[:len(r.handlers):len(r.handlers)]
	r.mu.RUnlock()

	// The team is already gone, so a cancelled request must not stop the handlers.
	ctx = context.WithoutCancel(ctx)
	logger := r.logger.FromContext(ctx)
	for _, handler := range handlers {
		func() {
			defer func() {
				if p := recover(); p != nil {
					logger.Error("team deleted handler panicked", "orgID", deleted.OrgID, "teamUID", deleted.TeamUID, "panic", fmt.Sprint(p))
				}
			}()
			if err := handler(ctx, deleted); err != nil {
				logger.Error("team deleted handler failed", "orgID", deleted.OrgID, "teamUID", deleted.TeamUID, "err", err)
			}
		}()
	}
}
