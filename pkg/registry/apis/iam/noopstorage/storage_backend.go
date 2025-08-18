package noopstorage

import (
	"context"
	"errors"
	"iter"
	"net/http"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var (
	_ resource.StorageBackend = &StorageBackendImpl{}

	errNoopStorage = errors.New("unavailable functionality")
)

type StorageBackendImpl struct{}

func ProvideStorageBackend() *StorageBackendImpl {
	return &StorageBackendImpl{}
}

// GetResourceStats implements resource.StorageBackend.
func (c *StorageBackendImpl) GetResourceStats(ctx context.Context, namespace string, minCount int) ([]resource.ResourceStats, error) {
	return []resource.ResourceStats{}, errNoopStorage
}

// ListHistory implements resource.StorageBackend.
func (c *StorageBackendImpl) ListHistory(context.Context, *resourcepb.ListRequest, func(resource.ListIterator) error) (int64, error) {
	return 0, errNoopStorage
}

// ListIterator implements resource.StorageBackend.
func (c *StorageBackendImpl) ListIterator(context.Context, *resourcepb.ListRequest, func(resource.ListIterator) error) (int64, error) {
	return 0, errNoopStorage
}

func (c *StorageBackendImpl) ListModifiedSince(ctx context.Context, key resource.NamespacedResource, sinceRv int64) (int64, iter.Seq2[*resource.ModifiedResource, error]) {
	return 0, func(yield func(*resource.ModifiedResource, error) bool) {
		yield(nil, errors.New("not implemented"))
	}
}

// ReadResource implements resource.StorageBackend.
func (c *StorageBackendImpl) ReadResource(_ context.Context, req *resourcepb.ReadRequest) *resource.BackendReadResponse {
	return &resource.BackendReadResponse{
		Key:   req.GetKey(),
		Error: &resourcepb.ErrorResult{Code: http.StatusForbidden, Message: errNoopStorage.Error()},
	}
}

// WatchWriteEvents implements resource.StorageBackend.
func (c *StorageBackendImpl) WatchWriteEvents(ctx context.Context) (<-chan *resource.WrittenEvent, error) {
	stream := make(chan *resource.WrittenEvent, 10)
	return stream, nil
}

// WriteEvent implements resource.StorageBackend.
func (c *StorageBackendImpl) WriteEvent(context.Context, resource.WriteEvent) (int64, error) {
	return 0, errNoopStorage
}
