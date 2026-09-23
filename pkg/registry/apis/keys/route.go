package keys

import (
	"net/http"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/util"
	"k8s.io/kube-openapi/pkg/validation/spec"

	commonv0 "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// ConfigSection and ConfigKey name the ini setting that turns the endpoint on.
// The endpoint is permanent; the gate is not.
const (
	ConfigSection = "grafana-apiserver"
	ConfigKey     = "enable_keys_api"
)

const componentPrefix = "#/components/schemas/"

// Standard meta.k8s.io/v1 types, so there is no envelope to define or generate.
var (
	listOptionsModel = metav1.ListOptions{}.OpenAPIModelName()
	partialListModel = metav1.PartialObjectMetadataList{}.OpenAPIModelName()
)

// Route is an endpoint to mount. Deliberately not builder.APIRouteHandler: more
// than one host mounts this handler, so the mapping belongs to each host.
type Route struct {
	Path    string
	Spec    *spec3.PathProps
	Handler http.HandlerFunc

	// Components Spec references. They travel with the route because the types
	// belong to a different group than the one serving.
	Schemas map[string]spec.Schema
}

// ListKeysRoute returns the cluster-scoped list-keys route.
func (h *Handler) ListKeysRoute(group, version, resourceName, kindName string) Route {
	kind := kindRef{group: group, version: version, resource: resourceName}
	return Route{
		Path:    resourceName + "/" + utils.ListKeysPathSegment,
		Spec:    listKeysRouteSpec(kindName, version, false),
		Handler: h.ListKeysFor(kind),
		Schemas: metaSchemas(listOptionsModel, partialListModel),
	}
}

// ListKeysInNamespaceRoute returns the namespaced list-keys route. Same path; the
// host mounts it under .../namespaces/{namespace}/, so the namespace arrives as a
// request attribute and stays visible to the authorizer and the audit log.
func (h *Handler) ListKeysInNamespaceRoute(group, version, resourceName, kindName string) Route {
	kind := kindRef{group: group, version: version, resource: resourceName}
	return Route{
		Path:    resourceName + "/" + utils.ListKeysPathSegment,
		Spec:    listKeysRouteSpec(kindName, version, true),
		Handler: h.ListKeysInNamespaceFor(kind),
		Schemas: metaSchemas(listOptionsModel, partialListModel),
	}
}

// The version is part of the name because the endpoint is mounted on every served
// version and operation IDs must stay unique once the specs are merged. Starts
// with a Kubernetes verb so the route builder does not prefix one.
func listKeysOperationID(kindName, version string, namespaced bool) string {
	if namespaced {
		return "listNamespaced" + kindName + "Keys" + capitalize(version)
	}
	return "list" + kindName + "Keys" + capitalize(version)
}

func capitalize(s string) string {
	if s == "" {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}

func listKeysRouteSpec(kindName, version string, namespaced bool) *spec3.PathProps {
	scope := "across all namespaces"
	requires := "Requires a service identity scoped to all namespaces."
	var params []*spec3.Parameter
	if namespaced {
		scope = "in a namespace"
		requires = "Requires permission to list the kind in that namespace."
		params = []*spec3.Parameter{
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
		}
	}
	return &spec3.PathProps{
		Post: &spec3.Operation{
			OperationProps: spec3.OperationProps{
				Tags:        []string{"Keys"},
				OperationId: listKeysOperationID(kindName, version, namespaced),
				Description: "List " + kindName + " keys " + scope + ": namespace, name, " +
					"folder and resourceVersion only, with no object bodies. " + requires,
				Parameters: params,
				RequestBody: &spec3.RequestBody{
					RequestBodyProps: spec3.RequestBodyProps{
						Required: false,
						Description: "A ListOptions carrying limit, continue and resourceVersion. " +
							"Selectors, watch and timeouts are rejected: they cannot be evaluated " +
							"without reading objects.",
						Content: jsonContent(listOptionsModel),
					},
				},
				Responses: &spec3.Responses{
					ResponsesProps: spec3.ResponsesProps{
						StatusCodeResponses: map[int]*spec3.Response{
							200: {
								ResponseProps: spec3.ResponseProps{
									Description: "A PartialObjectMetadataList in which only namespace, name, " +
										"resourceVersion and the grafana.app/folder annotation are populated.",
									Content: jsonContent(partialListModel),
								},
							},
						},
					},
				},
			},
		},
	}
}

// Generated dependencies come as either Go import paths or names already
// converted by OpenAPIModelName; converting an already-converted name reverses it.
func friendly(name string) string {
	if strings.Contains(name, "/") {
		return util.ToRESTFriendlyName(name)
	}
	return name
}

func schemaRef(goName string) spec.Ref {
	return spec.MustCreateRef(componentPrefix + friendly(goName))
}

// Each group version's spec is self-contained, so the components have to travel
// with the route. Dependencies are followed rather than listed because a missing
// one renders as an empty model with no error.
func metaSchemas(roots ...string) map[string]spec.Schema {
	defs := commonv0.GetOpenAPIDefinitions(schemaRef)

	out := map[string]spec.Schema{}
	queue := append([]string{}, roots...)
	for len(queue) > 0 {
		name := queue[0]
		queue = queue[1:]

		if _, seen := out[friendly(name)]; seen {
			continue
		}
		def, ok := defs[name]
		if !ok {
			continue
		}
		out[friendly(name)] = def.Schema
		queue = append(queue, def.Dependencies...)
	}

	return out
}

func jsonContent(goName string) map[string]*spec3.MediaType {
	return map[string]*spec3.MediaType{
		"application/json": {
			MediaTypeProps: spec3.MediaTypeProps{
				Schema: &spec.Schema{
					SchemaProps: spec.SchemaProps{Ref: schemaRef(goName)},
				},
			},
		},
	}
}
