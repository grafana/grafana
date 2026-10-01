package resource

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// errSearchCannotAnswerTrash asks List to retry from the storage trash scan.
// It never reaches a client.
var errSearchCannotAnswerTrash = errors.New("search cannot answer this trash list")

func (s *server) listTrashFromSearch(ctx context.Context, req *resourcepb.ListRequest) (*resourcepb.ListResponse, error) {
	ctx, span := tracer.Start(ctx, "resource.server.ListTrashFromSearch")
	defer span.End()

	srq := &resourcepb.ResourceSearchRequest{
		Options:      req.Options,
		Limit:        req.Limit,
		Fields:       []string{SEARCH_FIELD_RV},
		SortBy:       []*resourcepb.ResourceSearchRequest_Sort{{Field: SEARCH_FIELD_DELETED_RV, Desc: true}},
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
		IsDeleted:    true,
	}

	page, errRes, err := s.executeSearchListPage(ctx, req, srq, span)
	if err != nil {
		if req.NextPageToken == "" && AsErrorResult(err).GetCode() == http.StatusServiceUnavailable {
			return nil, fmt.Errorf("%w: %w", errSearchCannotAnswerTrash, err)
		}
		return nil, err
	}
	if errRes != nil {
		return &resourcepb.ListResponse{Error: errRes}, nil
	}
	if searchErr := page.response.GetError(); searchErr != nil {
		if searchErr.GetCode() == http.StatusServiceUnavailable && req.NextPageToken == "" {
			return nil, fmt.Errorf("%w: %w", errSearchCannotAnswerTrash, ErrorFromResponse(searchErr, nil))
		}
		err := ErrorFromResponse(searchErr, nil)
		s.log.Error("Search failed for trash List", "group", req.Options.Key.Group, "resource", req.Options.Key.Resource, "error", err)
		return &resourcepb.ListResponse{Error: AsErrorResult(err)}, nil
	}

	user, ok := claims.AuthInfoFrom(ctx)
	if !ok || user == nil {
		return &resourcepb.ListResponse{Error: &resourcepb.ErrorResult{
			Code: http.StatusUnauthorized, Message: "no user found in context",
		}}, nil
	}
	authorizer := s.newTrashAuthorizer(ctx, user, req.Options.Key)
	rsp := &resourcepb.ListResponse{ResourceVersion: page.resourceVersion}
	pageBytes := 0

	type trashSearchValue struct {
		row   listSearchRow
		value *BackendReadResponse
		obj   utils.GrafanaMetaAccessor
	}
	for chunk := range slices.Chunk(page.rows, searchReadChunkSize) {
		requests := make([]*resourcepb.ReadRequest, len(chunk))
		for i, row := range chunk {
			requests[i] = &resourcepb.ReadRequest{Key: row.key, ResourceVersion: row.resourceVersion}
		}
		values, err := s.backend.BatchReadResource(ctx, requests, true)
		if errors.Is(err, ErrBatchReadUnsupported) {
			if req.NextPageToken == "" {
				return nil, fmt.Errorf("%w: %w", errSearchCannotAnswerTrash, err)
			}
			return &resourcepb.ListResponse{Error: NewServiceUnavailableError("batch reading trash is not supported by this storage backend")}, nil
		}
		if err != nil {
			return nil, err
		}
		parsed := make([]trashSearchValue, 0, len(chunk))
		items := make([]TrashItem, 0, len(chunk))
		count := 0
		for val := range values {
			if count >= len(chunk) {
				return nil, fmt.Errorf("batch trash reader returned too many responses")
			}
			row := chunk[count]
			count++
			if val == nil {
				return &resourcepb.ListResponse{Error: &resourcepb.ErrorResult{
					Code: http.StatusInternalServerError, Message: "empty trash read response",
				}}, nil
			}
			if val.Error.GetCode() == http.StatusNotFound {
				continue
			}
			if err := ErrorFromResponse(val.Error, nil); err != nil {
				return &resourcepb.ListResponse{Error: AsErrorResult(err)}, nil
			}
			obj, err := parseTrashItem(val.Value)
			if err != nil || obj.GetAnnotation(utils.AnnoKeyManagerKind) != "" {
				continue
			}
			parsed = append(parsed, trashSearchValue{row: row, value: val, obj: obj})
			items = append(items, TrashItem{Folder: obj.GetFolder(), DeletedBy: obj.GetUpdatedBy()})
		}
		if count != len(chunk) {
			return nil, fmt.Errorf("batch trash reader returned %d responses for %d requests", count, len(chunk))
		}
		authorizer.Prepare(ctx, items)

		for _, item := range parsed {
			if !authorizer.Allowed(ctx, item.obj.GetFolder(), item.obj.GetUpdatedBy()) {
				continue
			}
			pageBytes += len(item.value.Value)
			rsp.Items = append(rsp.Items, &resourcepb.ResourceWrapper{
				Value: item.value.Value, ResourceVersion: item.value.ResourceVersion,
			})
			if s.listPageFull(req, rsp, pageBytes) {
				token, err := NewSearchContinueToken(item.row.sortFields, page.resourceVersion)
				if err != nil {
					return &resourcepb.ListResponse{Error: NewBadRequestError("invalid continue token")}, nil
				}
				rsp.NextPageToken = token
				return rsp, nil
			}
		}
	}
	if errRes := setSearchListContinueToken(req, page.response, page.rows, page.resourceVersion, rsp); errRes != nil {
		return &resourcepb.ListResponse{Error: errRes}, nil
	}

	return rsp, nil
}

func (s *server) shouldUseSearchForTrash(req *resourcepb.ListRequest) bool {
	if req.Source != resourcepb.ListRequest_TRASH ||
		!s.searchBackedListResources.Allowed(req.Options.Key.Group, req.Options.Key.Resource) ||
		(s.searchClient == nil && s.search == nil) ||
		req.KeysOnly || req.Options.Key.Namespace == "" || req.Options.Key.Name != "" ||
		req.ResourceVersion > 0 || req.VersionMatchV2 == resourcepb.ResourceVersionMatchV2_Exact ||
		req.VersionMatchV2 == resourcepb.ResourceVersionMatchV2_NotOlderThan {
		return false
	}
	if req.NextPageToken != "" {
		if token, err := GetContinueToken(req.NextPageToken); err == nil && tokenFromOtherListPath(token, true) {
			return false
		}
	}

	return true
}
