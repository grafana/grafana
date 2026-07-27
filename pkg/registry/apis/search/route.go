package search

import (
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

// ConfigSection and ConfigKey name the ini setting that turns these endpoints
// on. The endpoints are off by default while the API is being built out.
const (
	ConfigSection = "grafana-apiserver"
	ConfigKey     = "enable_search_api"
)

// searchPathSegment is the last segment of the search endpoint path.
const searchPathSegment = "search"

// SearchRoute returns the namespaced route for a kind's search endpoint,
// mounted at .../namespaces/{namespace}/{resource}/search.
//
// POST is deliberate: it carries a request body, and it does not collide with
// the standard verbs, where create is a POST on the collection and object
// operations are GET/PUT/PATCH/DELETE on .../{resource}/{name}.
func (h *Handler) SearchRoute(group, version, resourceName, kindName string) builder.APIRouteHandler {
	kind := kindRef{group: group, version: version, resource: resourceName, kind: kindName}
	return builder.APIRouteHandler{
		Path:    resourceName + "/" + searchPathSegment,
		Spec:    searchRouteSpec(kindName),
		Handler: h.SearchFor(kind),
	}
}

// IsSearchRequest reports whether attr describes a call to a kind's search
// endpoint. Kubernetes parses that path as a create on the kind named "search",
// which a real create never is: creating an object posts to the collection and
// so carries no name.
func IsSearchRequest(attr authorizer.Attributes) bool {
	return attr.IsResourceRequest() &&
		attr.GetVerb() == "create" &&
		attr.GetSubresource() == "" &&
		attr.GetName() == searchPathSegment
}

// AsReadAttributes restates a search request as the read it performs. Without
// this, searching would demand permission to create the kind.
func AsReadAttributes(attr authorizer.Attributes) authorizer.Attributes {
	fieldSelector, fieldErr := attr.GetFieldSelector()
	labelSelector, labelErr := attr.GetLabelSelector()
	return authorizer.AttributesRecord{
		User:            attr.GetUser(),
		Verb:            "list",
		Namespace:       attr.GetNamespace(),
		APIGroup:        attr.GetAPIGroup(),
		APIVersion:      attr.GetAPIVersion(),
		Resource:        attr.GetResource(),
		Subresource:     attr.GetSubresource(),
		ResourceRequest: true,
		Path:            attr.GetPath(),

		FieldSelectorRequirements: fieldSelector,
		FieldSelectorParsingErr:   fieldErr,
		LabelSelectorRequirements: labelSelector,
		LabelSelectorParsingErr:   labelErr,
	}
}

func searchRouteSpec(kindName string) *spec3.PathProps {
	return &spec3.PathProps{
		Post: &spec3.Operation{
			OperationProps: spec3.OperationProps{
				Tags:        []string{"Search"},
				OperationId: "search" + kindName,
				Description: "Search " + kindName + " resources in a namespace.",
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
						Description: "A " + searchv0.KindSearchQuery + " describing what to match, sort and return.",
						Content: map[string]*spec3.MediaType{
							"application/json": {},
						},
					},
				},
				Responses: &spec3.Responses{
					ResponsesProps: spec3.ResponsesProps{
						StatusCodeResponses: map[int]*spec3.Response{
							200: {
								ResponseProps: spec3.ResponseProps{
									Description: "A " + searchv0.KindSearchResults + " envelope.",
									Content: map[string]*spec3.MediaType{
										"application/json": {},
									},
								},
							},
						},
					},
				},
			},
		},
	}
}
