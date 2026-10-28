package search

import (
	"net/http"
	"strings"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

const (
	ConfigSection   = "grafana-apiserver"
	ConfigKeyHybrid = "enable_hybrid_api"
	// Global hybrid search requires the storage service's multi-resource RPC support.
	ConfigKeyGlobalHybrid = "enable_global_hybrid_api"
	// ConfigKeyGlobalSearch turns on the search that spans resource types. Off by
	// default, and useless without the global index it reads
	// (global_search_index_enabled), which is also off by default.
	ConfigKeyGlobalSearch = "enable_global_search_api"
)

// Aliased so the authorization chain and the routes cannot drift apart.
const (
	searchPathSegment = searchv0.SearchPathSegment
	trashPathSegment  = searchv0.TrashPathSegment
)

// Route is an endpoint to mount, described in terms the caller's apiserver
// wiring can consume. Deliberately not Grafana's builder.APIRouteHandler: the
// same handler is mounted by more than one host, so the mapping to any one
// host's route type belongs to that host.
type Route struct {
	Path    string
	Spec    *spec3.PathProps
	Handler http.HandlerFunc

	// Schemas are the components Spec references. They travel with the route
	// because the envelope types belong to a different group than the one serving.
	Schemas map[string]spec.Schema
}

// SearchRoute returns the namespaced route for a kind's search endpoint,
// mounted at .../namespaces/{namespace}/{resource}/search.
//
// POST is deliberate: it carries a request body, and it does not collide with
// the standard verbs, where create is a POST on the collection and object
// operations are GET/PUT/PATCH/DELETE on .../{resource}/{name}.
func (h *Handler) SearchRoute(group, version, resourceName, kindName string) Route {
	kind := kindRef{group: group, version: version, resource: resourceName, kind: kindName}
	return Route{
		Path:    resourceName + "/" + searchPathSegment,
		Spec:    searchRouteSpec(kindName, version),
		Handler: h.SearchFor(kind),
		Schemas: envelopeSchemas(searchQueryGoName, searchResultsGoName),
	}
}

// GlobalSearchRoute returns the namespaced route for the search that spans
// resource types, mounted at .../namespaces/{namespace}/global/search under the
// search group itself.
//
// kinds is only used to report the Kubernetes kind of each result, which this
// route cannot name itself because its results are of several resource types.
func (h *Handler) GlobalSearchRoute(kinds map[schema.GroupResource]string) Route {
	return Route{
		Path:    resource.GlobalSearchResource + "/" + searchPathSegment,
		Spec:    globalSearchRouteSpec(),
		Handler: h.GlobalSearchFor(kinds),
		Schemas: envelopeSchemas(searchQueryGoName, globalSearchResultsGoName),
	}
}

// TrashRoute returns the namespaced route for a kind's trash endpoint, mounted at
// .../namespaces/{namespace}/{resource}/trash.
//
// POST for the same reasons as SearchRoute.
func (h *Handler) TrashRoute(group, version, resourceName, kindName string) Route {
	kind := kindRef{group: group, version: version, resource: resourceName, kind: kindName}
	return Route{
		Path:    resourceName + "/" + trashPathSegment,
		Spec:    trashRouteSpec(kindName, version),
		Handler: h.TrashFor(kind),
		Schemas: envelopeSchemas(trashQueryGoName, trashResultsGoName),
	}
}

// HybridSearchRoute returns the namespaced route to mount at
// .../namespaces/{namespace}/{resource}/search/hybrid.
func (h *HybridHandler) HybridSearchRoute(group, version, resourceName, kindName string) Route {
	kind := kindRef{group: group, version: version, resource: resourceName, kind: kindName}
	return Route{
		Path:    resourceName + "/" + searchPathSegment + "/" + searchv0.HybridSearchPathSegment,
		Spec:    hybridSearchRouteSpec(kindName, version),
		Handler: h.HybridSearchFor(kind),
		Schemas: envelopeSchemas(hybridSearchQueryGoName, hybridSearchResultsGoName),
	}
}

func (h *HybridHandler) GlobalHybridSearchRoute(targets map[schema.GroupResource]schema.GroupVersionKind, kinds map[schema.GroupResource]string, auth authorizer.Authorizer, defaultResources []searchv0.HybridSearchResource) Route {
	return Route{
		Path:    resource.GlobalSearchResource + "/" + searchPathSegment + "/" + searchv0.HybridSearchPathSegment,
		Spec:    globalHybridSearchRouteSpec(),
		Handler: h.GlobalHybridSearchFor(targets, kinds, auth, defaultResources),
		Schemas: envelopeSchemas(hybridSearchQueryGoName, hybridSearchResultsGoName),
	}
}

// searchOperationID names the operation for OpenAPI. The version is part of the
// name because the endpoint is mounted on every served version, and operation
// IDs have to stay unique once the per-version specs are merged. It starts with
// a Kubernetes verb so the route builder does not prefix one: searching reads,
// it does not create.
func searchOperationID(kindName, version string) string {
	return "list" + kindName + "Search" + capitalize(version)
}

func trashOperationID(kindName, version string) string {
	return "list" + kindName + "Trash" + capitalize(version)
}

func hybridSearchOperationID(kindName, version string) string {
	return "list" + kindName + "HybridSearch" + capitalize(version)
}

func capitalize(s string) string {
	if s == "" {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}

func searchRouteSpec(kindName, version string) *spec3.PathProps {
	return routeSpec(routeSpecArgs{
		operationID:  searchOperationID(kindName, version),
		description:  "Search " + kindName + " resources in a namespace.",
		requestKind:  searchv0.KindSearchQuery,
		requestGo:    searchQueryGoName,
		responseKind: searchv0.KindSearchResults,
		responseGo:   searchResultsGoName,
		example: &searchv0.SearchQuery{
			TypeMeta: v1.TypeMeta{APIVersion: searchv0.APIVERSION, Kind: searchv0.KindSearchQuery},
			Limit:    10,
		},
	})
}

func globalSearchRouteSpec() *spec3.PathProps {
	return routeSpec(routeSpecArgs{
		operationID:  "listGlobalSearch" + capitalize(searchv0.VERSION),
		description:  globalSearchDescription(),
		requestKind:  searchv0.KindSearchQuery,
		requestGo:    searchQueryGoName,
		responseKind: searchv0.KindGlobalSearchResults,
		responseGo:   globalSearchResultsGoName,
		example:      globalSearchExample(),
	})
}

// globalSearchDescription says what this search adds to the search of one kind,
// which is all a caller cannot learn from the shared request schema.
func globalSearchDescription() string {
	types := make([]string, 0, len(resource.GlobalSearchResourceTypes()))
	for _, gr := range resource.GlobalSearchResourceTypes() {
		types = append(types, "`"+gr.Group+"/"+gr.Resource+"`")
	}
	return "Search resources of several types in a namespace: " + strings.Join(types, ", ") + ". " +
		"Each result names its own group, resource and kind, and is authorized on its own.\n\n" +
		"Only the fields every resource has can be used, plus:\n\n" +
		"- `" + resource.SEARCH_FIELD_GROUP_RESOURCE + "` (`{group}/{resource}`): filter and facet, to narrow the search to some types or count results per type.\n" +
		"- `" + resource.SEARCH_FIELD_FOLDER_TREE + "`: filter with `In` only. Matches what is in the named folders or in any folder below them, not the named folders themselves. " +
		"`general` names the root folder and matches everything; an empty value is rejected.\n\n" +
		"Results are eventually consistent: just after a change, a search can still return what was there before, " +
		"and just after a folder moves, a `" + resource.SEARCH_FIELD_FOLDER_TREE + "` search can still find what was below it in its old place."
}

// globalSearchExample searches one folder and everything below it for
// dashboards, newest first.
func globalSearchExample() *searchv0.SearchQuery {
	return &searchv0.SearchQuery{
		TypeMeta: v1.TypeMeta{APIVersion: searchv0.APIVERSION, Kind: searchv0.KindSearchQuery},
		Where: &searchv0.WhereNode{And: []searchv0.WhereNode{
			{Filter: &searchv0.FilterPredicate{Field: resource.SEARCH_FIELD_FOLDER_TREE, Operator: "In", Values: []string{"team-a"}}},
			{Filter: &searchv0.FilterPredicate{Field: resource.SEARCH_FIELD_GROUP_RESOURCE, Operator: "In", Values: []string{"dashboard.grafana.app/dashboards"}}},
		}},
		Sort:  []searchv0.SortField{{Field: resource.SEARCH_FIELD_UPDATED, Direction: "desc"}},
		Limit: 10,
	}
}

func trashRouteSpec(kindName, version string) *spec3.PathProps {
	return routeSpec(routeSpecArgs{
		operationID:  trashOperationID(kindName, version),
		description:  "List deleted " + kindName + " resources in a namespace.",
		requestKind:  searchv0.KindTrashQuery,
		requestGo:    trashQueryGoName,
		responseKind: searchv0.KindTrashResults,
		responseGo:   trashResultsGoName,
		example: &searchv0.TrashQuery{
			TypeMeta: v1.TypeMeta{APIVersion: searchv0.APIVERSION, Kind: searchv0.KindTrashQuery},
			Limit:    10,
		},
	})
}

func hybridSearchRouteSpec(kindName, version string) *spec3.PathProps {
	s := routeSpec(routeSpecArgs{
		operationID:  hybridSearchOperationID(kindName, version),
		description:  "Hybrid lexical and semantic search for " + kindName + " resources in a namespace. Returns top-k results with opaque scores meaningful only for ordering within this response. No pagination, totals, sorting or facets.",
		requestKind:  searchv0.KindHybridSearchQuery,
		requestGo:    hybridSearchQueryGoName,
		responseKind: searchv0.KindHybridSearchResults,
		responseGo:   hybridSearchResultsGoName,
		example: &searchv0.HybridSearchQuery{
			TypeMeta: v1.TypeMeta{APIVersion: searchv0.APIVERSION, Kind: searchv0.KindHybridSearchQuery},
			Query:    "production",
			Limit:    10,
		},
	})
	s.Post.RequestBody.Description = "A " + searchv0.KindHybridSearchQuery + " describing what to match and return."
	return s
}

func globalHybridSearchRouteSpec() *spec3.PathProps {
	s := routeSpec(routeSpecArgs{
		operationID:  hybridSearchOperationID("Global", searchv0.VERSION),
		description:  "Hybrid search across the requested resource types in one namespace. The search backend requires manifest hybrid opt-in for internal resources; externally pushed collections use existing enrollment and authorization. Results are reranked together. Limit applies to the combined results; failure searching any resource fails the request. No pagination, totals, sorting or facets.",
		requestKind:  searchv0.KindHybridSearchQuery,
		requestGo:    hybridSearchQueryGoName,
		responseKind: searchv0.KindHybridSearchResults,
		responseGo:   hybridSearchResultsGoName,
		example: &searchv0.HybridSearchQuery{
			TypeMeta: v1.TypeMeta{APIVersion: searchv0.APIVERSION, Kind: searchv0.KindHybridSearchQuery},
			Resources: []searchv0.HybridSearchResource{
				{Group: "dashboard.grafana.app", Resource: "dashboards"},
				{Group: "folder.grafana.app", Resource: "folders"},
			},
			Query: "production",
			Limit: 10,
		},
	})
	s.Post.RequestBody.Description = "A " + searchv0.KindHybridSearchQuery + " with a nonempty resources list."
	return s
}

// routeSpecArgs is what differs between the endpoints. Go names are separate
// from kind names because the schema components are keyed by the Go name, while
// the descriptions read better with the kind name.
type routeSpecArgs struct {
	operationID  string
	description  string
	requestKind  string
	requestGo    string
	responseKind string
	responseGo   string
	example      any
}

// routeSpec builds what the endpoints have in common: a namespaced POST taking a
// query envelope and returning a results envelope.
func routeSpec(a routeSpecArgs) *spec3.PathProps {
	return &spec3.PathProps{
		Post: &spec3.Operation{
			OperationProps: spec3.OperationProps{
				Tags:        []string{"Search"},
				OperationId: a.operationID,
				Description: a.description,
				Parameters: []*spec3.Parameter{
					{
						ParameterProps: spec3.ParameterProps{
							Name:        "namespace",
							In:          "path",
							Required:    true,
							Example:     "default",
							Description: "workspace",
							Schema:      spec.StringProperty(),
						},
					},
				},
				RequestBody: &spec3.RequestBody{
					RequestBodyProps: spec3.RequestBodyProps{
						Required:    true,
						Description: "A " + a.requestKind + " describing what to match, sort and return.",
						Content:     jsonContent(a.requestGo, a.example),
					},
				},
				Responses: &spec3.Responses{
					ResponsesProps: spec3.ResponsesProps{
						StatusCodeResponses: map[int]*spec3.Response{
							200: {
								ResponseProps: spec3.ResponseProps{
									Description: "A " + a.responseKind + " envelope.",
									Content:     jsonContent(a.responseGo, nil),
								},
							},
						},
					},
				},
			},
		},
	}
}
