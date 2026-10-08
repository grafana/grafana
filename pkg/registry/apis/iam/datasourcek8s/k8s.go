package datasourcek8s

import (
	"strings"
)

const K8sDatasourceAPIGroupSuffix = ".datasource.grafana.app"

// DSTypeFromDatasourceAPIGroup returns the plugin type from a concrete datasource API group
// (e.g. "loki.datasource.grafana.app" → "loki"), or "" for non-datasource groups, wildcard groups,
// or multi-segment type prefixes (e.g. "foo.bar.datasource.grafana.app").
func DSTypeFromDatasourceAPIGroup(group string) string {
	typ, ok := strings.CutSuffix(group, K8sDatasourceAPIGroupSuffix)
	if !ok || typ == "" || strings.Contains(typ, ".") || strings.HasPrefix(typ, "*") {
		return ""
	}
	return typ
}

// AuthorizationGroup resolves datasource API aliases after the client token check.
// API routing and token grants must continue to use the original group.
func AuthorizationGroup(group, resource string) string {
	if resource == "datasources" && DSTypeFromDatasourceAPIGroup(group) != "" {
		return Group
	}
	return group
}

// Group identifies datasource resources in IAM, independent of their plugin type.
const Group = "datasource.grafana.app"

// AuthorizationResource resolves query API aliases to the datasource query subresource.
func AuthorizationResource(group, resource, subresource string) (string, string, string) {
	if (group == Group || group == "query.grafana.app") && resource == "query" && subresource == "" {
		return Group, "datasources", "query"
	}
	return AuthorizationGroup(group, resource), resource, subresource
}
