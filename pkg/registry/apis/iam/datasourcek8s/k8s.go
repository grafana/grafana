package datasourcek8s

import (
	"strings"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

// K8sDatasourceAPIGroup returns the k8s API group for a Grafana datasource type
func K8sDatasourceAPIGroup(dsType string) string {
	return dsType + K8sDatasourceAPIGroupSuffix
}

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

// LegacyUIDScopeToK8s builds a k8s-style datasource resource scope from the suffix of
// legacy scope "datasources:uid:<uid>"
func LegacyUIDScopeToK8s(dsType, uid string) string {
	return K8sDatasourceAPIGroup(dsType) + "/datasources:" + uid
}

// LegacyVerbToK8sAction maps the substring after legacy prefix "datasources:" to a Kubernetes API action.
// For unknown verbs, returns "datasources:" + legacyVerb unchanged.
func LegacyVerbToK8sAction(dsType, legacyVerb string) string {
	switch legacyVerb {
	case "query":
		return "query.grafana.app/query:create"
	case "read":
		return K8sDatasourceAPIGroup(dsType) + "/datasources:get"
	case "write":
		return K8sDatasourceAPIGroup(dsType) + "/datasources:update"
	case "delete":
		return K8sDatasourceAPIGroup(dsType) + "/datasources:delete"
	default:
		return "datasources:" + legacyVerb
	}
}

// legacyActionToK8s converts a legacy datasource action to its k8s form.
// It handles the resource-permissions actions (datasources.permissions:read/write)
// and the plain datasource verbs (datasources:read/write/…). Returns the converted
// action and whether a conversion was applied.
func legacyActionToK8s(dsType, action string) (string, bool) {
	if permVerb, ok := strings.CutPrefix(action, "datasources.permissions:"); ok {
		switch permVerb {
		case "read":
			return K8sDatasourceAPIGroup(dsType) + "/datasources:get_permissions", true
		case "write":
			return K8sDatasourceAPIGroup(dsType) + "/datasources:set_permissions", true
		default:
			return action, false
		}
	}
	legacyVerb, ok := strings.CutPrefix(action, "datasources:")
	if !ok || strings.Contains(legacyVerb, ":") {
		return action, false
	}
	return LegacyVerbToK8sAction(dsType, legacyVerb), true
}

// LegacyDatasourceAction replaces a legacy ds action string with its k8s form
func LegacyDatasourceAction(dsType string, action *string) {
	if converted, ok := legacyActionToK8s(dsType, *action); ok {
		*action = converted
	}
}

// LegacyDatasourceScopeAndActionToK8s converts legacy datasource scope and action to k8s form
func LegacyDatasourceScopeAndActionToK8s(datasourceType, scope, action string) (string, string) {
	kind, _, uid := accesscontrol.SplitScope(scope)
	if kind != "datasources" {
		return scope, action
	}
	if uid == "*" {
		// datasource type is not set for wildcard scopes, we use "*" instead
		datasourceType = "*"
	} else if datasourceType == "" {
		// TODO: datasource type is not set, this should be an error
		return scope, action
	}

	scope = LegacyUIDScopeToK8s(datasourceType, uid)
	if converted, ok := legacyActionToK8s(datasourceType, action); ok {
		action = converted
	}
	return scope, action
}
