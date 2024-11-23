package dashboard

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"

	dashboardv0alpha1 "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
)

// The DTO returns everything the UI needs in a single request
type SearchConnector struct {
	newFunc func() runtime.Object
	client  resource.ResourceIndexClient
	log     log.Logger
}

func NewSearchConnector(
	client resource.ResourceIndexClient,
	newFunc func() runtime.Object,
) (rest.Storage, error) {
	v := &SearchConnector{
		client:  client,
		newFunc: newFunc,
		log:     log.New("grafana-apiserver.dashboards.search"),
	}
	return v, nil
}

var (
	_ rest.Connecter            = (*SearchConnector)(nil)
	_ rest.StorageMetadata      = (*SearchConnector)(nil)
	_ rest.Scoper               = (*SearchConnector)(nil)
	_ rest.SingularNameProvider = (*SearchConnector)(nil)
)

func (s *SearchConnector) New() runtime.Object {
	return s.newFunc()
}

func (s *SearchConnector) Destroy() {
}

func (s *SearchConnector) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *SearchConnector) GetSingularName() string {
	return "Search"
}

func (s *SearchConnector) ConnectMethods() []string {
	return []string{"GET"}
}

func (s *SearchConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (s *SearchConnector) ProducesMIMETypes(verb string) []string {
	return nil
}

func (s *SearchConnector) ProducesObject(verb string) interface{} {
	return s.newFunc()
}

func (s *SearchConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		queryParams, err := url.ParseQuery(r.URL.RawQuery)
		if err != nil {
			responder.Error(err)
			return
		}

		// get limit and offset from query params
		limit := 50
		offset := 0
		if queryParams.Has("limit") {
			limit, _ = strconv.Atoi(queryParams.Get("limit"))
		}
		if queryParams.Has("offset") {
			offset, _ = strconv.Atoi(queryParams.Get("offset"))
		}

		searchRequest := &resource.ResourceSearchRequest{
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Namespace: user.GetNamespace(),
					Group:     dashboardv0alpha1.GROUP,
					Resource:  "dashboards",
				},
			},
			Query:  queryParams.Get("query"),
			Limit:  int64(limit),
			Offset: int64(offset),
			Fields: []string{
				"title",
				"folder",
				"tags",
			},
		}

		// Add the folder constraint. Note this does not do recursive search
		folder := queryParams.Get("folder")
		if folder != "" {
			searchRequest.Options.Fields = []*resource.Requirement{{
				Key:      "folder",
				Operator: "=",
				Values:   []string{folder},
			}}
		}

		// Add sorting
		if queryParams.Has("sort") {
			searchRequest.SortBy = append(searchRequest.SortBy, &resource.ResourceSearchRequest_Sort{
				Field: queryParams.Get("sort"),
				Desc:  queryParams.Get("sort-desc") == "true",
			})
		}

		// Also query folders
		if searchRequest.Query != "" {
			searchRequest.Federated = []*resource.ResourceKey{{
				Namespace: searchRequest.Options.Key.Namespace,
				Group:     "folder.grafana.app",
				Resource:  "folders",
			}}
		}

		// The facet term fields
		facets, ok := queryParams["facet"]
		if ok {
			searchRequest.Facet = make(map[string]*resource.ResourceSearchRequest_Facet)
			for _, v := range facets {
				searchRequest.Facet[v] = &resource.ResourceSearchRequest_Facet{
					Field: v,
					Limit: 50,
				}
			}
		}

		// Run the query
		result, err := s.client.Search(r.Context(), searchRequest)
		if err != nil {
			responder.Error(err)
			return
		}

		sr := &dashboardv0alpha1.SearchResults{
			Offset:    searchRequest.Offset,
			TotalHits: result.TotalHits,
			QueryCost: result.QueryCost,
			MaxScore:  result.MaxScore,
			Hits:      make([]dashboardv0alpha1.DashboardHit, len(result.Results.Rows)),
		}
		for i, row := range result.Results.Rows {
			hit := &dashboardv0alpha1.DashboardHit{
				Type:   dashboardv0alpha1.HitTypeDash,
				Name:   row.Key.Name,
				Title:  string(row.Cells[0]),
				Folder: string(row.Cells[1]),
			}
			if row.Cells[2] != nil {
				_ = json.Unmarshal(row.Cells[2], &hit.Tags)
			}
			sr.Hits[i] = *hit
		}

		// Add facet results
		if result.Facet != nil {
			sr.Facets = make(map[string]dashboardv0alpha1.FacetResult)
			for k, v := range result.Facet {
				sr.Facets[k] = dashboardv0alpha1.FacetResult{
					Field:   v.Field,
					Total:   v.Total,
					Missing: v.Missing,
					Terms:   make([]dashboardv0alpha1.TermFacet, len(v.Terms)),
				}
				for j, t := range v.Terms {
					sr.Facets[k].Terms[j] = dashboardv0alpha1.TermFacet{
						Term:  t.Term,
						Count: t.Count,
					}
				}
			}
		}

		responder.Object(200, sr)
	}), nil
}
