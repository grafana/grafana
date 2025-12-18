package builder

import (
	"fmt"
	"net/http"

	"github.com/emicklei/go-restful/v3"
	"github.com/prometheus/client_golang/prometheus"
	serverstorage "k8s.io/apiserver/pkg/server/storage"
	klog "k8s.io/klog/v2"
	"k8s.io/kube-openapi/pkg/spec3"
)

// convertHandlerToRouteFunction converts an http.HandlerFunc to a restful.RouteFunction
func convertHandlerToRouteFunction(handler http.HandlerFunc) restful.RouteFunction {
	return func(req *restful.Request, resp *restful.Response) {
		handler(resp.ResponseWriter, req.Request)
	}
}

func RegisteredWebServicesFromBuilders(builders []APIGroupBuilder, metricsRegistry prometheus.Registerer, apiResourceConfig *serverstorage.ResourceConfig) []*restful.WebService {
	requestHandler, err := getCustomRoutesHandler(
		builders,
		metricsRegistry,
		apiResourceConfig,
	)
	if err != nil {
		panic(fmt.Sprintf("could not build the custom web services for specified API builders: %s", err.Error()))
	}
	return requestHandler
}

func getCustomRoutesHandler(builders []APIGroupBuilder, metricsRegistry prometheus.Registerer, apiResourceConfig *serverstorage.ResourceConfig) ([]*restful.WebService, error) {
	// Map to track WebServices by group version to avoid duplicates
	webServicesByGV := make(map[string]*restful.WebService)
	webServices := make([]*restful.WebService, 0)

	metrics := NewCustomRouteMetrics(metricsRegistry)

	for _, builder := range builders {
		provider, ok := builder.(APIGroupRouteProvider)
		if !ok || provider == nil {
			continue
		}

		for _, gv := range GetGroupVersions(builder) {
			// filter out api groups that are disabled in APIEnablementOptions
			gvr := gv.WithResource("")
			if apiResourceConfig != nil && !apiResourceConfig.ResourceEnabled(gvr) {
				klog.InfoS("Skipping custom route handler for disabled group version", "gv", gv.String())
				continue
			}
			routes := provider.GetAPIRoutes(gv)
			if routes == nil {
				continue
			}

			// Create or get WebService for this group version

			// Enforcing uniqueness of root is not possible iterating on builders alone
			// because of builders such as dashboards that use a single builder for multiple GVs.
			// The following code looks up by GV string to avoid duplicates.
			gvKey := gv.String()
			ws, exists := webServicesByGV[gvKey]
			if !exists {
				ws = new(restful.WebService)
				// Set root path to the group version prefix to avoid conflicts
				rootPath := "/apis/" + gv.String()
				ws.Path(rootPath)
				webServicesByGV[gvKey] = ws
			}

			// Root handlers
			for _, route := range routes.Root {
				methods, err := methodsFromSpec(route.Path, route.Spec)
				if err != nil {
					return nil, err
				}

				instrumentedHandler := metrics.InstrumentHandler(
					gv.Group,
					gv.Version,
					route.Path, // Use path as resource identifier
					route.Handler,
				)

				routeFunction := convertHandlerToRouteFunction(instrumentedHandler)
				// Use relative path since WebService root path is already set
				relativePath := "/" + route.Path

				// Add routes for each HTTP method
				for _, method := range methods {
					switch method {
					case "GET":
						ws.Route(ws.GET(relativePath).To(routeFunction))
					case "POST":
						ws.Route(ws.POST(relativePath).To(routeFunction))
					case "PUT":
						ws.Route(ws.PUT(relativePath).To(routeFunction))
					case "PATCH":
						ws.Route(ws.PATCH(relativePath).To(routeFunction))
					case "DELETE":
						ws.Route(ws.DELETE(relativePath).To(routeFunction))
					}
				}
			}

			// Namespace handlers
			for _, route := range routes.Namespace {
				methods, err := methodsFromSpec(route.Path, route.Spec)
				if err != nil {
					return nil, err
				}

				instrumentedHandler := metrics.InstrumentHandler(
					gv.Group,
					gv.Version,
					route.Path, // Use path as resource identifier
					route.Handler,
				)

				routeFunction := convertHandlerToRouteFunction(instrumentedHandler)
				// Use relative path since WebService root path is already set
				relativePath := "/namespaces/{namespace}/" + route.Path

				// Add routes for each HTTP method
				for _, method := range methods {
					switch method {
					case "GET":
						ws.Route(ws.GET(relativePath).To(routeFunction))
					case "POST":
						ws.Route(ws.POST(relativePath).To(routeFunction))
					case "PUT":
						ws.Route(ws.PUT(relativePath).To(routeFunction))
					case "PATCH":
						ws.Route(ws.PATCH(relativePath).To(routeFunction))
					case "DELETE":
						ws.Route(ws.DELETE(relativePath).To(routeFunction))
					}
				}
			}
		}
	}

	// Convert map values to slice
	for _, ws := range webServicesByGV {
		webServices = append(webServices, ws)
	}

	// Note: delegateHandler is not directly supported in restful.WebService
	// The caller should handle unmatched routes at a higher level (e.g., in the container)
	return webServices, nil
}

func methodsFromSpec(slug string, props *spec3.PathProps) ([]string, error) {
	if props == nil {
		return []string{"GET", "POST", "PUT", "PATCH", "DELETE"}, nil
	}

	methods := make([]string, 0)
	if props.Get != nil {
		methods = append(methods, "GET")
	}
	if props.Post != nil {
		methods = append(methods, "POST")
	}
	if props.Put != nil {
		methods = append(methods, "PUT")
	}
	if props.Patch != nil {
		methods = append(methods, "PATCH")
	}
	if props.Delete != nil {
		methods = append(methods, "DELETE")
	}

	if len(methods) == 0 {
		return nil, fmt.Errorf("invalid OpenAPI Spec for slug=%s without any methods in PathProps", slug)
	}

	return methods, nil
}
