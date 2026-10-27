package azuremonitor

import (
	"net/http"
	"regexp"
	"strings"
)

// allowedResourcePaths enumerates the exact (method, path) shapes the
// frontend issues through the resource proxy (see url_builder.ts et al. in
// public/app/plugins/datasource/azuremonitor). Patterns anchor on the fixed
// trailing operation rather than the arbitrary resource-identity prefix --
// only the operation needs restricting.
var allowedResourcePaths = map[string][]struct {
	method  string
	pattern *regexp.Regexp
}{
	azureMonitor: {
		{http.MethodGet, regexp.MustCompile(`^/subscriptions$`)},
		{http.MethodGet, regexp.MustCompile(`^/subscriptions/[^/%]+/locations$`)},
		{http.MethodGet, regexp.MustCompile(`(?i)^/subscriptions/[^/%]+/providers/microsoft\.operationalinsights/workspaces$`)},
		{http.MethodGet, regexp.MustCompile(`(?i)^/subscriptions/[^%]+/providers/microsoft\.insights/metricnamespaces$`)},
		{http.MethodGet, regexp.MustCompile(`(?i)^/subscriptions/[^%]+/providers/microsoft\.insights/metricdefinitions$`)},
		{http.MethodGet, regexp.MustCompile(`(?i)^/subscriptions/[^%]+/providers/microsoft\.operationalinsights/workspaces/[^/%]+/tables/[^/%]+$`)},
	},
	azureLogAnalytics: {
		{http.MethodGet, regexp.MustCompile(`^/v1/metadata$`)},
		{http.MethodGet, regexp.MustCompile(`^/v1/subscriptions/[^%]+/metadata$`)},
		{http.MethodPost, regexp.MustCompile(`^/usage/basiclogs$`)},
	},
	azureResourceGraph: {
		{http.MethodPost, regexp.MustCompile(`(?i)^/providers/microsoft\.resourcegraph/resources$`)},
	},
}

// isAllowedResourcePath reports whether method+path (the ARM-side request,
// after the /azuremonitor|/loganalytics|/resourcegraph prefix has been
// stripped by getTarget, and without its query string) is one of the calls
// the datasource is designed to make on subDataSource. path is
// req.URL.Path, already percent-decoded once by net/http.
func isAllowedResourcePath(subDataSource, method, path string) bool {
	// "%" can only be an escaped escape here (net/http decodes once);
	// reject so nothing downstream double-decodes it.
	if strings.Contains(path, "%") {
		return false
	}
	// Empty segments come from empty/malformed template variables.
	if strings.Contains(path, "//") {
		return false
	}
	// ServeMux only redirects a literal ".." in the raw target, not a
	// percent-encoded one, so a literal ".." can still reach here.
	for _, segment := range strings.Split(path, "/") {
		if segment == "." || segment == ".." {
			return false
		}
	}

	for _, allowed := range allowedResourcePaths[subDataSource] {
		if allowed.method == method && allowed.pattern.MatchString(path) {
			return true
		}
	}
	return false
}
