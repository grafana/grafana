package datasourcek8s

import "strings"

const K8sDatasourceAPIGroupSuffix = ".datasource.grafana.app"

// K8sDSActionToLegacy converts a k8s datasource-related action to legacy RBAC form
// (e.g. query.grafana.app/query:create → datasources:query).
func K8sDSActionToLegacy(action string) (string, bool) {
	if action == "query.grafana.app/query:create" {
		return "datasources:query", true
	}

	group, resourceVerb, ok := strings.Cut(action, "/")
	if !ok {
		return "", false
	}
	_, ok = strings.CutSuffix(group, K8sDatasourceAPIGroupSuffix)
	if !ok {
		return "", false
	}
	resource, verb, ok := strings.Cut(resourceVerb, ":")
	if !ok || resource != "datasources" || verb == "" {
		return "", false
	}
	switch verb {
	case "get", "list", "watch":
		return "datasources:read", true
	case "create", "update", "patch":
		return "datasources:write", true
	case "delete":
		return "datasources:delete", true
	default:
		return "", false
	}
}

// DSUIDScopeToLegacy converts a k8s datasource instance scope to legacy datasources:uid:
// and returns the datasource type (e.g. "loki", or "*" for wildcard groups).
func K8sDSUIDScopeToLegacy(scope string) (legacyScope, dsType string, ok bool) {
	group, resourceUID, ok := strings.Cut(scope, "/")
	if !ok {
		return "", "", false
	}
	resource, uid, ok := strings.Cut(resourceUID, ":")
	if !ok || resource != "datasources" || uid == "" {
		return "", "", false
	}
	dsType, ok = strings.CutSuffix(group, K8sDatasourceAPIGroupSuffix)
	if !ok || dsType == "" {
		return "", "", false
	}
	return "datasources:uid:" + uid, dsType, true
}
