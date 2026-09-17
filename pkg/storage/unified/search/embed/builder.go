package embed

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// ErrSkip means the stored API version has no applicable embedding configuration.
// Consumers preserve existing vectors and continue processing other resources.
var ErrSkip = errors.New("skip embedding extraction")

// BuilderProvider returns one immutable builder snapshot per enrolled resource.
// Consumers request a new snapshot to observe manifest reloads.
type BuilderProvider interface {
	Builders() ([]Builder, error)
	Has(group, resource string) bool
}

// Item is one chunk of a resource ready to be embedded.
type Item struct {
	UID         string          // resource UID (e.g. dashboard UID)
	Title       string          // human-readable title for search results
	Subresource string          // unique within the resource ("" for whole-resource, "panel/5" for sub-parts)
	Content     string          // text to embed
	Metadata    json.RawMessage // structured filter fields (datasourceUid, language, ...) — see embed/dashboard/extractor.go
	Folder      string          // folder UID for authz filtering
}

// Builder adapts a resource type into embeddable Items. One per
// (group, resource). Mirrors the bleve DocumentBuilder pattern.
type Builder interface {
	// Group is the API group, e.g. "dashboard.grafana.app".
	Group() string
	// Resource is the resource type, e.g. "dashboards".
	Resource() string
	// MaxItemsPerResource caps the items returned by a single Extract
	// call. 0 means uncapped.
	MaxItemsPerResource() int
	// Version is the re-embedding revision. Increasing it requests a backfill;
	// generic builders use the manifest's resource-level revision.
	Version() int
	// Extract turns a stored value into embeddable items. folderTitle is optional
	// context that custom builders may include in their content.
	// Return ErrSkip (possibly wrapped) for missing or unknown API-version
	// configuration to preserve existing vectors. Empty items with a nil error
	// mean successful extraction with no content and may remove existing vectors.
	Extract(ctx context.Context, key *resourcepb.ResourceKey, value []byte, folderTitle string) ([]Item, error)
}
