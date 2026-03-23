package queryhistory

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

type SearchResponse struct {
	Items      []SearchResultItem `json:"items"`
	TotalCount *int64             `json:"totalCount,omitempty"`
}

type SearchResultItem struct {
	UID           string      `json:"uid"`
	DatasourceUID string      `json:"datasourceUid"`
	CreatedAt     int64       `json:"createdAt"`
	Comment       string      `json:"comment"`
	Queries       interface{} `json:"queries"`
	Starred       bool        `json:"starred"`
}

func convertSearchParamsFromURL(u *url.URL, namespace, userUID string) (*resourcepb.ResourceSearchRequest, error) {
	q := u.Query()

	searchReq := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: namespace,
				Group:     "queryhistory.grafana.app",
				Resource:  "queryhistories",
			},
		},
		// Request the custom fields we need in the response
		Fields: []string{
			resource.SEARCH_FIELD_PREFIX + builders.QH_COMMENT,
			resource.SEARCH_FIELD_PREFIX + builders.QH_DATASOURCE_UID,
			resource.SEARCH_FIELD_PREFIX + builders.QH_CREATED_BY,
		},
	}

	// Privacy filter: only return results owned by the requesting user
	searchReq.Options.Fields = append(searchReq.Options.Fields, &resourcepb.Requirement{
		Key:      resource.SEARCH_FIELD_PREFIX + builders.QH_CREATED_BY,
		Operator: "=",
		Values:   []string{userUID},
	})

	// Parse limit
	if limitStr := q.Get("limit"); limitStr != "" {
		limit, err := strconv.ParseInt(limitStr, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid limit: %w", err)
		}
		searchReq.Limit = limit
	}

	// Parse page
	if pageStr := q.Get("page"); pageStr != "" {
		page, err := strconv.ParseInt(pageStr, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid page: %w", err)
		}
		searchReq.Page = page
	}

	// Parse offset
	if offsetStr := q.Get("offset"); offsetStr != "" {
		offset, err := strconv.ParseInt(offsetStr, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid offset: %w", err)
		}
		searchReq.Offset = offset
	}

	// Parse free-text search
	if queryStr := q.Get("query"); queryStr != "" {
		searchReq.Query = queryStr
	}

	// Parse sort (use the built-in created timestamp field)
	if sortStr := q.Get("sort"); sortStr != "" {
		switch sortStr {
		case "time-asc":
			searchReq.SortBy = append(searchReq.SortBy, &resourcepb.ResourceSearchRequest_Sort{
				Field: resource.SEARCH_FIELD_CREATED,
				Desc:  false,
			})
		case "time-desc":
			searchReq.SortBy = append(searchReq.SortBy, &resourcepb.ResourceSearchRequest_Sort{
				Field: resource.SEARCH_FIELD_CREATED,
				Desc:  true,
			})
		}
	}

	// Parse datasource UID filters
	if dsUIDs := q["datasourceUid"]; len(dsUIDs) > 0 {
		operator := "="
		if len(dsUIDs) > 1 {
			operator = "in"
		}
		searchReq.Options.Fields = append(searchReq.Options.Fields, &resourcepb.Requirement{
			Key:      resource.SEARCH_FIELD_PREFIX + builders.QH_DATASOURCE_UID,
			Operator: operator,
			Values:   dsUIDs,
		})
	}

	// Parse time range filters (from/to are unix timestamps in seconds)
	if fromStr := q.Get("from"); fromStr != "" {
		searchReq.Options.Fields = append(searchReq.Options.Fields, &resourcepb.Requirement{
			Key:      resource.SEARCH_FIELD_CREATED,
			Operator: ">=",
			Values:   []string{fromStr},
		})
	}
	if toStr := q.Get("to"); toStr != "" {
		searchReq.Options.Fields = append(searchReq.Options.Fields, &resourcepb.Requirement{
			Key:      resource.SEARCH_FIELD_CREATED,
			Operator: "<=",
			Values:   []string{toStr},
		})
	}

	// onlyStarred requires a Collections API lookup to get starred UIDs,
	// then filter by name. This is a placeholder until Collections integration is done.
	// TODO: query Collections Stars API for the user's starred query history UIDs
	// and add a "name in [uid1, uid2, ...]" field requirement.

	return searchReq, nil
}

// NewSearchHandler returns an App SDK custom route handler for the search sub-resource.
func NewSearchHandler(searcher resourcepb.ResourceIndexClient) simple.AppCustomRouteHandler {
	return func(ctx context.Context, w app.CustomRouteResponseWriter, req *app.CustomRouteRequest) error {
		user, err := identity.GetRequester(ctx)
		if err != nil {
			w.WriteHeader(http.StatusUnauthorized)
			return nil
		}

		namespace := req.ResourceIdentifier.Namespace
		if namespace == "" {
			namespace = user.GetNamespace()
		}

		searchReq, err := convertSearchParamsFromURL(req.URL, namespace, user.GetIdentifier())
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return nil
		}

		result, err := searcher.Search(ctx, searchReq)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			return nil
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(convertSearchResults(result))
		return nil
	}
}

// convertSearchResults maps the ResourceSearchResponse table format into our SearchResultItem slice.
func convertSearchResults(result *resourcepb.ResourceSearchResponse) *SearchResponse {
	response := &SearchResponse{
		Items: make([]SearchResultItem, 0),
	}

	if result == nil || result.Results == nil {
		return response
	}

	totalCount := result.TotalHits
	response.TotalCount = &totalCount

	// Build column index map for lookup
	colIdx := make(map[string]int, len(result.Results.Columns))
	for i, col := range result.Results.Columns {
		colIdx[col.Name] = i
	}

	commentIdx, hasComment := colIdx[resource.SEARCH_FIELD_PREFIX+builders.QH_COMMENT]
	dsUIDIdx, hasDsUID := colIdx[resource.SEARCH_FIELD_PREFIX+builders.QH_DATASOURCE_UID]
	createdIdx, hasCreated := colIdx[resource.SEARCH_FIELD_CREATED]

	for _, row := range result.Results.Rows {
		item := SearchResultItem{}

		if row.Key != nil {
			item.UID = row.Key.Name
		}

		if hasComment && commentIdx < len(row.Cells) {
			item.Comment = string(row.Cells[commentIdx])
		}

		if hasDsUID && dsUIDIdx < len(row.Cells) {
			item.DatasourceUID = string(row.Cells[dsUIDIdx])
		}

		if hasCreated && createdIdx < len(row.Cells) {
			cell := row.Cells[createdIdx]
			// Numeric values are encoded as big-endian bytes
			if len(cell) == 8 {
				item.CreatedAt = int64(binary.BigEndian.Uint64(cell))
			}
		}

		response.Items = append(response.Items, item)
	}

	return response
}
