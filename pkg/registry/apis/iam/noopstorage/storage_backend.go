package noopstorage

import (
	"context"
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var (
	_ resource.StorageBackend = &StorageBackendImpl{}

	errNoopStorage = errors.New("unavailable functionality")
)

// StorageBackendImpl is a StorageBackend that supports no operations. It embeds
// UnimplementedStorageBackend so it does not need to be updated when the
// StorageBackend interface grows.
type StorageBackendImpl struct {
	resource.UnimplementedStorageBackend
}

func ProvideStorageBackend() *StorageBackendImpl {
	return &StorageBackendImpl{}
}

// The read/list/write methods below are overridden (rather than inherited from
// UnimplementedStorageBackend) because they are the operations surfaced to API
// clients when a backend falls back to this noop storage (for example on an
// invalid license), and callers rely on the "unavailable functionality" message
// and Forbidden status. Everything else is inherited from the base.
func (c *StorageBackendImpl) ReadResource(_ context.Context, req *resourcepb.ReadRequest) *resource.BackendReadResponse {
	return &resource.BackendReadResponse{
		Key:   req.GetKey(),
		Error: &resourcepb.ErrorResult{Code: http.StatusForbidden, Message: errNoopStorage.Error()},
	}
}

func (c *StorageBackendImpl) ListIterator(context.Context, *resourcepb.ListRequest, func(resource.ListIterator) error) (int64, error) {
	return 0, errNoopStorage
}

func (c *StorageBackendImpl) WriteEvent(context.Context, resource.WriteEvent) (int64, error) {
	return 0, errNoopStorage
}
