package keys

import (
	"net/http"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	storagev0 "github.com/grafana/grafana/pkg/apis/storage/v0alpha1"
)

// ConfigSection and ConfigKey name the ini setting that turns the endpoint on.
// The endpoint is permanent; the gate is not.
const (
	ConfigSection = "grafana-apiserver"
	ConfigKey     = "enable_keys_api"
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
		Schemas: envelopeSchemas(listKeyRequestGoName, listKeyResponseGoName),
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
		Schemas: envelopeSchemas(listKeyRequestGoName, listKeyResponseGoName),
	}
}

// Swagger UI pre-fills the request body from this, instead of placeholder values
// for every field.
var listKeyRequestExample = storagev0.ListKeyRequest{
	TypeMeta: metav1.TypeMeta{APIVersion: storagev0.APIVERSION, Kind: storagev0.KindListKeyRequest},
	Limit:    100,
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
						Description: "A " + storagev0.KindListKeyRequest + " carrying limit, continue and resourceVersion, " +
							"optionally with apiVersion and kind. Any other field is rejected.",
						Content: jsonContent(listKeyRequestGoName, listKeyRequestExample),
					},
				},
				Responses: &spec3.Responses{
					ResponsesProps: spec3.ResponsesProps{
						StatusCodeResponses: map[int]*spec3.Response{
							200: {
								ResponseProps: spec3.ResponseProps{
									Description: "A " + storagev0.KindListKeyResponse + " page of keys, " +
										"each carrying namespace, name, resourceVersion and folder.",
									Content: jsonContent(listKeyResponseGoName, nil),
								},
							},
						},
					},
				},
			},
		},
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
