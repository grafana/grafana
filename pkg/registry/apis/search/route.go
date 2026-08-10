package search

import (
	"net/http"
	"strings"

	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
)

// ConfigSection and ConfigKey name the ini setting that turns these endpoints
// on. The endpoints are off by default while the API is being built out.
//
// Trash has its own key rather than sharing ConfigKey. It authorizes on a
// different rule -- folder admin, or whoever deleted the object -- that has not been
// reviewed yet, and a deployment may well turn search on for live search alone.
const (
	ConfigSection  = "grafana-apiserver"
	ConfigKey      = "enable_search_api"
	ConfigKeyTrash = "enable_trash_api"
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
	})
}

func trashRouteSpec(kindName, version string) *spec3.PathProps {
	return routeSpec(routeSpecArgs{
		operationID:  trashOperationID(kindName, version),
		description:  "List deleted " + kindName + " resources in a namespace.",
		requestKind:  searchv0.KindTrashQuery,
		requestGo:    trashQueryGoName,
		responseKind: searchv0.KindTrashResults,
		responseGo:   trashResultsGoName,
	})
}

// routeSpecArgs is what differs between the two endpoints. Go names are separate
// from kind names because the schema components are keyed by the Go name, while
// the descriptions read better with the kind name.
type routeSpecArgs struct {
	operationID  string
	description  string
	requestKind  string
	requestGo    string
	responseKind string
	responseGo   string
}

// routeSpec builds what both endpoints have in common: a namespaced POST taking a
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
						Content:     jsonContent(a.requestGo),
					},
				},
				Responses: &spec3.Responses{
					ResponsesProps: spec3.ResponsesProps{
						StatusCodeResponses: map[int]*spec3.Response{
							200: {
								ResponseProps: spec3.ResponseProps{
									Description: "A " + a.responseKind + " envelope.",
									Content:     jsonContent(a.responseGo),
								},
							},
						},
					},
				},
			},
		},
	}
}
