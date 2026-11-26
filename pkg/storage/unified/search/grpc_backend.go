package search

import (
	"context"
	"sync"
	"sync/atomic"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/search/enginepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/grpcbackend"
)

// grpcSearchBackend manages one remote index generation for the prototype.
// Its caller owns the gRPC connection.
type grpcSearchBackend struct {
	index   *grpcSearchIndex
	buildMu sync.Mutex
	ready   atomic.Bool
}

var _ resource.SearchBackend = (*grpcSearchBackend)(nil)

func newGRPCSearchBackend(client enginepb.SearchEngineClient, key resource.NamespacedResource, generation string, registry *resource.SearchFieldsRegistry, cfg PostRankAuthzConfig, metrics *resource.BleveIndexMetrics) (*grpcSearchBackend, error) {
	if client == nil || key.Namespace == "" || key.Group == "" || key.Resource == "" || key.IsGlobal() || generation == "" {
		return nil, status.Error(codes.InvalidArgument, "gRPC search backend requires a client and one namespaced index generation")
	}
	selectable, revision, provider := registry.ForKey(key)
	fields, err := resource.SearchableFieldsFromProvider(provider, key.Group, key.Resource)
	if err != nil {
		return nil, err
	}
	if metrics == nil {
		metrics = resource.ProvideIndexMetrics(nil)
	}
	scope := &enginepb.IndexScope{Namespace: key.Namespace, Indexes: []*enginepb.IndexReference{{Group: key.Group, Resource: key.Resource, Generation: generation, SchemaRevision: revision}}}
	return &grpcSearchBackend{index: &grpcSearchIndex{
		key: key, config: cfg.effective(), metrics: metrics,
		schema: newKindSearchFields(provider, key.Group, key.Resource, selectable),
		writer: grpcbackend.IndexWriter{Client: client, Scope: scope, Definitions: fields},
		info:   resource.IndexBuildInfo{SelectableFields: selectable, SearchFieldsHash: revision},
	}}, nil
}

func (b *grpcSearchBackend) GetIndex(key resource.NamespacedResource) resource.ResourceIndex {
	if key == b.index.key && b.ready.Load() {
		return b.index
	}
	return nil
}

func (b *grpcSearchBackend) PeekIndex(key resource.NamespacedResource) resource.ResourceIndex {
	return b.GetIndex(key)
}

func (b *grpcSearchBackend) GetOpenIndexes() []resource.NamespacedResource {
	if b.ready.Load() {
		return []resource.NamespacedResource{b.index.key}
	}
	return nil
}

func (b *grpcSearchBackend) BuildIndex(ctx context.Context, key resource.NamespacedResource, _ int64, _ string, build resource.BuildFn, update resource.UpdateFn, rebuild bool, _ time.Time, _ time.Duration, opts resource.BuildIndexOptions) (resource.ResourceIndex, error) {
	if key != b.index.key {
		return nil, status.Error(codes.InvalidArgument, "index key is outside the configured gRPC scope")
	}
	if opts.SkipIfBuilding {
		if !b.buildMu.TryLock() {
			return nil, resource.ErrIndexBuildInProgress
		}
	} else {
		b.buildMu.Lock()
	}
	defer b.buildMu.Unlock()
	if b.ready.Load() {
		if rebuild {
			return nil, status.Error(codes.FailedPrecondition, "configure a fresh generation to rebuild the index")
		}
		return b.index, nil
	}
	idx := b.index
	if _, err := idx.writer.Client.EnsureIndex(ctx, &enginepb.EnsureIndexRequest{IndexScope: idx.writer.Scope, RequireNew: true}); err != nil {
		return nil, err
	}
	rv, err := build(idx)
	if err != nil {
		return nil, err
	}
	idx.info.BuildTime = time.Now()
	idx.rv.Store(rv)
	idx.update = update
	if _, err := idx.UpdateIndex(ctx); err != nil {
		return nil, err
	}
	b.ready.Store(true)
	return idx, nil
}

// The backend has no local index state, snapshots, or trash to clean up.
func (*grpcSearchBackend) LoadOpenIndexStats(time.Time, time.Duration) ([]resource.ResourceStats, error) {
	return nil, nil
}
func (*grpcSearchBackend) WriteOpenIndexStats(time.Time) error { return nil }
func (*grpcSearchBackend) SnapshotCountThreshold() int64       { return 0 }
func (*grpcSearchBackend) RemoveExpiredTrash(context.Context)  {}
func (*grpcSearchBackend) Stop()                               {}
func (*grpcSearchBackend) TotalDocs() int64                    { return 0 }
