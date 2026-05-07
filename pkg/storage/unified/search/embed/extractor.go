// Package embed defines the contract for extracting embeddable items from
// unified storage resources. Each resource type has its own Extractor; the
// vector write pipeline calls the matching one and feeds the items to an
// embedding model before persisting Vectors via the vector backend.
package embed

import (
	"context"
	"encoding/json"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Item is one chunk of a resource ready to be embedded.
type Item struct {
	UID         string          // resource UID (e.g. dashboard UID)
	Title       string          // human-readable title for search results
	Subresource string          // unique within the resource ("" for whole-resource, "panel/5" for sub-parts)
	Content     string          // text to embed
	Metadata    json.RawMessage // structured filter fields (datasource_uids, query_languages, ...)
	Folder      string          // folder UID for authz filtering
}

// Extractor turns a unified storage resource into Items. Implementations are
// resource-type-specific. A future generic extractor will handle resources
// that don't need custom logic; complex types (dashboards) implement their
// own.
type Extractor interface {
	// Resource is the resource type this extractor handles (e.g. "dashboards").
	Resource() string

	// Extract returns the items for one resource instance. `value` is the raw
	// JSON bytes of the resource as stored in unified storage. `folderTitle`
	// is the parent folder's display title, resolved by the caller from the
	// resource's folder UID; pass "" if unknown. Returning an empty slice is
	// valid — the resource has no embeddable content.
	Extract(ctx context.Context, key *resourcepb.ResourceKey, value []byte, folderTitle string) ([]Item, error)
}
