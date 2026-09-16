package azuremonitor

import (
	"net/http"
	"path"
	"regexp"
	"strings"
)

// The resource routes proxy requests with the datasource's Azure credentials attached, so
// anything reachable through them is executed with the datasource identity. Only the paths
// the plugin itself needs are proxied; everything else is denied.
//
// The allowed paths are derived from the frontend calls in
// public/app/plugins/datasource/azuremonitor (getResource/postResource and the config editor).
type allowedResourceRoute struct {
	pattern *regexp.Regexp
	methods []string
}

func (r allowedResourceRoute) allowsMethod(method string) bool {
	for _, m := range r.methods {
		if m == method {
			return true
		}
	}
	return false
}

// Azure resource IDs are subscription scoped and optionally continue into a resource group and
// a provider-specific resource path (e.g. /providers/Microsoft.Storage/storageAccounts/name).
const (
	subscriptionScope = `/subscriptions/[^/]+`
	resourceScope     = `(?:/resourcegroups/[^/]+(?:/providers/[^/]+(?:/[^/]+){1,8})?)?`
	// Log Analytics workspaces and Application Insights components are the only resources
	// whose data plane (metadata/query) is used by the plugin.
	logsResourceScope = `/subscriptions/[^/]+/resourcegroups/[^/]+/providers/microsoft\.(?:operationalinsights/workspaces|insights/components)/[^/]+`
)

func mustCompileRoute(pattern string, methods ...string) allowedResourceRoute {
	return allowedResourceRoute{pattern: regexp.MustCompile(`(?i)^` + pattern + `$`), methods: methods}
}

var allowedResourceRoutes = map[string][]allowedResourceRoute{
	// Azure Resource Manager. Read-only listings and metric metadata only.
	azureMonitor: {
		// Subscription, resource group and location listings (also used by the config editor).
		mustCompileRoute(`/subscriptions`, http.MethodGet),
		mustCompileRoute(subscriptionScope+`/(?:locations|resourcegroups)`, http.MethodGet),
		// Provider lookup (used to resolve supported API versions).
		mustCompileRoute(`/providers/[^/]+`, http.MethodGet),
		// Log Analytics workspace listing and table plan lookup.
		mustCompileRoute(subscriptionScope+`/providers/microsoft\.operationalinsights/workspaces`, http.MethodGet),
		mustCompileRoute(subscriptionScope+`/resourcegroups/[^/]+/providers/microsoft\.operationalinsights/workspaces/[^/]+/tables/[^/]+`, http.MethodGet),
		// Metric namespaces, metric definitions and metric values for a resource or subscription.
		mustCompileRoute(subscriptionScope+resourceScope+`/providers/microsoft\.insights/(?:metricnamespaces|metricdefinitions|metrics)`, http.MethodGet),
	},
	// Log Analytics data plane. Reads only; queries have to be POSTed.
	azureLogAnalytics: {
		mustCompileRoute(`/v1/metadata`, http.MethodGet),
		mustCompileRoute(`/v1`+logsResourceScope+`/metadata`, http.MethodGet),
		mustCompileRoute(`/v1/workspaces/[^/]+/metadata`, http.MethodGet),
		mustCompileRoute(`/v1/query`, http.MethodPost),
		mustCompileRoute(`/v1`+logsResourceScope+`/query`, http.MethodPost),
		mustCompileRoute(`/v1/workspaces/[^/]+/query`, http.MethodPost),
		// Handled by the Log Analytics executor, which rewrites it to /v1/query.
		mustCompileRoute(`/usage/basiclogs`, http.MethodPost),
	},
	// Resource Graph queries are POSTed to a single endpoint.
	azureResourceGraph: {
		mustCompileRoute(`/providers/microsoft\.resourcegraph/resources`, http.MethodPost),
	},
}

// validateResourceRequest reports whether the given resource path and method may be proxied.
// It returns an HTTP status code and message when the request must be rejected, and a zero
// status code when the request is allowed.
func validateResourceRequest(subDataSource string, resourcePath string, method string) (int, string) {
	if !isCleanResourcePath(resourcePath) {
		return http.StatusForbidden, "invalid path"
	}

	routes, ok := allowedResourceRoutes[subDataSource]
	if !ok {
		return http.StatusForbidden, "the requested service is not supported"
	}

	// Trailing slashes are not significant for the Azure APIs but would break matching.
	normalizedPath := strings.TrimSuffix(resourcePath, "/")
	if normalizedPath == "" {
		normalizedPath = "/"
	}

	matched := false
	for _, route := range routes {
		if !route.pattern.MatchString(normalizedPath) {
			continue
		}
		matched = true
		if route.allowsMethod(method) {
			return 0, ""
		}
	}

	if matched {
		return http.StatusMethodNotAllowed, "method not allowed for this path"
	}
	return http.StatusForbidden, "the requested path is not allowed"
}

// isCleanResourcePath rejects paths that are not absolute or that contain dot segments or
// empty segments, so that a caller cannot escape the allowlisted paths through traversal.
func isCleanResourcePath(resourcePath string) bool {
	if resourcePath == "" || !strings.HasPrefix(resourcePath, "/") {
		return false
	}
	if strings.Contains(resourcePath, "\\") {
		return false
	}
	trimmed := strings.TrimSuffix(resourcePath, "/")
	if trimmed == "" {
		return true
	}
	if path.Clean(trimmed) != trimmed {
		return false
	}
	for _, segment := range strings.Split(strings.TrimPrefix(trimmed, "/"), "/") {
		if segment == "" || segment == "." || segment == ".." {
			return false
		}
	}
	return true
}
