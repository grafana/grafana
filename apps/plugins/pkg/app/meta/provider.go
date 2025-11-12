package meta

import (
	"context"
	"errors"
	"time"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
)

var (
	ErrMetaNotFound = errors.New("not found")
)

// Result contains plugin metadata along with its recommended TTL.
type Result struct {
	Meta *pluginsv0alpha1.GetMeta
	TTL  time.Duration
}

// Provider is used for retrieving plugin metadata.
type Provider interface {
	// GetMeta retrieves plugin metadata for the given plugin ID and version.
	// Returns the Result containing the GetMeta response and its recommended TTL.
	// If the plugin is not found, returns ErrMetaNotFound.
	GetMeta(ctx context.Context, pluginID, version string) (*Result, error)
}
