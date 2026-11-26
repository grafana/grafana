package search

import (
	"context"
	"iter"
	"math"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	authlib "github.com/grafana/authlib/types"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/enginepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/grpcbackend"
)

type grpcSearchIndex struct {
	key         resource.NamespacedResource
	writer      grpcbackend.IndexWriter
	schema      kindSearchFields
	config      PostRankAuthzConfig
	metrics     *resource.BleveIndexMetrics
	info        resource.IndexBuildInfo
	updateMu    sync.Mutex
	update      resource.UpdateFn
	rv          atomic.Int64
	writeMu     sync.Mutex
	writeFailed bool
}

func (i *grpcSearchIndex) Search(ctx context.Context, access authlib.AccessClient, req *resourcepb.ResourceSearchRequest, _ *resource.SearchIndexes, stats *resource.SearchStats) (response *resourcepb.ResourceSearchResponse, resultErr error) {
	key := req.GetOptions().GetKey()
	if key.GetNamespace() != i.key.Namespace || key.GetGroup() != i.key.Group || key.GetResource() != i.key.Resource {
		return nil, status.Error(codes.InvalidArgument, "search key is outside the configured index")
	}
	// The adapter returns candidates without checking the caller's permissions.
	if access == nil {
		return nil, status.Error(codes.FailedPrecondition, "gRPC search requires Grafana authorization")
	}
	if req.IsDeleted || len(req.Federated) > 0 || len(req.Facet) > 0 {
		return nil, status.Error(codes.Unimplemented, "trash, federation, and facets are not supported yet")
	}
	if req.Limit < 0 || req.Limit > 1000 || req.Offset < 0 || req.Offset > math.MaxInt32 || len(req.SearchAfter) > 0 && len(req.SearchBefore) > 0 {
		return nil, status.Error(codes.InvalidArgument, "invalid search limit, offset or cursor")
	}
	if err := rejectInternalFields(req); err != nil {
		return nil, resource.GRPCStatusError(err)
	}
	if err := validateTrashRequest(req); err != nil {
		return nil, resource.GRPCStatusError(err)
	}
	query, err := grpcbackend.QuerySpec(req, 0)
	if err != nil {
		return nil, err
	}
	requested := req.Fields
	if len(requested) == 0 && req.Limit > 0 {
		requested = []string{resource.SEARCH_FIELD_ALL_FIELDS}
	}
	columns, err := i.schema.resolveFieldValueSchema(requested)
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}
	var fields []string
	for _, def := range columns.definitions {
		switch def.Name {
		case resource.SEARCH_FIELD_LEGACY_ID:
			fields = append(fields, labelFieldPrefix+def.Name)
		default:
			if def.HasCapability(resource.SearchCapabilityRetrieve) || def.HasCapability(resource.SearchCapabilityFacet) || strings.HasPrefix(def.Name, labelFieldPrefix) {
				fields = append(fields, def.Name)
			}
		}
	}
	window := queryRequest{Fields: fields, SearchAfter: req.SearchAfter}
	if len(req.SearchBefore) > 0 {
		window.SearchAfter, window.Reverse = req.SearchBefore, true
	}
	backend := &grpcbackend.QueryBackend{Client: i.writer.Client, Scope: i.writer.Scope, Query: query}
	cfg := i.config
	cfg.MaxWindow = min(cfg.MaxWindow, 10000)
	runner := postRankSearch{key: i.key, backend: backend, config: cfg, indexMetrics: i.metrics}
	rowAccess := access
	access, authMetrics := withSearchAuthObservation(access, i.metrics)
	observeAuth := authMetrics.start(req, access)
	defer func() { observeAuth(response, resultErr) }()
	response = &resourcepb.ResourceSearchResponse{ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES, ResourceVersion: i.rv.Load()}
	hits, err := runner.run(ctx, access, req, window, stats, response, nil)
	if err != nil {
		return nil, err
	}
	logger := log.New("search.grpc-backend")
	if err := setSearchResults(logger, response, columns, hits); err != nil {
		return nil, err
	}
	addRowAccess(ctx, logger, rowAccess, req.AccessVerbs, response, hits)
	return response, nil
}

func (i *grpcSearchIndex) DocCount(ctx context.Context, folder string, _ *resource.SearchStats) (int64, error) {
	query := &enginepb.QuerySpec{DocumentScope: &enginepb.DocumentScope{State: enginepb.DocumentState_DOCUMENT_STATE_LIVE}}
	if folder != "" {
		query.Requirements = []*enginepb.Requirement{{Key: resource.SEARCH_FIELD_FOLDER, Operator: enginepb.SelectorOperator_SELECTOR_OPERATOR_EXACT_EQUALS, Values: []string{folder}}}
	}
	b := grpcbackend.QueryBackend{Client: i.writer.Client, Scope: i.writer.Scope, Query: query}
	res, err := b.Search(ctx, queryRequest{Size: 1})
	return int64(res.Total), err
}

var _ resource.ResourceIndex = (*grpcSearchIndex)(nil)

var errWriteOutcomeUnknown = status.Error(codes.FailedPrecondition, "a write failed; rebuild into a fresh index generation")

func (i *grpcSearchIndex) BulkIndex(req *resource.BulkIndexRequest) error {
	i.writeMu.Lock()
	defer i.writeMu.Unlock()
	if i.writeFailed {
		return errWriteOutcomeUnknown
	}
	batches, err := i.writer.PrepareBatches(req.Items)
	if err != nil {
		return err
	}
	for _, batch := range batches {
		ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
		_, err := i.writer.Client.WriteDocuments(ctx, batch)
		cancel()
		if err != nil {
			// The previous RPC may still complete and overwrite a newer write.
			i.writeFailed = true
			return err
		}
	}
	return nil
}

func (i *grpcSearchIndex) UpdateIndex(ctx context.Context) (int64, error) {
	i.updateMu.Lock()
	defer i.updateMu.Unlock()
	rv := i.rv.Load()
	i.writeMu.Lock()
	failed := i.writeFailed
	i.writeMu.Unlock()
	if failed {
		return rv, errWriteOutcomeUnknown
	}
	if i.update == nil {
		return rv, nil
	}
	next, _, err := i.update(ctx, i, rv)
	if err != nil {
		return rv, err
	}
	if next > rv {
		i.rv.Store(next)
		return next, nil
	}
	return rv, nil
}

func (i *grpcSearchIndex) SearchFieldDefinitions() []resource.SearchFieldDefinition {
	return i.schema.allResultFields
}
func (i *grpcSearchIndex) BuildInfo() (resource.IndexBuildInfo, error) { return i.info, nil }

var errGRPCUnsupported = status.Error(codes.Unimplemented, "operation not supported yet")

func (*grpcSearchIndex) ListManagedObjects(context.Context, *resourcepb.ListManagedObjectsRequest, *resource.SearchStats) (*resourcepb.ListManagedObjectsResponse, error) {
	return nil, errGRPCUnsupported
}
func (*grpcSearchIndex) CountManagedObjects(context.Context, *resource.SearchStats) ([]*resourcepb.CountManagedObjectsResponse_ResourceCount, error) {
	return nil, errGRPCUnsupported
}
func (*grpcSearchIndex) ListDocumentRefs(context.Context, schema.GroupResource) iter.Seq2[resource.DocumentRef, error] {
	return func(yield func(resource.DocumentRef, error) bool) { yield(resource.DocumentRef{}, errGRPCUnsupported) }
}
func (*grpcSearchIndex) DocumentTypes() ([]schema.GroupResource, error) {
	return nil, errGRPCUnsupported
}
func (*grpcSearchIndex) CompletedTypeBuilds() (map[schema.GroupResource]resource.TypeBuild, error) {
	return nil, errGRPCUnsupported
}
func (*grpcSearchIndex) RecordCompletedTypeBuild(schema.GroupResource, resource.TypeBuild) error {
	return errGRPCUnsupported
}
func (*grpcSearchIndex) ReconciledAt() (time.Time, error)      { return time.Time{}, errGRPCUnsupported }
func (*grpcSearchIndex) RecordReconciledAt(time.Time) error    { return errGRPCUnsupported }
func (*grpcSearchIndex) ForgetType(schema.GroupResource) error { return errGRPCUnsupported }
