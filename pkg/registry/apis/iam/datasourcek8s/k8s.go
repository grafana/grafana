package datasourcek8s

import "strings"

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

// LegacyDatasourceAction replaces a legacy ds action string with its k8s form
func LegacyDatasourceAction(dsType string, action *string) {
	legacyVerb, ok := strings.CutPrefix(*action, "datasources:")
	if !ok || strings.Contains(legacyVerb, ":") {
		return
	}
	*action = LegacyVerbToK8sAction(dsType, legacyVerb)
}

// LegacyDatasourceScopeAndActionToK8s converts legacy datasource scope and action to k8s form
func LegacyDatasourceScopeAndActionToK8s(datasourceType, scope, action string) (string, string) {
	if datasourceType == "" {
		return scope, action
	}
	if uid, ok := strings.CutPrefix(scope, "datasources:uid:"); ok {
		scope = LegacyUIDScopeToK8s(datasourceType, uid)
	}
	if legacyVerb, ok := strings.CutPrefix(action, "datasources:"); ok {
		action = LegacyVerbToK8sAction(datasourceType, legacyVerb)
	}
	return scope, action
}
