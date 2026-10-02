package resource

import (
	"context"
	"errors"
	"fmt"
	"iter"
	"net/http"
	"slices"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"k8s.io/apimachinery/pkg/selection"
)

// errSearchCannotAnswerList asks the caller for the store scan instead. It never
// reaches a client.
var errSearchCannotAnswerList = errors.New("search cannot answer this list")

func (s *server) listWithSelectors(ctx context.Context, req *resourcepb.ListRequest) (*resourcepb.ListResponse, error) {
	ctx, span := tracer.Start(ctx, "resource.server.ListWithFieldSelectors")
	defer span.End()

	if req.Options.Key.Namespace == "" {
		return &resourcepb.ListResponse{
			Error: NewBadRequestError("namespace must be specified for list with filter"),
		}, nil
	}

	for _, v := range req.Options.Fields {
		v.Key = SEARCH_SELECTABLE_FIELDS_PREFIX + v.Key
	}

	srq := &resourcepb.ResourceSearchRequest{
		Options:      req.Options,
		Limit:        req.Limit,
		Fields:       []string{SEARCH_FIELD_RV},
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
	}

	page, errRes, err := s.executeSearchListPage(ctx, req, srq, span)
	if errRes != nil {
		return &resourcepb.ListResponse{Error: errRes}, nil
	}
	searchErr := err
	if searchErr == nil {
		searchErr = ErrorFromResponse(page.response.GetError(), nil)
	}
	if searchErr != nil {
		result := AsErrorResult(searchErr)
		// A later page carries a position in search results that the store cannot resume from.
		if IsSelectableFieldNotIndexed(result) && req.NextPageToken == "" {
			return nil, fmt.Errorf("%w: %w", errSearchCannotAnswerList, searchErr)
		}
		if err != nil {
			return nil, err
		}
		s.log.Error("Search failed for List with selectors", "group", req.Options.Key.Group, "resource", req.Options.Key.Resource, "error", searchErr)
		return &resourcepb.ListResponse{Error: result}, nil
	}

	rsp := &resourcepb.ListResponse{
		ResourceVersion: page.resourceVersion,
	}

	s.log.Info("Search used for List with selectors", "group", req.Options.Key.Group, "resource", req.Options.Key.Resource, "search_hits", page.response.GetTotalHits(), "with_pagination", req.NextPageToken != "", "search_after", srq.SearchAfter, "selectable_fields", req.Options.Fields, "labels", req.Options.Labels)

	user, ok := claims.AuthInfoFrom(ctx)
	if !ok || user == nil {
		return &resourcepb.ListResponse{Error: &resourcepb.ErrorResult{
			Code:    http.StatusUnauthorized,
			Message: "no user found in context",
		}}, nil
	}

	if result := s.consumeSearchRows(ctx, user, req, page.rows, s.readSearchRows(ctx, page.rows), page.resourceVersion, rsp); result != nil {
		return result, nil
	}

	if errRes := setSearchListContinueToken(req, page.response, page.rows, page.resourceVersion, rsp); errRes != nil {
		return &resourcepb.ListResponse{Error: errRes}, nil
	}

	return rsp, nil
}

type searchListPage struct {
	response        *resourcepb.ResourceSearchResponse
	rows            []listSearchRow
	resourceVersion int64
}

func (s *server) executeSearchListPage(
	ctx context.Context,
	req *resourcepb.ListRequest,
	searchReq *resourcepb.ResourceSearchRequest,
	span trace.Span,
) (*searchListPage, *resourcepb.ErrorResult, error) {
	listRV, errRes := applyContinueToken(searchReq, req.NextPageToken, span)
	if errRes != nil {
		return nil, errRes, nil
	}

	var searchResp *resourcepb.ResourceSearchResponse
	var err error
	if s.search != nil {
		searchResp, err = s.search.Search(ctx, searchReq)
	} else {
		searchResp, err = s.searchClient.Search(ctx, searchReq)
	}
	if err != nil {
		return nil, nil, err
	}

	page := &searchListPage{response: searchResp, resourceVersion: listRV}
	if searchResp.GetError() != nil {
		return page, nil, nil
	}

	page.rows, err = decodeListSearchRows(searchResp)
	if err != nil {
		s.log.Error("Invalid search response for List", "group", req.Options.Key.Group, "resource", req.Options.Key.Resource, "error", err)
		return nil, AsErrorResult(err), nil
	}
	span.AddEvent("search finished", trace.WithAttributes(attribute.Int64("total_hits", searchResp.GetTotalHits())))
	// If it's the first page, set the listRV to the search response RV.
	if page.resourceVersion <= 0 {
		page.resourceVersion = searchResp.GetResourceVersion()
	}
	return page, nil, nil
}

func setSearchListContinueToken(
	req *resourcepb.ListRequest,
	searchResp *resourcepb.ResourceSearchResponse,
	rows []listSearchRow,
	listRV int64,
	rsp *resourcepb.ListResponse,
) *resourcepb.ErrorResult {
	if !searchListNeedsContinue(req.Limit, len(rows), searchResp.GetTotalHitsExact()) {
		return nil
	}
	sortFields := rows[len(rows)-1].sortFields
	if len(sortFields) == 0 {
		return nil
	}
	token, err := NewSearchContinueToken(sortFields, listRV)
	if err != nil {
		return NewBadRequestError("invalid continue token")
	}
	rsp.NextPageToken = token
	return nil
}

func searchListNeedsContinue(limit int64, rowCount int, totalHitsExact bool) bool {
	// Authorization can shrink a full page, and post-rank authorization can stop
	// before filling one. An inexact total cannot rule out more matching rows.
	return limit > 0 && rowCount > 0 && (rowCount >= int(limit) || !totalHitsExact)
}

// applyContinueToken resumes a paginated search from where the token left off,
// and returns the resource version the whole list is pinned to.
func applyContinueToken(srq *resourcepb.ResourceSearchRequest, nextPageToken string, span trace.Span) (int64, *resourcepb.ErrorResult) {
	if nextPageToken == "" {
		return 0, nil
	}
	span.AddEvent("continue token present")
	token, err := GetContinueToken(nextPageToken)
	if err != nil {
		return 0, NewBadRequestError("invalid continue token")
	}
	if tokenFromOtherListPath(token, true) {
		return 0, NewBadRequestError("continue token was not issued for a search-backed list")
	}
	srq.SearchAfter = token.SearchAfter
	srq.SearchBefore = token.SearchBefore
	return token.ResourceVersion, nil
}

type listSearchRow struct {
	key             *resourcepb.ResourceKey
	resourceVersion int64
	sortFields      []string
}

func decodeListSearchRows(response *resourcepb.ResourceSearchResponse) ([]listSearchRow, error) {
	if response == nil {
		return nil, fmt.Errorf("empty search response")
	}

	var rows []listSearchRow
	switch response.GetResultFormat() {
	case resourcepb.ResourceSearchRequest_UNSPECIFIED, resourcepb.ResourceSearchRequest_RESOURCE_TABLE:
		table := response.GetResults()
		if table == nil {
			return nil, nil
		}
		rows = make([]listSearchRow, 0, len(table.GetRows()))
		for i, row := range table.GetRows() {
			if row == nil || row.GetKey() == nil {
				return nil, fmt.Errorf("resource table row %d has no key", i)
			}
			rows = append(rows, listSearchRow{
				key:             row.GetKey(),
				resourceVersion: row.GetResourceVersion(),
				sortFields:      row.GetSortFields(),
			})
		}
	case resourcepb.ResourceSearchRequest_FIELD_VALUES:
		rows = make([]listSearchRow, 0, len(response.GetRows()))
		for i, row := range response.GetRows() {
			if row == nil || row.GetKey() == nil {
				return nil, fmt.Errorf("field-value row %d has no key", i)
			}
			rows = append(rows, listSearchRow{
				key:             row.GetKey(),
				resourceVersion: row.GetResourceVersion(),
				sortFields:      row.GetSortFields(),
			})
		}
	default:
		return nil, fmt.Errorf("unsupported search result format %d", response.GetResultFormat())
	}
	return rows, nil
}

func (s *server) consumeSearchRows(
	ctx context.Context,
	user claims.AuthInfo,
	req *resourcepb.ListRequest,
	rows []listSearchRow,
	values iter.Seq[*BackendReadResponse],
	listRV int64,
	rsp *resourcepb.ListResponse,
) *resourcepb.ListResponse {
	i := 0
	pageBytes := 0
	for val := range values {
		if i >= len(rows) {
			return &resourcepb.ListResponse{Error: &resourcepb.ErrorResult{
				Code:    http.StatusInternalServerError,
				Message: "batch resource reader returned too many responses",
			}}
		}
		row := rows[i]
		i++
		if val == nil {
			return &resourcepb.ListResponse{Error: &resourcepb.ErrorResult{
				Code:    http.StatusInternalServerError,
				Message: "empty resource read response",
			}}
		}
		// The storage reads do no authorization, so authorize each row before
		// surfacing a row-scoped error. An unauthorized row must not reveal details.
		// authorizeRead surfaces a stale NotFound (pruned/GC'd between search and
		// read) without authorizing, like server.read.
		if row.key != nil {
			if errRes := s.authorizeRead(ctx, user, row.key, val); errRes != nil {
				if errRes.Code == http.StatusForbidden {
					if val.Error != nil {
						s.log.Error("Failed to read unauthorized search result",
							"group", row.key.Group,
							"resource", row.key.Resource,
							"namespace", row.key.Namespace,
							"name", row.key.Name,
							"code", val.Error.Code,
							"error", val.Error.Message,
						)
						return &resourcepb.ListResponse{Error: &resourcepb.ErrorResult{
							Code:    http.StatusInternalServerError,
							Message: "failed to read resource",
						}}
					}
					continue
				}
				return &resourcepb.ListResponse{Error: errRes}
			}
		}
		if err := ErrorFromResponse(val.Error, nil); err != nil {
			resErr := AsErrorResult(err)
			if resErr.Code == http.StatusForbidden {
				continue
			}
			return &resourcepb.ListResponse{Error: resErr}
		}
		pageBytes += len(val.Value)
		rsp.Items = append(rsp.Items, &resourcepb.ResourceWrapper{
			Value:           val.Value,
			ResourceVersion: val.ResourceVersion,
		})
		if (req.Limit > 0 && len(rsp.Items) >= int(req.Limit)) || pageBytes >= s.maxPageSizeBytes {
			token, err := NewSearchContinueToken(row.sortFields, listRV)
			if err != nil {
				return &resourcepb.ListResponse{Error: NewBadRequestError("invalid continue token")}
			}
			rsp.NextPageToken = token
			return rsp
		}
	}
	if i != len(rows) {
		return &resourcepb.ListResponse{Error: &resourcepb.ErrorResult{
			Code:    http.StatusInternalServerError,
			Message: fmt.Sprintf("batch resource reader returned %d responses for %d requests", i, len(rows)),
		}}
	}
	return nil
}

const searchReadChunkSize = 10

func (s *server) readSearchRows(ctx context.Context, rows []listSearchRow) iter.Seq[*BackendReadResponse] {
	requests := make([]*resourcepb.ReadRequest, len(rows))
	for i, row := range rows {
		requests[i] = &resourcepb.ReadRequest{
			Key:             row.key,
			ResourceVersion: row.resourceVersion,
		}
	}
	return readResourcesInChunks(ctx, s.backend, requests, searchReadChunkSize)
}

// readResourcesInChunks reads the requests a chunk at a time, falling back to one
// read per object on a backend without batch reads. A backend that answers a
// chunk with the wrong number of responses is reported as an error, because the
// responses could no longer be matched to what was asked.
func readResourcesInChunks(ctx context.Context, backend StorageBackend, requests []*resourcepb.ReadRequest, chunkSize int) iter.Seq[*BackendReadResponse] {
	return func(yield func(*BackendReadResponse) bool) {
		batchSupported := true
		for chunk := range slices.Chunk(requests, chunkSize) {
			if !batchSupported {
				for _, request := range chunk {
					if !yield(backend.ReadResource(ctx, request)) {
						return
					}
				}
				continue
			}

			values, err := backend.BatchReadResource(ctx, chunk, false)
			if errors.Is(err, ErrBatchReadUnsupported) {
				batchSupported = false
				for _, request := range chunk {
					if !yield(backend.ReadResource(ctx, request)) {
						return
					}
				}
				continue
			}
			if err != nil {
				yield(&BackendReadResponse{Error: AsErrorResult(err)})
				return
			}

			count := 0
			for value := range values {
				if count >= len(chunk) {
					yield(&BackendReadResponse{Error: AsErrorResult(fmt.Errorf("batch resource reader returned too many responses"))})
					return
				}
				count++
				if !yield(value) {
					return
				}
			}
			if count != len(chunk) {
				yield(&BackendReadResponse{Error: AsErrorResult(fmt.Errorf("batch resource reader returned %d responses for %d requests", count, len(chunk)))})
				return
			}
		}
	}
}

// tokenFromOtherListPath reports whether a continue token was issued by the other
// list path. The two encode a position differently, sort values against the index
// and a name or a row offset against the store, so continuing with the wrong one
// would silently restart from the first result.
//
// Only the search path records sort values, and every search page has at least one
// sort field, so a token without them came from a store scan. Checking it this way
// round also covers the SQL backend, whose token records an offset this type does
// not even decode.
func tokenFromOtherListPath(token *ContinueToken, searchPath bool) bool {
	fromSearch := len(token.SearchAfter) > 0 || len(token.SearchBefore) > 0
	if searchPath {
		return !fromSearch
	}
	return fromSearch
}

// filterSelectors drops the requirements the index cannot answer, so a request
// carrying one of them is still served rather than refused. Callers re-apply the
// selector to the returned objects, so a dropped requirement costs extra reads
// rather than correctness.
func filterSelectors(req *resourcepb.ListRequest) *resourcepb.ListRequest {
	fields := make([]*resourcepb.Requirement, 0, len(req.Options.Fields))
	for _, f := range req.Options.Fields {
		// metadata.namespace is already in the request key.
		if (f.Operator != "=" && f.Operator != "==") || f.Key == "metadata.namespace" {
			continue
		}
		fields = append(fields, f)
	}
	req.Options.Fields = fields

	labels := make([]*resourcepb.Requirement, 0, len(req.Options.Labels))
	for _, l := range req.Options.Labels {
		if !indexableSelectorOperator(l.Operator) {
			continue
		}
		labels = append(labels, l)
	}
	req.Options.Labels = labels

	return req
}

// indexableSelectorOperator reports whether requirementQuery can turn the operator
// into an index query. A label selector may also carry !=, key and !key.
func indexableSelectorOperator(op string) bool {
	switch selection.Operator(op) {
	case selection.Equals, selection.DoubleEquals, selection.In, selection.NotIn:
		return true
	default:
		return false
	}
}

type SearchBackedListConfig struct {
	AllowedResources map[string]bool
}

func (c SearchBackedListConfig) Allowed(group, resource string) bool {
	return c.AllowedResources[group+"/"+resource]
}

func (s *server) shouldUseSearchForList(req *resourcepb.ListRequest) bool {
	if (s.searchClient == nil && s.search == nil) || req.Source != resourcepb.ListRequest_STORE {
		return false
	}
	if req.KeysOnly {
		return false
	}
	// An index covers one namespace, so a cross-namespace list stays on the store
	// scan, which supports it.
	if req.Options.Key.Namespace == "" {
		return false
	}
	// Search indexes collections and does not apply a name filter.
	if req.Options.Key.Name != "" {
		return false
	}
	hasSelectors := len(req.Options.Fields) > 0 || len(req.Options.Labels) > 0
	if !hasSelectors && !s.searchBackedListResources.Allowed(req.Options.Key.Group, req.Options.Key.Resource) {
		return false
	}

	if req.ResourceVersion > 0 || req.VersionMatchV2 == resourcepb.ResourceVersionMatchV2_Exact || req.VersionMatchV2 == resourcepb.ResourceVersionMatchV2_NotOlderThan {
		return false
	}

	// A client that started paging on the store scan has to finish there, even if
	// this gate would now pick search: its token records a position in the store,
	// which search cannot resume from. Without this, a client paging while the gate
	// changes would get its next page rejected.
	if req.NextPageToken != "" {
		if token, err := GetContinueToken(req.NextPageToken); err == nil && tokenFromOtherListPath(token, true) {
			return false
		}
	}

	// Labels are indexed for every kind, so a list filtered only by labels does not
	// need to know the kind.
	if len(req.Options.Fields) == 0 {
		return true
	}

	return s.selectableFieldsDeclared(req.Options.Key.Group, req.Options.Key.Resource, req.Options.Fields)
}

// selectableFieldsDeclared reports whether the kind declares every field the
// request filters on. Only a declared field is mapped into the index, and a
// filter on anything else would find nothing there.
//
// The declarations come from the same registry the index mapping is built from,
// which a manifest watcher keeps up to date, so a kind this binary was not
// compiled with still gets its selectors pushed down. The index can still be
// behind the registry, which the search side refuses rather than answers
// (see IsSelectableFieldNotIndexed).
func (s *server) selectableFieldsDeclared(group, resource string, fields []*resourcepb.Requirement) bool {
	if s.manifestSearchFields == nil {
		return false
	}
	declared, _, _ := s.manifestSearchFields.For(NewLowerGroupResource(group, resource))
	for _, f := range fields {
		if !slices.Contains(declared, f.Key) {
			return false
		}
	}
	return true
}
