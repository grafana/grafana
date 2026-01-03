package builder

import (
	"fmt"
	"net/http"
	"strings"

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

// AugmentWebServicesWithCustomRoutes adds custom routes from builders to existing WebServices
// in the container.
func AugmentWebServicesWithCustomRoutes(
	container *restful.Container,
	builders []APIGroupBuilder,
	metricsRegistry prometheus.Registerer,
	apiResourceConfig *serverstorage.ResourceConfig,
) error {
	if container == nil {
		return fmt.Errorf("container cannot be nil")
	}

	metrics := NewCustomRouteMetrics(metricsRegistry)

	// Build a map of existing WebServices by root path
	existingWebServices := make(map[string]*restful.WebService)
	for _, ws := range container.RegisteredWebServices() {
		existingWebServices[ws.RootPath()] = ws
	}

	for _, b := range builders {
		provider, ok := b.(APIGroupRouteProvider)
		if !ok || provider == nil {
			continue
		}

		for _, gv := range GetGroupVersions(b) {
			// Filter out disabled API groups
			gvr := gv.WithResource("")
			if apiResourceConfig != nil && !apiResourceConfig.ResourceEnabled(gvr) {
				klog.InfoS("Skipping custom routes for disabled group version", "gv", gv.String())
				continue
			}

			routes := provider.GetAPIRoutes(gv)
			if routes == nil {
				continue
			}

			// Find or create WebService for this group version
			rootPath := "/apis/" + gv.String()
			ws, exists := existingWebServices[rootPath]
			if !exists {
				// Create a new WebService if one doesn't exist
				ws = new(restful.WebService)
				ws.Path(rootPath)
				container.Add(ws)
				existingWebServices[rootPath] = ws
			}

			// Add root handlers using OpenAPI specs
			for _, route := range routes.Root {
				instrumentedHandler := metrics.InstrumentHandler(
					gv.Group,
					gv.Version,
					route.Path,
					route.Handler,
				)
				routeFunction := convertHandlerToRouteFunction(instrumentedHandler)

				// Use OpenAPI spec to configure routes properly
				if err := addRouteFromSpec(ws, route.Path, route.Spec, routeFunction, false); err != nil {
					return fmt.Errorf("failed to add root route %s: %w", route.Path, err)
				}
			}

			// Add namespace handlers using OpenAPI specs
			for _, route := range routes.Namespace {
				instrumentedHandler := metrics.InstrumentHandler(
					gv.Group,
					gv.Version,
					route.Path,
					route.Handler,
				)
				routeFunction := convertHandlerToRouteFunction(instrumentedHandler)

				// Use OpenAPI spec to configure routes properly
				if err := addRouteFromSpec(ws, route.Path, route.Spec, routeFunction, true); err != nil {
					return fmt.Errorf("failed to add namespace route %s: %w", route.Path, err)
				}
			}
		}
	}

	return nil
}

// addRouteFromSpec adds routes to a WebService using OpenAPI specs
func addRouteFromSpec(ws *restful.WebService, routePath string, pathProps *spec3.PathProps, handler restful.RouteFunction, isNamespaced bool) error {
	if pathProps == nil {
		return fmt.Errorf("pathProps cannot be nil for route %s", routePath)
	}

	// Build the full path (relative to WebService root)
	var fullPath string
	if isNamespaced {
		fullPath = "/namespaces/{namespace}/" + routePath
	} else {
		fullPath = "/" + routePath
	}

	// Add routes for each HTTP method defined in the OpenAPI spec
	operations := map[string]*spec3.Operation{
		"GET":    pathProps.Get,
		"POST":   pathProps.Post,
		"PUT":    pathProps.Put,
		"PATCH":  pathProps.Patch,
		"DELETE": pathProps.Delete,
	}

	for method, operation := range operations {
		if operation == nil {
			continue
		}

		// Create route builder for this method
		var routeBuilder *restful.RouteBuilder
		switch method {
		case "GET":
			routeBuilder = ws.GET(fullPath)
		case "POST":
			routeBuilder = ws.POST(fullPath)
		case "PUT":
			routeBuilder = ws.PUT(fullPath)
		case "PATCH":
			routeBuilder = ws.PATCH(fullPath)
		case "DELETE":
			routeBuilder = ws.DELETE(fullPath)
		}

		// Set operation ID from OpenAPI spec (with K8s verb prefix if needed)
		operationID := operation.OperationId
		if operationID == "" {
			// Generate from path if not specified
			operationID = generateOperationNameFromPath(routePath)
		}
		operationID = prefixRouteIDWithK8sVerbIfNotPresent(operationID, method)
		routeBuilder = routeBuilder.Operation(operationID)

		// Add description from OpenAPI spec
		if operation.Description != "" {
			routeBuilder = routeBuilder.Doc(operation.Description)
		}

		// Check if namespace parameter is already in the OpenAPI spec
		hasNamespaceParam := false
		if operation.Parameters != nil {
			for _, param := range operation.Parameters {
				if param.Name == "namespace" && param.In == "path" {
					hasNamespaceParam = true
					break
				}
			}
		}

		// Add namespace parameter for namespaced routes if not already in spec
		if isNamespaced && !hasNamespaceParam {
			routeBuilder = routeBuilder.Param(restful.PathParameter("namespace", "object name and auth scope, such as for teams and projects"))
		}

		// Add parameters from OpenAPI spec
		if operation.Parameters != nil {
			for _, param := range operation.Parameters {
				switch param.In {
				case "path":
					routeBuilder = routeBuilder.Param(restful.PathParameter(param.Name, param.Description))
				case "query":
					routeBuilder = routeBuilder.Param(restful.QueryParameter(param.Name, param.Description))
				case "header":
					routeBuilder = routeBuilder.Param(restful.HeaderParameter(param.Name, param.Description))
				}
			}
		}

		// Note: Request/response schemas are already defined in the OpenAPI spec from builders
		// and will be added to the OpenAPI document via addBuilderRoutes in openapi.go.
		// We don't duplicate that information here since restful uses the route metadata
		// for OpenAPI generation, which is handled separately in this codebase.

		// Register the route with handler
		ws.Route(routeBuilder.To(handler))
	}

	return nil
}

func prefixRouteIDWithK8sVerbIfNotPresent(operationID string, method string) string {
	for _, verb := range allowedK8sVerbs {
		if len(operationID) > len(verb) && operationID[:len(verb)] == verb {
			return operationID
		}
	}
	return fmt.Sprintf("%s%s", httpMethodToK8sVerb[strings.ToUpper(method)], operationID)
}

var allowedK8sVerbs = []string{
	"get", "log", "read", "replace", "patch", "delete", "deletecollection", "watch", "connect", "proxy", "list", "create", "patch",
}

var httpMethodToK8sVerb = map[string]string{
	http.MethodGet:     "get",
	http.MethodPost:    "create",
	http.MethodPut:     "replace",
	http.MethodPatch:   "patch",
	http.MethodDelete:  "delete",
	http.MethodConnect: "connect",
	http.MethodOptions: "connect", // No real equivalent to options and head
	http.MethodHead:    "connect",
}

// generateOperationNameFromPath creates an operation name from a route path.
// The operation name is used by the OpenAPI generator and should be descriptive.
// It uses meaningful path segments to create readable yet unique operation names.
// Examples:
//   - "/search" -> "Search"
//   - "/snapshots/create" -> "SnapshotsCreate"
//   - "ofrep/v1/evaluate/flags" -> "OfrepEvaluateFlags"
//   - "ofrep/v1/evaluate/flags/{flagKey}" -> "OfrepEvaluateFlagsFlagKey"
func generateOperationNameFromPath(routePath string) string {
	// Remove leading slash and split by path segments
	parts := strings.Split(strings.TrimPrefix(routePath, "/"), "/")

	// Filter to keep meaningful segments and path parameters
	var nameParts []string
	skipPrefixes := map[string]bool{
		"namespaces": true,
		"apis":       true,
	}

	for _, part := range parts {
		if part == "" {
			continue
		}

		// Extract parameter name from {paramName} format
		if strings.HasPrefix(part, "{") && strings.HasSuffix(part, "}") {
			paramName := part[1 : len(part)-1]
			// Skip generic parameters like {namespace}, but keep specific ones like {flagKey}
			if paramName != "namespace" && paramName != "name" {
				nameParts = append(nameParts, strings.ToUpper(paramName[:1])+paramName[1:])
			}
			continue
		}

		// Skip common prefixes
		if skipPrefixes[strings.ToLower(part)] {
			continue
		}

		// Skip version segments like v1, v0alpha1, v2beta1, etc.
		if strings.HasPrefix(strings.ToLower(part), "v") &&
			(len(part) <= 3 || strings.Contains(strings.ToLower(part), "alpha") || strings.Contains(strings.ToLower(part), "beta")) {
			continue
		}

		// Capitalize first letter and add to parts
		if len(part) > 0 {
			nameParts = append(nameParts, strings.ToUpper(part[:1])+part[1:])
		}
	}

	if len(nameParts) == 0 {
		return "Route"
	}

	return strings.Join(nameParts, "")
}
