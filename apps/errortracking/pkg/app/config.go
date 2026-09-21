package app

import (
	"context"
	"time"
)

type Event struct {
	OccurredAt int64
	Project    string
	Message    string
	CreatedBy  string
}

// Store is the app-owned event storage contract.
type Store interface {
	InsertEvent(ctx context.Context, tenant, createdBy, sourceIP, project, message string, occurredAt int64) error
	ListEvents(ctx context.Context, tenant string, from, to time.Time, limit int) ([]Event, error)
}

// Config is the errortracking app-specific config injected by either the
// standalone server or Grafana's embedded registry adapter.
type Config struct {
	Store Store
}
