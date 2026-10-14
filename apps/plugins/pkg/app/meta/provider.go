package meta

import (
	"context"
	"errors"
	"time"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
)

var (
	ErrMetaNotFound = errors.New("not found")

	// ErrMissingCDNURL is returned when grafana.com returns plugin version metadata without a cdnUrl.
	ErrMissingCDNURL = errors.New("missing cdnUrl")
)

// FetchError is returned by providers for failures worth counting in meta_fetch_errors_total.
// Reason becomes the error_type label, so it must stay low-cardinality.
// It unwraps to Err, so errors.Is checks (e.g. ErrMetaNotFound) keep working.
// Providers currently reuse ErrMetaNotFound as the "try the next provider" signal even for
// failures that are not a real not-found; the error type should be reworked to separate the two.
type FetchError struct {
	Reason string
	Err    error
}

func (e *FetchError) Error() string { return e.Err.Error() }

func (e *FetchError) Unwrap() error { return e.Err }

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
	// Name returns the name of the provider.
	Name() string
	// GetMeta retrieves plugin metadata for the given query parameters.
	// Returns the Result containing the MetaJSONData and its recommended TTL.
	// If the plugin is not found, returns ErrMetaNotFound.
	GetMeta(ctx context.Context, ref PluginRef) (*Result, error)
}
