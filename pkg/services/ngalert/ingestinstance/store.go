package ingestinstance

import (
	"context"
	"encoding/json"
	"errors"
	"time"
)

var (
	// ErrInstanceNotFound is returned when no instance matches the given token.
	ErrInstanceNotFound = errors.New("ingest instance not found")
)

// Instance represents a configured alert ingestion endpoint. Each instance
// is identified by a unique token and maps to a specific alerting plugin
// and org. The Settings blob is delivered to the plugin as
// AppInstanceSettings.JSONData; it contains both framework-level config
// (static labels, label templates) and plugin-specific config.
type Instance struct {
	// ID is the auto-increment primary key (used by the SQL store).
	ID int64

	// Token is the unique identifier for this instance, used in the
	// webhook URL path. Format: UUID.
	Token string

	// Name is a human-readable label for this instance (e.g.
	// "PagerDuty Production", "Datadog Staging").
	Name string

	// PluginID identifies which alerting plugin handles webhooks for
	// this instance (e.g. "grafana-webhook-alerting").
	PluginID string

	// OrgID is the Grafana organization this instance belongs to.
	OrgID int64

	// Settings is the opaque JSON configuration delivered to the plugin
	// via AppInstanceSettings.JSONData. Contains static labels, label
	// template strings, and any plugin-specific config.
	Settings json.RawMessage

	// CreatedAt is the time the instance was first created.
	CreatedAt time.Time

	// UpdatedAt is the time the instance was last modified.
	UpdatedAt time.Time
}

// Store is the interface for managing alert ingestion instances.
type Store interface {
	// GetByToken retrieves an instance by its webhook token.
	// Returns ErrInstanceNotFound if no match exists.
	GetByToken(ctx context.Context, token string) (*Instance, error)

	// Create persists a new instance. The token must be unique.
	Create(ctx context.Context, instance *Instance) error

	// Update replaces the name and settings for an existing instance and
	// returns the updated instance. Returns ErrInstanceNotFound if no
	// match exists.
	Update(ctx context.Context, orgID int64, token string, name string, settings json.RawMessage) (*Instance, error)

	// Delete removes an instance by token and org.
	// Returns ErrInstanceNotFound if no match exists.
	Delete(ctx context.Context, orgID int64, token string) error

	// ListByOrg returns all instances for the given org.
	ListByOrg(ctx context.Context, orgID int64) ([]*Instance, error)
}
