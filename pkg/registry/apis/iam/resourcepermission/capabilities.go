package resourcepermission

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// Capability discovery reports admission support, never a caller's permission to grant access.
func (m *MappersRegistry) CapabilityRoutes() *builder.APIRoutes {
	response := spec.Schema{SchemaProps: spec.SchemaProps{Type: []string{"object"}, Properties: map[string]spec.Schema{"enabled": *spec.BooleanProperty()}}}
	return &builder.APIRoutes{Namespace: []builder.APIRouteHandler{{
		Path: "resourcepermissions/capabilities",
		Spec: &spec3.PathProps{Get: &spec3.Operation{OperationProps: spec3.OperationProps{
			OperationId: "getResourcePermissionCapabilities", Tags: []string{"ResourcePermission"},
			Description: "Check whether a resource type supports resource-permission assignments under the current configuration and license. Does not authorize the caller to manage permissions.",
			Parameters: []*spec3.Parameter{
				{ParameterProps: spec3.ParameterProps{Name: "namespace", In: "path", Required: true, Schema: spec.StringProperty()}},
				{ParameterProps: spec3.ParameterProps{Name: "apiGroup", In: "query", Required: true, Schema: spec.StringProperty()}},
				{ParameterProps: spec3.ParameterProps{Name: "resource", In: "query", Required: true, Schema: spec.StringProperty()}},
			},
			Responses: &spec3.Responses{ResponsesProps: spec3.ResponsesProps{StatusCodeResponses: map[int]*spec3.Response{200: {ResponseProps: spec3.ResponseProps{Description: "Resource-permission admission support", Content: map[string]*spec3.MediaType{"application/json": {MediaTypeProps: spec3.MediaTypeProps{Schema: &response}}}}}}}},
		}}}, Handler: m.capabilities,
	}}}
}

func (m *MappersRegistry) capabilities(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if _, ok := types.AuthInfoFrom(ctx); !ok {
		errhttp.Write(ctx, apierrors.NewUnauthorized("unauthenticated"), w)
		return
	}
	if mux.Vars(r)["namespace"] == "" {
		errhttp.Write(ctx, apierrors.NewBadRequest("namespace is required"), w)
		return
	}
	gr := schema.GroupResource{Group: r.URL.Query().Get("apiGroup"), Resource: r.URL.Query().Get("resource")}
	if gr.Group == "" || gr.Resource == "" {
		errhttp.Write(ctx, apierrors.NewBadRequest("apiGroup and resource are required"), w)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(struct {
		Enabled bool `json:"enabled"`
	}{Enabled: m.IsEnabled(gr)})
}
