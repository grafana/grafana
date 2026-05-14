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
	// Extract turns a stored value into embeddable items. folderTitle is
	// resolved by the caller against the folder service since unified
	// storage values don't carry it inline.
	Extract(ctx context.Context, key *resourcepb.ResourceKey, value []byte, folderTitle string) ([]Item, error)
}
