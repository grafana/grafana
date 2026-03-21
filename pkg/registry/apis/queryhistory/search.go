package queryhistory

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

type searchREST struct {
	searcher resourcepb.ResourceIndexClient
}

var (
	_ rest.Connecter       = (*searchREST)(nil)
	_ rest.StorageMetadata = (*searchREST)(nil)
	_ rest.Storage         = (*searchREST)(nil)
)

func (s *searchREST) New() runtime.Object {
	return &metav1.Status{}
}

func (s *searchREST) Destroy() {}

func (s *searchREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (s *searchREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (s *searchREST) ProducesMIMETypes(_ string) []string {
	return []string{"application/json"}
}

func (s *searchREST) ProducesObject(_ string) interface{} {
	return &SearchResponse{}
}

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

func (s *searchREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		user, err := identity.GetRequester(ctx)
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		searchReq, err := convertSearchParams(req, user.GetUID())
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		result, err := s.searcher.Search(ctx, searchReq)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		response := convertSearchResults(result)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(response)
	}), nil
}

func convertSearchParams(req *http.Request, userUID string) (*resourcepb.ResourceSearchRequest, error) {
	q := req.URL.Query()

	searchReq := &resourcepb.ResourceSearchRequest{}

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

	// Parse sort
	if sortStr := q.Get("sort"); sortStr != "" {
		switch sortStr {
		case "time-asc":
			searchReq.SortBy = append(searchReq.SortBy, &resourcepb.ResourceSearchRequest_Sort{
				Field: builders.QH_CREATED_BY,
				Desc:  false,
			})
		case "time-desc":
			searchReq.SortBy = append(searchReq.SortBy, &resourcepb.ResourceSearchRequest_Sort{
				Field: builders.QH_CREATED_BY,
				Desc:  true,
			})
		}
	}

	// TODO: Parse datasourceUid[] filter and map to field requirements
	// TODO: Parse from/to time range filters
	// TODO: Handle onlyStarred via Collections API lookup
	// TODO: Add user privacy filter (created_by == userUID)

	return searchReq, nil
}

func convertSearchResults(result *resourcepb.ResourceSearchResponse) *SearchResponse {
	response := &SearchResponse{
		Items: make([]SearchResultItem, 0),
	}

	if result == nil {
		return response
	}

	totalCount := result.TotalHits
	response.TotalCount = &totalCount

	// TODO: Map result rows to SearchResultItems using result.Results columns/frames

	return response
}
