package backend

import (
	"net/http"
	"path"

	aggregationv0alpha1 "github.com/grafana/grafana/pkg/aggregator/apis/aggregation/v0alpha1"
)

type Backend interface {
	AdmissionMutationHandler(aggregationv0alpha1.Backend) http.Handler
	AdmissionValidationHandler(aggregationv0alpha1.Backend) http.Handler
	QueryDataHandler(aggregationv0alpha1.Backend) http.Handler
	RouteHandler(aggregationv0alpha1.Backend) http.Handler
}

type BackendHandler struct {
	mux              *http.ServeMux
	backend          Backend
	delegate         http.Handler
	dataplaneService aggregationv0alpha1.DataPlaneService
}

func NewBackendHandler(
	backend Backend,
	delegate http.Handler,
	dataplaneService aggregationv0alpha1.DataPlaneService,
) *BackendHandler {
	h := &BackendHandler{
		mux:              http.NewServeMux(),
		delegate:         delegate,
		dataplaneService: dataplaneService,
		backend:          backend,
	}
	h.registerRoutes()
	return h
}

func (h *BackendHandler) registerRoutes() {
	proxyPath := proxyPathBuilder(h.dataplaneService.Spec.Group, h.dataplaneService.Spec.Version)

	for _, service := range h.dataplaneService.Spec.Services {
		backend := h.dataplaneService.Spec.Backend
		switch service.Type {
		case aggregationv0alpha1.AdmissionControlServiceType:
			h.mux.Handle(proxyPath("/admission/mutate"), h.backend.AdmissionMutationHandler(backend))
			h.mux.Handle(proxyPath("/admission/validate"), h.backend.AdmissionValidationHandler(backend))
		case aggregationv0alpha1.ConversionServiceType:
			// TODO: implement in future PR
		case aggregationv0alpha1.DataSourceProxyServiceType:
			// TODO: implement in future PR
		case aggregationv0alpha1.QueryServiceType:
			h.mux.Handle(proxyPath("/namespaces/{namespace}/connections/{uid}/query"), h.backend.QueryDataHandler(backend))
		case aggregationv0alpha1.RouteServiceType:
			namespacedPath := path.Join("namespaces", "{namespace}", service.Path)
			method := ""
			if service.Method != "" {
				method = service.Method + " "
			}
			h.mux.Handle(method+proxyPath(namespacedPath), h.backend.RouteHandler(backend))
		case aggregationv0alpha1.StreamServiceType:
			// TODO: implement in future PR
		}
	}

	// fallback to the delegate
	h.mux.Handle("/", h.delegate)
}

func (h *BackendHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	h.mux.ServeHTTP(w, req)
}

func proxyPathBuilder(group, version string) func(string) string {
	return func(suffix string) string {
		return path.Join("/apis", group, version, suffix)
	}
}
