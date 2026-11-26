package grpcbackend

import (
	"context"
	"fmt"
	"math"
	"slices"
	"strconv"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/durationpb"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/enginepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/enginequery"
)

// The bridge binds one Query and index Scope for all windows and revalidation
// reads. Fields maps runner-specific response keys to logical field names/views.
// These inputs are immutable for the duration of the search.
type QueryBackend struct {
	Client enginepb.SearchEngineClient
	Scope  *enginepb.IndexScope
	Query  *enginepb.QuerySpec
	Fields map[string]*enginepb.RequestedField
}

var _ enginequery.Backend = (*QueryBackend)(nil)

func (b *QueryBackend) Search(ctx context.Context, req enginequery.Request) (enginequery.Result, error) {
	if req.Size <= 0 || uint64(req.Size) > math.MaxUint32 {
		return enginequery.Result{}, status.Error(codes.InvalidArgument, "invalid candidate window size")
	}
	fields := b.requestedFields(req.Fields)
	wire := &enginepb.SearchCandidatesRequest{
		IndexScope: b.Scope, Query: b.Query, WindowSize: uint32(req.Size), Fields: fields, Reverse: req.Reverse,
	}
	if rv := req.DeletedResourceVersionLowerBound; rv != nil {
		if len(req.SearchAfter) > 0 || req.Reverse || *rv < 0 {
			return enginequery.Result{}, status.Error(codes.InvalidArgument, "invalid deleted resource-version starting position")
		}
		wire.StartPosition = &enginepb.SearchCandidatesRequest_DeletedResourceVersionLowerBound{DeletedResourceVersionLowerBound: *rv}
	} else if len(req.SearchAfter) > 0 {
		wire.StartPosition = &enginepb.SearchCandidatesRequest_SearchAfter{SearchAfter: &enginepb.Cursor{Parts: req.SearchAfter}}
	}
	res, err := b.Client.SearchCandidates(ctx, wire)
	if err != nil {
		return enginequery.Result{}, err
	}
	if res == nil || len(res.Hits) > req.Size || uint64(len(res.Hits)) > res.TotalMatches || res.TotalMatches > math.MaxInt64 {
		return enginequery.Result{}, invalidEngineResponse("invalid candidate window or total")
	}
	return b.decodeResult(res.Hits, res.Fields, res.Took, enginequery.Result{Total: res.TotalMatches, MaxScore: res.GetMaxScore(), Cost: res.GetIndexBytesRead()}, fields, nil, true, true)
}

func (b *QueryBackend) ReadAuthzMetadata(ctx context.Context, ids []string) (enginequery.Metadata, error) {
	fields := []*enginepb.RequestedField{
		{Name: resource.SEARCH_FIELD_FOLDER, ResponseKey: resource.SEARCH_FIELD_FOLDER},
	}
	if b.Query.GetDocumentScope().GetState() == enginepb.DocumentState_DOCUMENT_STATE_TRASH {
		fields = append(fields, &enginepb.RequestedField{Name: resource.SEARCH_FIELD_DELETED_BY, ResponseKey: resource.SEARCH_FIELD_DELETED_BY})
	}
	res, err := b.readDocuments(ctx, ids, fields, nil)
	if err != nil {
		return enginequery.Metadata{}, err
	}
	values := make(map[string]enginequery.AuthzMetadata, len(res.Hits))
	for _, hit := range res.Hits {
		folder, _ := hit.Fields[resource.SEARCH_FIELD_FOLDER].(string) // validated by readDocuments
		deleter, err := metadataString(hit, resource.SEARCH_FIELD_DELETED_BY)
		if err != nil {
			return enginequery.Metadata{}, err
		}
		values[hit.ID] = enginequery.AuthzMetadata{Folder: folder, DeletedBy: deleter}
	}
	return enginequery.Metadata{Values: values, Took: res.Took, Cost: res.Cost}, nil
}

func metadataString(hit *enginequery.Hit, field string) (string, error) {
	if value, present := hit.Fields[field]; present {
		if s, ok := value.(string); ok {
			return s, nil
		}
		return "", invalidEngineResponse("invalid authorization field %q", field)
	}
	return "", nil
}

func (b *QueryBackend) Lookup(ctx context.Context, req enginequery.LookupRequest) (enginequery.Result, error) {
	// The wire sort key compares equal in either traversal direction.
	fields := slices.Clone(req.Fields)
	authzFields := []string{resource.SEARCH_FIELD_FOLDER}
	if b.Query.GetDocumentScope().GetState() == enginepb.DocumentState_DOCUMENT_STATE_TRASH {
		authzFields = append(authzFields, resource.SEARCH_FIELD_DELETED_BY)
	}
	for _, field := range authzFields {
		if !slices.Contains(fields, field) {
			fields = append(fields, field)
		}
	}
	return b.readDocuments(ctx, req.IDs, b.requestedFields(fields), b.Query)
}

func (b *QueryBackend) requestedFields(names []string) []*enginepb.RequestedField {
	var result []*enginepb.RequestedField
	seen := make(map[string]bool, len(names))
	for _, name := range names {
		if seen[name] {
			continue
		}
		seen[name] = true
		switch name {
		case resource.SEARCH_FIELD_RV, resource.SEARCH_FIELD_RV_STRING, resource.SEARCH_FIELD_SCORE:
			// These are carried separately on Hit.
			continue
		}
		if field := b.Fields[name]; field != nil {
			result = append(result, field)
		} else {
			result = append(result, &enginepb.RequestedField{Name: name, ResponseKey: name})
		}
	}
	return result
}

func (b *QueryBackend) readDocuments(ctx context.Context, ids []string, fields []*enginepb.RequestedField, query *enginepb.QuerySpec) (enginequery.Result, error) {
	if len(ids) == 0 {
		return enginequery.Result{}, nil
	}
	keys := make([]*resourcepb.ResourceKey, 0, len(ids))
	requested := make(map[string]bool, len(ids))
	for _, id := range ids {
		key := &resourcepb.ResourceKey{}
		if err := resource.ReadSearchID(key, id); err != nil || !b.containsKey(key) || resource.SearchID(key) != id {
			return enginequery.Result{}, status.Error(codes.InvalidArgument, "invalid document ID for index Scope")
		}
		if !requested[id] {
			keys = append(keys, key)
			requested[id] = true
		}
	}
	res, err := b.Client.ReadDocuments(ctx, &enginepb.ReadDocumentsRequest{IndexScope: b.Scope, Query: query, Keys: keys, Fields: fields})
	if err != nil {
		return enginequery.Result{}, err
	}
	if res == nil {
		return enginequery.Result{}, invalidEngineResponse("missing document response")
	}
	result, err := b.decodeResult(res.Hits, res.Fields, res.Took, enginequery.Result{Cost: res.GetIndexBytesRead()}, fields, requested, false, query != nil)
	if err != nil {
		return enginequery.Result{}, err
	}
	for _, hit := range result.Hits {
		// Missing authorization data must not turn a document into a root document.
		if _, ok := hit.Fields[resource.SEARCH_FIELD_FOLDER].(string); !ok {
			return enginequery.Result{}, invalidEngineResponse("expected an explicit folder string in document read")
		}
	}
	return result, nil
}

func (b *QueryBackend) containsKey(key *resourcepb.ResourceKey) bool {
	if key.GetNamespace() == "" || key.Namespace != b.Scope.GetNamespace() || key.Group == "" || key.Resource == "" || key.Name == "" {
		return false
	}
	for _, index := range b.Scope.GetIndexes() {
		if index.GetGroup() == key.Group && index.GetResource() == key.Resource ||
			index.GetGroup() == resource.GlobalSearchGroup && index.GetResource() == resource.GlobalSearchResource {
			return true
		}
	}
	return false
}

func (b *QueryBackend) decodeResult(hits []*enginepb.Hit, columns []*resourcepb.ResourceSearchField, took *durationpb.Duration, result enginequery.Result, fields []*enginepb.RequestedField, requested map[string]bool, requireCursor, requireSortKey bool) (enginequery.Result, error) {
	if took != nil {
		if took.CheckValid() != nil || took.AsDuration() < 0 {
			return enginequery.Result{}, invalidEngineResponse("invalid backend duration")
		}
		result.Took = took.AsDuration()
	}
	allowed := make(map[string]bool, len(fields))
	for _, field := range fields {
		allowed[field.ResponseKey] = true
	}
	for _, col := range columns {
		switch col.GetType() {
		case resourcepb.ResourceSearchField_STRING, resourcepb.ResourceSearchField_INT64, resourcepb.ResourceSearchField_DATE,
			resourcepb.ResourceSearchField_DOUBLE, resourcepb.ResourceSearchField_BOOLEAN:
		default:
			return enginequery.Result{}, invalidEngineResponse("invalid field type for %q", col.GetName())
		}
		if !allowed[col.Name] {
			return enginequery.Result{}, invalidEngineResponse("unexpected or duplicate field %q", col.Name)
		}
		delete(allowed, col.Name)
	}
	seen := make(map[string]bool, len(hits))
	for _, hit := range hits {
		if !b.containsKey(hit.GetKey()) {
			return enginequery.Result{}, invalidEngineResponse("invalid or out-of-Scope document key")
		}
		id := resource.SearchID(hit.Key)
		if seen[id] || requested != nil && !requested[id] {
			return enginequery.Result{}, invalidEngineResponse("unexpected or duplicate document key")
		}
		seen[id] = true
		cursor, key := hit.GetCursor().GetParts(), hit.GetStableSortKey().GetValue()
		if requireCursor && len(cursor) == 0 || requireSortKey && len(key) == 0 {
			return enginequery.Result{}, invalidEngineResponse("missing candidate cursor or stable sort key")
		}
		data, err := enginequery.DecodeValues(columns, hit.Values)
		if err != nil {
			return enginequery.Result{}, invalidEngineResponse("%v", err)
		}
		if hit.ResourceVersion != nil {
			if data == nil {
				data = make(map[string]any, 1)
			}
			data[resource.SEARCH_FIELD_RV_STRING] = strconv.FormatInt(*hit.ResourceVersion, 10)
		}
		decoded := &enginequery.Hit{ID: id, Fields: data, Score: hit.GetScore(), Cursor: slices.Clone(cursor)}
		if len(key) != 0 {
			decoded.StableSortKey = enginequery.StableSortKey{string(key)}
		}
		result.Hits = append(result.Hits, decoded)
	}
	return result, nil
}

func invalidEngineResponse(format string, args ...any) error {
	return status.Error(codes.Internal, "invalid search engine response: "+fmt.Sprintf(format, args...))
}
