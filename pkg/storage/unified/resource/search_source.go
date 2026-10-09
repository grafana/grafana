package resource

import (
	"context"
	"iter"
	"time"

	claims "github.com/grafana/authlib/types"
	"google.golang.org/grpc/codes"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	searchmodel "github.com/grafana/grafana/pkg/storage/unified/search/model"
)

// StorageReader excludes writes and backend lifecycle operations from search's dependencies.
type StorageReader interface {
	ReadResource(context.Context, *resourcepb.ReadRequest) *BackendReadResponse
	BatchReadResource(context.Context, []BatchReadRequest, bool) (iter.Seq[*BackendReadResponse], error)
	ListIterator(context.Context, *resourcepb.ListRequest, func(ListIterator) error) (int64, error)
	ListHistory(context.Context, *resourcepb.ListRequest, func(ListIterator) error) (int64, error)
	WatchWrittenKeys(context.Context, []schema.GroupResource, func(string)) (<-chan *resourcepb.ResourceKey, error)
	ListModifiedSince(context.Context, NamespacedResource, int64, *time.Time) (int64, iter.Seq2[*ModifiedResource, error])
	WatchWriteEvents(context.Context) (<-chan *WrittenEvent, error)
	GetResourceStats(context.Context, NamespacedResource, int) ([]ResourceStats, error)
	GetResourceStatsWithLimit(context.Context, NamespacedResource, int, int) ([]ResourceStats, error)
	ListStoredResources(context.Context, NamespacedResource) ([]NamespacedResource, error)
	GetResourceLastImportTime(context.Context, NamespacedResource) (time.Time, error)
	ListResourceLastImportTimes(context.Context) (map[NamespacedResource]time.Time, error)
}

func ReadResourcesInChunks(ctx context.Context, backend StorageReader, requests []BatchReadRequest, chunkSize int) iter.Seq[*BackendReadResponse] {
	return readResourcesInChunks(ctx, backend, requests, chunkSize)
}

func RequireUserNamespace(ctx context.Context, namespace string) *resourcepb.ErrorResult {
	return requireUserNamespace(ctx, namespace)
}

func CheckServiceTokenPermissions(id claims.AuthInfo, group, resource, verb string) error {
	return checkServiceTokenPermissions(id, group, resource, verb)
}

func GRPCCodeFromErrorResult(result *resourcepb.ErrorResult) codes.Code {
	return grpcCodeFromErrorResult(result)
}

var ErrUnimplemented = errUnimplemented
var sortableResourceVersion = searchmodel.SortableResourceVersion
