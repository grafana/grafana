package search

import (
	"context"
	"slices"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// routedSearchBackend keeps local maintenance on the default backend. The
// prototype can opt one index into the alternate backend.
type routedSearchBackend struct {
	resource.SearchBackend
	remote  resource.SearchBackend
	key     resource.NamespacedResource
	enabled func(string) bool
}

func (b *routedSearchBackend) backend(key resource.NamespacedResource) resource.SearchBackend {
	if key == b.key && b.enabled(key.Namespace) {
		return b.remote
	}
	return b.SearchBackend
}

func (b *routedSearchBackend) GetIndex(key resource.NamespacedResource) resource.ResourceIndex {
	return b.backend(key).GetIndex(key)
}

func (b *routedSearchBackend) PeekIndex(key resource.NamespacedResource) resource.ResourceIndex {
	return b.backend(key).PeekIndex(key)
}

func (b *routedSearchBackend) GetOpenIndexes() []resource.NamespacedResource {
	keys := b.SearchBackend.GetOpenIndexes()
	if !b.enabled(b.key.Namespace) {
		return keys
	}
	keys = slices.DeleteFunc(slices.Clone(keys), func(key resource.NamespacedResource) bool { return key == b.key })
	if b.remote.PeekIndex(b.key) != nil {
		keys = append(keys, b.key)
	}
	return keys
}

func (b *routedSearchBackend) BuildIndex(ctx context.Context, key resource.NamespacedResource, size int64, reason string, build resource.BuildFn, update resource.UpdateFn, rebuild bool, lastImportTime time.Time, maxFreshSnapshotAge time.Duration, opts resource.BuildIndexOptions) (resource.ResourceIndex, error) {
	return b.backend(key).BuildIndex(ctx, key, size, reason, build, update, rebuild, lastImportTime, maxFreshSnapshotAge, opts)
}

func (b *routedSearchBackend) Stop() {
	b.remote.Stop()
	b.SearchBackend.Stop()
}
