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

// PluginRef contains the parameters for retrieving plugin metadata.
type PluginRef struct {
	// ID is the plugin ID to look up unless ParentID is set
	ID string
	// Version is the plugin version to look up.
	Version string
	// ParentID is the optional parent plugin ID
	ParentID *string
}

// HasParent returns true if the PluginRef has a non-empty ParentID.
func (r PluginRef) HasParent() bool {
	return r.ParentID != nil && *r.ParentID != ""
}

// GetParentID returns the ParentID value or empty string if not set.
func (r PluginRef) GetParentID() string {
	if r.ParentID == nil {
		return ""
	}
	return *r.ParentID
}

// Result contains plugin metadata along with its recommended TTL.
type Result struct {
	Meta pluginsv0alpha1.MetaSpec
	TTL  time.Duration
}

// Provider is used for retrieving plugin metadata.
type Provider interface {
	// GetMeta retrieves plugin metadata for the given query parameters.
	// Returns the Result containing the MetaJSONData and its recommended TTL.
	// If the plugin is not found, returns ErrMetaNotFound.
	GetMeta(ctx context.Context, ref PluginRef) (*Result, error)
}
