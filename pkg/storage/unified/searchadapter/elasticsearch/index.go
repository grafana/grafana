package elasticsearch

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"slices"
	"strconv"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
	"github.com/grafana/grafana/pkg/storage/unified/search/enginepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/enginequery"
)

func (s *elasticsearchAdapter) indexMetadata() map[string]string {
	ref := s.scope.Indexes[0]
	return map[string]string{
		"owner": "grafana-search-adapter-v2", "namespace": s.scope.Namespace,
		"group": ref.Group, "resource": ref.Resource, "generation": ref.Generation, "schema_revision": ref.SchemaRevision,
	}
}

func (s *elasticsearchAdapter) indexExists(ctx context.Context) (bool, error) {
	var indexes map[string]struct {
		Mappings struct {
			Meta map[string]string `json:"_meta"`
		} `json:"mappings"`
	}
	err := s.backend.JSON(ctx, http.MethodGet, "/"+s.backend.Index+"/_mapping", nil, &indexes)
	if err != nil {
		var httpErr *HTTPError
		if errors.As(err, &httpErr) && httpErr.Status == http.StatusNotFound {
			return false, nil
		}
		return false, elasticsearchRPCError(err)
	}
	concrete, ok := indexes[s.backend.Index]
	if len(indexes) != 1 || !ok {
		return false, status.Error(codes.FailedPrecondition, "configured name must identify one concrete index, not an alias")
	}
	for key, want := range s.indexMetadata() {
		if concrete.Mappings.Meta[key] != want {
			return false, status.Error(codes.FailedPrecondition, "index was not created for this Grafana scope and schema")
		}
	}
	return true, nil
}

func (s *elasticsearchAdapter) requireIndex(ctx context.Context) error {
	exists, err := s.indexExists(ctx)
	if err != nil {
		return err
	}
	if !exists {
		return status.Error(codes.FailedPrecondition, "create the configured Elasticsearch index first")
	}
	return nil
}

func (s *elasticsearchAdapter) EnsureIndex(ctx context.Context, req *enginepb.EnsureIndexRequest) (*emptypb.Empty, error) {
	if err := s.checkScope(req.GetIndexScope()); err != nil {
		return nil, err
	}
	exists, err := s.indexExists(ctx)
	if err != nil {
		return nil, err
	}
	if exists && req.GetRequireNew() {
		return nil, status.Error(codes.AlreadyExists, "initial build requires a fresh index")
	}
	if !exists {
		mapping := indexMapping(s.indexOptions.Fields, s.indexOptions.Key)
		mapping["mappings"].(elasticsearchObject)["_meta"] = s.indexMetadata()
		if err := s.backend.JSON(ctx, http.MethodPut, "/"+s.backend.Index, mapping, nil); err != nil {
			if req.GetRequireNew() {
				return nil, elasticsearchRPCError(err)
			}
			// A concurrent ensure can win. Accept it only if it created our index.
			if exists, verifyErr := s.indexExists(ctx); verifyErr != nil || !exists {
				return nil, elasticsearchRPCError(err)
			}
		}
	}
	return &emptypb.Empty{}, nil
}

func (s *elasticsearchAdapter) WriteDocuments(ctx context.Context, req *enginepb.WriteDocumentsRequest) (*emptypb.Empty, error) {
	if err := s.checkScope(req.GetIndexScope()); err != nil {
		return nil, err
	}
	if len(req.Writes) > 1000 {
		return nil, status.Error(codes.InvalidArgument, "at most 1000 writes per batch")
	}
	body, deleted, err := s.encodeWrites(req)
	if err != nil {
		return nil, err
	}
	if len(deleted) == 0 {
		return &emptypb.Empty{}, nil
	}
	if err := s.requireIndex(ctx); err != nil {
		return nil, err
	}
	var result struct {
		Items []map[string]struct {
			Status int    `json:"status"`
			Result string `json:"result"`
		} `json:"items"`
	}
	if err := s.backend.Request(ctx, http.MethodPost, "/"+s.backend.Index+"/_bulk?refresh=wait_for", "application/x-ndjson", body, &result); err != nil {
		return nil, elasticsearchRPCError(err)
	}
	if len(result.Items) != len(deleted) {
		return nil, status.Error(codes.Unavailable, "incomplete Elasticsearch write response; some items may have applied")
	}
	for i, item := range result.Items {
		op := "index"
		if deleted[i] {
			op = "delete"
		}
		res, ok := item[op]
		success := res.Status >= 200 && res.Status < 300
		missingDelete := deleted[i] && res.Status == http.StatusNotFound && res.Result == "not_found"
		if !ok || !success && !missingDelete {
			return nil, status.Errorf(codes.Aborted, "Elasticsearch rejected write %d (HTTP %d); some items may have applied", i, res.Status)
		}
	}
	return &emptypb.Empty{}, nil
}

func (s *elasticsearchAdapter) encodeWrites(req *enginepb.WriteDocumentsRequest) ([]byte, []bool, error) {
	columns := req.Fields
	seen := make(map[string]bool, len(columns))
	for _, col := range columns {
		name := col.GetName()
		def, _ := s.builder.schema.Result(resource.SEARCH_FIELD_PREFIX + name)
		typ, err := enginequery.FieldValueType(def.Type)
		if err != nil || col.Type != typ || col.IsArray != def.Array || seen[name] {
			return nil, nil, status.Errorf(codes.InvalidArgument, "invalid or duplicate app field %q", name)
		}
		seen[name] = true
	}
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	deleted := make([]bool, 0, len(req.Writes))
	ids := make(map[string]bool, len(req.Writes))
	for _, item := range req.Writes {
		key := item.GetKey()
		i := s.scope.Indexes[0]
		if key.GetNamespace() != s.scope.Namespace || key.GetGroup() != i.Group || key.GetResource() != i.Resource || key.GetName() == "" || strings.Contains(key.GetName(), "/") {
			return nil, nil, status.Error(codes.InvalidArgument, "write key outside configured index scope")
		}
		id := resource.SearchID(key)
		if ids[id] {
			return nil, nil, status.Error(codes.InvalidArgument, "duplicate key in batch")
		}
		ids[id] = true
		isDelete := false
		switch action := item.GetAction().(type) {
		case *enginepb.DocumentWrite_Upsert:
			if action.Upsert == nil || action.Upsert.ResourceVersion < 0 {
				return nil, nil, status.Error(codes.InvalidArgument, "invalid document")
			}
			source, err := s.indexDocument(id, key.Name, action.Upsert, columns)
			if err != nil {
				return nil, nil, err
			}
			if err := enc.Encode(elasticsearchObject{"index": elasticsearchObject{"_id": id}}); err != nil {
				return nil, nil, status.Error(codes.Internal, "could not encode upsert")
			}
			if err := enc.Encode(source); err != nil {
				return nil, nil, status.Error(codes.InvalidArgument, "could not encode document values")
			}
		case *enginepb.DocumentWrite_Delete:
			if err := enc.Encode(elasticsearchObject{"delete": elasticsearchObject{"_id": id}}); err != nil {
				return nil, nil, status.Error(codes.Internal, "could not encode delete")
			}
			isDelete = true
		default:
			return nil, nil, status.Error(codes.InvalidArgument, "missing write action")
		}
		deleted = append(deleted, isDelete)
	}
	return buf.Bytes(), deleted, nil
}

func (s *elasticsearchAdapter) indexDocument(id, name string, doc *enginepb.SearchDocument, columns []*resourcepb.ResourceSearchField) (elasticsearchObject, error) {
	app, err := enginequery.DecodeValues(columns, doc.Values)
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid app field values")
	}
	if app == nil {
		app = make(map[string]any)
	}
	source := elasticsearchObject{
		elasticsearchDocumentIDField: id, "name": name, "title": doc.Title, "title_phrase": strings.ToLower(doc.Title), "title_ngram": strings.ToLower(doc.Title),
		"description": doc.Description, "folder": doc.Folder, "tags": doc.Tags, "labels": doc.Labels,
		"created": doc.Created, "createdBy": doc.CreatedBy, "updated": doc.Updated, "updatedBy": doc.UpdatedBy,
		"ownerReferences": doc.OwnerReferences, resource.SEARCH_FIELD_RV_STRING: strconv.FormatInt(doc.ResourceVersion, 10),
	}
	if doc.ManagerKind != "" {
		source[resource.SEARCH_FIELD_MANAGER_KIND] = doc.ManagerKind
		source[resource.SEARCH_FIELD_MANAGER_ID] = doc.ManagerId
		source[resource.SEARCH_FIELD_MANAGER_ALLOW_EDITS] = doc.ManagerAllowsEdits
		source[resource.SEARCH_FIELD_MANAGED_BY] = doc.ManagerKind + ":" + doc.ManagerId
	}
	source[resource.SEARCH_FIELD_SOURCE_PATH] = doc.SourcePath
	source[resource.SEARCH_FIELD_SOURCE_CHECKSUM] = doc.SourceChecksum
	source[resource.SEARCH_FIELD_SOURCE_TIME] = doc.SourceTimestampMillis
	references := map[string][]string{}
	for _, ref := range doc.References {
		if ref.GetKind() != "" {
			name := referenceFieldPrefix + ref.Kind
			references[name] = append(references[name], ref.Name)
		}
	}
	for name, values := range references {
		source[name] = values
	}
	for name, value := range doc.SelectableFields {
		if !slices.Contains(s.indexOptions.SelectableFields, name) {
			return nil, status.Errorf(codes.InvalidArgument, "undeclared selectable field %q", name)
		}
		source[resource.SEARCH_SELECTABLE_FIELDS_PREFIX+name] = value
	}
	for _, col := range columns {
		value, present := app[col.Name]
		if !present {
			continue
		}
		def, _ := s.builder.schema.Result(resource.SEARCH_FIELD_PREFIX + col.Name)
		name := col.Name
		source[resource.SEARCH_FIELD_PREFIX+name] = value
		sortValue := value
		if kw, ok := search.KeywordVariant(def); ok && kw != name {
			lower, _ := search.LowerStrings(value)
			source[resource.SEARCH_FIELD_PREFIX+kw], name, sortValue = lower, kw, lower
		}
		if ngram, ok := search.NgramVariant(def); ok {
			lower, _ := search.LowerStrings(value)
			source[resource.SEARCH_FIELD_PREFIX+ngram] = lower
		}
		if def.Array && def.HasCapability(resource.SearchCapabilitySort) {
			if values := enginequery.FlattenSearchResultValue(sortValue); len(values) > 0 {
				source[elasticsearchArraySortPrefix+resource.SEARCH_FIELD_PREFIX+name] = values[0]
			}
		}
	}
	return source, nil
}
