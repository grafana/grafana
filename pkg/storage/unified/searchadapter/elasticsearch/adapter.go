package elasticsearch

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/durationpb"
	"k8s.io/apimachinery/pkg/selection"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/enginepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/enginequery"
)

// One configured collection. This prototype has no rebuild or cleanup scheduler.
type elasticsearchAdapter struct {
	enginepb.UnimplementedSearchEngineServer
	scope        *enginepb.IndexScope
	builder      *elasticsearchQueryBuilder
	backend      *NativeBackend
	indexOptions ElasticsearchAdapterOptions
}

// ElasticsearchAdapterOptions selects one index and its logical schema.
type ElasticsearchAdapterOptions struct {
	Endpoint         string
	Index            string
	Key              resource.NamespacedResource
	Generation       string
	SchemaRevision   string
	Fields           resource.SearchFieldsProvider
	SelectableFields []string
}

var elasticsearchIndexName = regexp.MustCompile(`^[a-z0-9][a-z0-9._-]*$`)

func newElasticsearchAdapter(opts ElasticsearchAdapterOptions) (*elasticsearchAdapter, error) {
	endpoint, err := url.Parse(opts.Endpoint)
	if err != nil || endpoint.Hostname() == "" || (endpoint.Scheme != "http" && endpoint.Scheme != "https") || endpoint.User != nil || endpoint.RawQuery != "" || endpoint.Fragment != "" || (endpoint.Path != "" && endpoint.Path != "/") {
		return nil, fmt.Errorf("expected an Elasticsearch HTTP(S) origin without user info")
	}
	if !elasticsearchIndexName.MatchString(opts.Index) {
		return nil, fmt.Errorf("expected one Elasticsearch index name")
	}
	if opts.Key.Namespace == "" || opts.Key.Group == "" || opts.Key.Resource == "" || opts.Key.IsGlobal() || opts.Generation == "" || opts.SchemaRevision == "" {
		return nil, fmt.Errorf("expected one namespaced resource kind, generation and schema revision")
	}
	builder, err := newElasticsearchQueryBuilder(opts.Fields, opts.Key, opts.SelectableFields)
	if err != nil {
		return nil, err
	}
	return &elasticsearchAdapter{
		scope: &enginepb.IndexScope{Namespace: opts.Key.Namespace, Indexes: []*enginepb.IndexReference{{
			Group: opts.Key.Group, Resource: opts.Key.Resource, Generation: opts.Generation, SchemaRevision: opts.SchemaRevision,
		}}},
		builder:      builder,
		indexOptions: opts,
		backend: &NativeBackend{
			Client: &http.Client{Timeout: 30 * time.Second, Transport: http.DefaultTransport.(*http.Transport).Clone()}, Endpoint: strings.TrimRight(opts.Endpoint, "/"), Index: opts.Index,
			Order: []Sort{{Field: elasticsearchDocumentIDField}},
		},
	}, nil
}

// ServeElasticsearchAdapter requires explicit opt-in to expose pre-authorization
// candidates off loopback on an isolated development network.
func ServeElasticsearchAdapter(ctx context.Context, listener *net.TCPListener, opts ElasticsearchAdapterOptions, allowInsecure bool) error {
	if !allowInsecure && !listener.Addr().(*net.TCPAddr).IP.IsLoopback() {
		return fmt.Errorf("non-loopback adapter listeners require explicit plaintext opt-in")
	}
	adapter, err := newElasticsearchAdapter(opts)
	if err != nil {
		return err
	}
	defer adapter.backend.Client.CloseIdleConnections()
	server := grpc.NewServer()
	enginepb.RegisterSearchEngineServer(server, adapter)
	stop := context.AfterFunc(ctx, server.Stop)
	defer stop()
	err = server.Serve(listener)
	if errors.Is(err, grpc.ErrServerStopped) && ctx.Err() != nil {
		return nil
	}
	return err
}

func elasticsearchRPCError(err error) error {
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return status.FromContextError(err).Err()
	}
	var httpErr *HTTPError
	if errors.As(err, &httpErr) {
		switch httpErr.Status {
		case http.StatusNotFound:
			return status.Error(codes.FailedPrecondition, "configured Elasticsearch index not found")
		case http.StatusBadRequest:
			return status.Error(codes.InvalidArgument, "Elasticsearch rejected the query")
		}
	}
	return status.Error(codes.Unavailable, "Elasticsearch did not return complete results")
}

func (s *elasticsearchAdapter) checkScope(scope *enginepb.IndexScope) error {
	if scope.GetNamespace() != s.scope.Namespace {
		return status.Error(codes.PermissionDenied, "namespace outside configured index scope")
	}
	if !proto.Equal(s.scope, scope) {
		return status.Error(codes.FailedPrecondition, "unsupported index scope or required feature")
	}
	return nil
}

func (s *elasticsearchAdapter) SearchCandidates(ctx context.Context, req *enginepb.SearchCandidatesRequest) (*enginepb.SearchCandidatesResponse, error) {
	if err := s.checkScope(req.IndexScope); err != nil {
		return nil, err
	}
	if req.WindowSize == 0 || req.WindowSize > 10000 {
		return nil, status.Error(codes.InvalidArgument, "candidate window must contain between 1 and 10000 hits")
	}
	binding, err := s.cursorBinding(req.Query)
	if err != nil {
		return nil, err
	}
	if after, ok := req.StartPosition.(*enginepb.SearchCandidatesRequest_SearchAfter); ok {
		parts := after.SearchAfter.GetParts()
		if len(parts) < 2 || parts[0] != binding {
			return nil, status.Error(codes.InvalidArgument, "cursor does not match the query or index")
		}
		req = proto.CloneOf(req)
		req.StartPosition = &enginepb.SearchCandidatesRequest_SearchAfter{SearchAfter: &enginepb.Cursor{Parts: parts[1:]}}
	}
	backend, prepared, err := s.prepare(req.Query, req)
	if err != nil {
		return nil, err
	}
	fields, err := s.resolveFields(req.Fields)
	if err != nil {
		return nil, err
	}
	result, err := backend.Search(ctx, enginequery.Request{Size: int(req.WindowSize), Fields: fields.names, SearchAfter: prepared.cursor, Reverse: prepared.reverse})
	if err != nil {
		return nil, elasticsearchRPCError(err)
	}
	hits, err := s.encodeHits(fields, result.Hits, binding, true)
	if err != nil {
		return nil, err
	}
	return &enginepb.SearchCandidatesResponse{Hits: hits, TotalMatches: result.Total, MaxScore: new(result.MaxScore), Took: durationpb.New(result.Took), Fields: fields.columns}, nil
}

func (s *elasticsearchAdapter) ReadDocuments(ctx context.Context, req *enginepb.ReadDocumentsRequest) (*enginepb.ReadDocumentsResponse, error) {
	if err := s.checkScope(req.IndexScope); err != nil {
		return nil, err
	}
	if len(req.Keys) > 10000 {
		return nil, status.Error(codes.InvalidArgument, "too many document keys")
	}
	ids := make([]string, 0, len(req.Keys))
	for _, key := range req.Keys {
		index := s.scope.Indexes[0]
		if key.GetNamespace() != s.scope.Namespace || key.GetGroup() != index.Group || key.GetResource() != index.Resource || key.GetName() == "" || strings.Contains(key.GetName(), "/") {
			return nil, status.Error(codes.InvalidArgument, "document key outside configured index scope")
		}
		ids = append(ids, resource.SearchID(key))
	}
	fields, err := s.resolveFields(req.Fields)
	if err != nil {
		return nil, err
	}
	backend := *s.backend
	var result enginequery.Result
	if req.Query != nil {
		backend, _, err = s.prepare(req.Query, nil)
		if err != nil {
			return nil, err
		}
		result, err = backend.Lookup(ctx, enginequery.LookupRequest{IDs: ids, Fields: append(fields.names, resource.SEARCH_FIELD_RV_STRING)})
	} else {
		result, err = backend.SearchNative(ctx, elasticsearchObject{"ids": elasticsearchObject{"values": ids}}, len(ids), fields.names, nil, false)
	}
	if err != nil {
		return nil, elasticsearchRPCError(err)
	}
	hits, err := s.encodeHits(fields, result.Hits, "", req.Query != nil)
	if err != nil {
		return nil, err
	}
	return &enginepb.ReadDocumentsResponse{Hits: hits, Took: durationpb.New(result.Took), Fields: fields.columns}, nil
}

func (s *elasticsearchAdapter) cursorBinding(query *enginepb.QuerySpec) (string, error) {
	opts := proto.MarshalOptions{Deterministic: true}
	scopeBytes, err := opts.Marshal(s.scope)
	if err != nil {
		return "", status.Error(codes.Internal, "could not encode index scope")
	}
	queryBytes, err := opts.Marshal(query)
	if err != nil {
		return "", status.Error(codes.InvalidArgument, "could not encode query")
	}
	return fmt.Sprintf("es1:%x:%x", sha256.Sum256(scopeBytes), sha256.Sum256(queryBytes)), nil
}

func (s *elasticsearchAdapter) prepare(query *enginepb.QuerySpec, window *enginepb.SearchCandidatesRequest) (NativeBackend, elasticsearchQuery, error) {
	state := query.GetDocumentScope().GetState()
	if state != enginepb.DocumentState_DOCUMENT_STATE_LIVE && state != enginepb.DocumentState_DOCUMENT_STATE_TRASH {
		return NativeBackend{}, elasticsearchQuery{}, status.Error(codes.InvalidArgument, "invalid document state")
	}
	req := &resourcepb.ResourceSearchRequest{
		Query:        query.Text,
		IsDeleted:    state == enginepb.DocumentState_DOCUMENT_STATE_TRASH,
		Options:      &resourcepb.ListOptions{},
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
	}
	for _, field := range query.QueryFields {
		if field.GetName() == "" {
			return NativeBackend{}, elasticsearchQuery{}, status.Error(codes.InvalidArgument, "missing query field name")
		}
		req.QueryFields = append(req.QueryFields, &resourcepb.ResourceSearchRequest_QueryField{Name: field.Name, Boost: field.Boost})
	}
	for _, requirement := range query.Requirements {
		op, ok := selectorNames[requirement.GetOperator()]
		if !ok {
			return NativeBackend{}, elasticsearchQuery{}, status.Error(codes.InvalidArgument, "unknown selector operator")
		}
		if label, ok := strings.CutPrefix(requirement.Key, labelFieldPrefix); ok {
			req.Options.Labels = append(req.Options.Labels, &resourcepb.Requirement{Key: label, Operator: string(op), Values: requirement.Values})
		} else {
			req.Options.Fields = append(req.Options.Fields, &resourcepb.Requirement{Key: requirement.Key, Operator: string(op), Values: requirement.Values})
		}
	}
	for _, sort := range query.Sort {
		switch sort.GetDirection() {
		case enginepb.SortDirection_SORT_DIRECTION_ASCENDING, enginepb.SortDirection_SORT_DIRECTION_DESCENDING:
		default:
			return NativeBackend{}, elasticsearchQuery{}, status.Error(codes.InvalidArgument, "invalid sort direction")
		}
		req.SortBy = append(req.SortBy, &resourcepb.ResourceSearchRequest_Sort{Field: sort.Field, Desc: sort.Direction == enginepb.SortDirection_SORT_DIRECTION_DESCENDING})
	}
	if window.GetReverse() {
		req.SearchBefore = window.GetSearchAfter().GetParts()
	} else {
		req.SearchAfter = window.GetSearchAfter().GetParts()
	}
	if bound, ok := window.GetStartPosition().(*enginepb.SearchCandidatesRequest_DeletedResourceVersionLowerBound); ok {
		if !req.IsDeleted || window.Reverse || bound.DeletedResourceVersionLowerBound < 0 || len(req.SortBy) != 1 || req.SortBy[0].Field != resource.SEARCH_FIELD_DELETED_RV || req.SortBy[0].Desc {
			return NativeBackend{}, elasticsearchQuery{}, status.Error(codes.InvalidArgument, "invalid deleted resource-version starting position")
		}
		req.SearchAfter = []string{strconv.FormatInt(bound.DeletedResourceVersionLowerBound, 10), ""}
	}
	prepared, errRes := s.builder.prepare(req, query.GetDocumentScope().GetDeletionTimeCutoffUnixMs())
	if errRes != nil {
		return NativeBackend{}, elasticsearchQuery{}, resource.GRPCStatusError(errRes)
	}
	prepared.reverse = window.GetReverse()
	backend := *s.backend
	backend.Query, backend.Order = prepared.query, prepared.order
	return backend, prepared, nil
}

var selectorNames = map[enginepb.SelectorOperator]selection.Operator{
	enginepb.SelectorOperator_SELECTOR_OPERATOR_EQUALS:                selection.Equals,
	enginepb.SelectorOperator_SELECTOR_OPERATOR_EXACT_EQUALS:          selection.DoubleEquals,
	enginepb.SelectorOperator_SELECTOR_OPERATOR_IN:                    selection.In,
	enginepb.SelectorOperator_SELECTOR_OPERATOR_NOT_IN:                selection.NotIn,
	enginepb.SelectorOperator_SELECTOR_OPERATOR_GREATER_THAN:          selection.GreaterThan,
	enginepb.SelectorOperator_SELECTOR_OPERATOR_GREATER_THAN_OR_EQUAL: resource.OperatorGreaterThanOrEqual,
	enginepb.SelectorOperator_SELECTOR_OPERATOR_LESS_THAN:             selection.LessThan,
	enginepb.SelectorOperator_SELECTOR_OPERATOR_LESS_THAN_OR_EQUAL:    resource.OperatorLessThanOrEqual,
	enginepb.SelectorOperator_SELECTOR_OPERATOR_REGEX:                 resource.OperatorRegex,
	enginepb.SelectorOperator_SELECTOR_OPERATOR_NOT_REGEX:             resource.OperatorNotRegex,
}

type elasticsearchRequestedFields struct {
	names       []string
	columns     []*resourcepb.ResourceSearchField
	definitions []resource.SearchFieldDefinition
}

func (s *elasticsearchAdapter) resolveFields(fields []*enginepb.RequestedField) (elasticsearchRequestedFields, error) {
	var result elasticsearchRequestedFields
	seen := make(map[string]bool, len(fields))
	for _, field := range fields {
		if field.GetResponseKey() == "" || seen[field.ResponseKey] {
			return elasticsearchRequestedFields{}, status.Error(codes.InvalidArgument, "missing or duplicate field response key")
		}
		seen[field.ResponseKey] = true
		def, ok := s.builder.schema.Result(field.Name)
		if strings.HasPrefix(field.Name, labelFieldPrefix) {
			ok = true
			def = resource.SearchFieldDefinition{Name: field.Name, Type: resource.SearchFieldTypeString, Capabilities: []resource.SearchCapability{resource.SearchCapabilityRetrieve}}
		}
		if !ok {
			return elasticsearchRequestedFields{}, status.Errorf(codes.InvalidArgument, "unknown requested field %q", field.Name)
		}
		name := s.builder.schema.Resolve(field.Name)
		if field.FacetValues {
			name = s.builder.schema.Facet(field.Name)
			if name == "" {
				return elasticsearchRequestedFields{}, status.Errorf(codes.InvalidArgument, "field %q cannot be faceted", field.Name)
			}
		} else if !def.HasCapability(resource.SearchCapabilityRetrieve) {
			return elasticsearchRequestedFields{}, status.Errorf(codes.InvalidArgument, "field %q is not retrievable", field.Name)
		}
		typ, err := enginequery.FieldValueType(def.Type)
		if err != nil {
			return elasticsearchRequestedFields{}, err
		}
		result.names = append(result.names, name)
		result.columns = append(result.columns, &resourcepb.ResourceSearchField{Name: field.ResponseKey, Type: typ, IsArray: def.Array})
		result.definitions = append(result.definitions, def)
	}
	return result, nil
}

func (s *elasticsearchAdapter) encodeHits(f elasticsearchRequestedFields, hits []*enginequery.Hit, binding string, sortKey bool) ([]*enginepb.Hit, error) {
	index := s.scope.Indexes[0]
	var result []*enginepb.Hit
	for _, hit := range hits {
		key := &resourcepb.ResourceKey{}
		if err := resource.ReadSearchID(key, hit.ID); err != nil || key.Namespace != s.scope.Namespace || key.Group != index.Group || key.Resource != index.Resource || key.Name == "" {
			return nil, status.Error(codes.FailedPrecondition, "Elasticsearch index contains a document outside its configured scope")
		}
		wire := &enginepb.Hit{Key: key}
		if sortKey {
			stable, err := json.Marshal(hit.StableSortKey)
			if err != nil {
				return nil, err
			}
			wire.StableSortKey = &enginepb.StableSortKey{Value: stable}
		}
		if binding != "" {
			wire.Cursor = &enginepb.Cursor{Parts: append([]string{binding}, hit.Cursor...)}
			wire.Score = new(hit.Score)
		}
		if value, ok := hit.Fields[resource.SEARCH_FIELD_RV_STRING].(string); ok {
			rv, err := strconv.ParseInt(value, 10, 64)
			if err != nil {
				return nil, err
			}
			wire.ResourceVersion = new(rv)
		}
		for i, name := range f.names {
			if value, ok := hit.Fields[name]; ok && value != nil {
				def := f.definitions[i]
				if def.Type == resource.SearchFieldTypeInt64 || def.Type == resource.SearchFieldTypeDate || def.Type == resource.SearchFieldTypeDouble {
					values := enginequery.FlattenSearchResultValue(value)
					for j, element := range values {
						number, ok := element.(json.Number)
						if !ok {
							return nil, status.Errorf(codes.FailedPrecondition, "field %q does not contain a number", name)
						}
						var err error
						if def.Type == resource.SearchFieldTypeDouble {
							values[j], err = number.Float64()
						} else {
							values[j], err = number.Int64()
						}
						if err != nil {
							return nil, status.Errorf(codes.FailedPrecondition, "invalid numeric value for field %q", name)
						}
					}
					value = values
				}
				v, err := enginequery.NewSearchResultValue(uint32(i), def, value)
				if err != nil {
					return nil, fmt.Errorf("field %s: %w", name, err)
				}
				wire.Values = append(wire.Values, v)
			}
		}
		result = append(result, wire)
	}
	return result, nil
}
