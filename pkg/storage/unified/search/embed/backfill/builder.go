// Package resourceembedder owns the write-side of vector search: it watches
// dashboard writes, embeds them, and upserts vectors. It also runs a
// best-effort backfill to populate missing embeddings on first deploy or
// model rollout.
package backfill

import (
	"context"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/dashboard"
)

// Builder adapts a resource type to the resourceembedder. One per
// (group, resource). Mirrors the bleve DocumentBuilder pattern.
type Builder interface {
	// Group is the API group, e.g. "dashboard.grafana.app".
	Group() string
	// Resource is the resource type, e.g. "dashboards".
	Resource() string
	// MaxItemsPerResource caps the items returned by a single Extract call.
	// 0 means uncapped. Dashboards default to 200 per the MVP design doc.
	MaxItemsPerResource() int
	// Extract turns a stored value into embeddable items. folderTitle is
	// resolved by the caller against the folder service since unified
	// storage values don't carry it inline.
	Extract(ctx context.Context, key *resourcepb.ResourceKey, value []byte, folderTitle string) ([]embed.Item, error)
}

// DashboardBuilder wraps the existing dashboard.Extractor as a Builder.
type DashboardBuilder struct {
	extractor *dashboard.Extractor
	maxItems  int
}

// NewDashboardBuilder builds a Builder for dashboards. maxItems<=0 defaults
// to 200 per the MVP design doc — anything past that is unlikely
// human-authored.
func NewDashboardBuilder(maxItems int) *DashboardBuilder {
	if maxItems <= 0 {
		maxItems = 200
	}
	return &DashboardBuilder{extractor: dashboard.New(), maxItems: maxItems}
}

func (b *DashboardBuilder) Group() string             { return "dashboard.grafana.app" }
func (b *DashboardBuilder) Resource() string          { return "dashboards" }
func (b *DashboardBuilder) MaxItemsPerResource() int  { return b.maxItems }
func (b *DashboardBuilder) Extract(ctx context.Context, key *resourcepb.ResourceKey, value []byte, folderTitle string) ([]embed.Item, error) {
	return b.extractor.Extract(ctx, key, value, folderTitle)
}
