package resource

import (
	"context"
	"errors"
	"iter"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// errUnimplemented is returned by UnimplementedStorageBackend for every method
// that an embedding backend has not overridden.
var errUnimplemented = errors.New("not implemented by this storage backend")

// UnimplementedStorageBackend is a StorageBackend that does not support any
// operation. It is meant to be embedded by backends that only implement a
// subset of StorageBackend (for example the IAM apiserver backends, which serve
// a single resource from legacy SQL and do not participate in unified storage
// discovery, stats or history).
//
// Embedding it means such backends only implement the methods they actually
// support, and automatically get a safe default for the rest. It also means new
// StorageBackend methods do not have to be added to every partial backend.
//
// Trade-off: because the embedded methods satisfy the interface, the compiler no
// longer forces an embedding backend to implement a method it genuinely should.
// Only embed this in backends that intentionally implement a subset.
type UnimplementedStorageBackend struct{}

var _ StorageBackend = (*UnimplementedStorageBackend)(nil)

func (UnimplementedStorageBackend) WriteEvent(context.Context, WriteEvent) (int64, error) {
	return 0, errUnimplemented
}

func (UnimplementedStorageBackend) ReadResource(_ context.Context, req *resourcepb.ReadRequest) *BackendReadResponse {
	return &BackendReadResponse{
		Key: req.GetKey(),
		Error: &resourcepb.ErrorResult{
			Code:    http.StatusNotImplemented,
			Message: errUnimplemented.Error(),
		},
	}
}

func (UnimplementedStorageBackend) ListIterator(context.Context, *resourcepb.ListRequest, func(ListIterator) error) (int64, error) {
	return 0, errUnimplemented
}

func (UnimplementedStorageBackend) ListHistory(context.Context, *resourcepb.ListRequest, func(ListIterator) error) (int64, error) {
	return 0, errUnimplemented
}

func (UnimplementedStorageBackend) ListModifiedSince(context.Context, NamespacedResource, int64, *time.Time) (int64, iter.Seq2[*ModifiedResource, error]) {
	return 0, func(yield func(*ModifiedResource, error) bool) {
		yield(nil, errUnimplemented)
	}
}

// WatchWriteEvents returns an open channel that never emits, rather than an
// error. The storage server's watcher treats a WatchWriteEvents error as fatal,
// so a backend that produces no events must still return a usable channel.
func (UnimplementedStorageBackend) WatchWriteEvents(context.Context) (<-chan *WrittenEvent, error) {
	return make(chan *WrittenEvent), nil
}

func (UnimplementedStorageBackend) GetResourceStats(context.Context, NamespacedResource, int) ([]ResourceStats, error) {
	return nil, errUnimplemented
}

func (UnimplementedStorageBackend) GetResourceStatsWithLimit(context.Context, NamespacedResource, int, int) ([]ResourceStats, error) {
	return nil, errUnimplemented
}

func (UnimplementedStorageBackend) ListStoredResources(context.Context, NamespacedResource) ([]NamespacedResource, error) {
	return nil, errUnimplemented
}

func (UnimplementedStorageBackend) GetResourceLastImportTimes(context.Context) iter.Seq2[ResourceLastImportTime, error] {
	return func(yield func(ResourceLastImportTime, error) bool) {
		yield(ResourceLastImportTime{}, errUnimplemented)
	}
}
