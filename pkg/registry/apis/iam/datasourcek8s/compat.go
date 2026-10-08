package datasourcek8s

import "strings"

// LegacyPermission converts the datasource action/scope pairs persisted by older
// IAM APIs. Callers may use it while reading permissions; only update admission
// persists the conversion. Unknown or malformed pairs are left for validation.
func LegacyPermission(action, scope string) (string, string) {
	if scope == "" {
		// Only migrate creation across all datasource types; a plugin-specific
		// capability cannot be expressed by the shared legacy create action.
		if action == Group+"/datasources:create" || action == "*"+K8sDatasourceAPIGroupSuffix+"/datasources:create" {
			return "datasources:create", ""
		}
		return action, scope
	}
	scopeGroup, rest, ok := strings.Cut(scope, "/datasources:")
	if !ok || !isPermissionGroup(scopeGroup) {
		return action, scope
	}
	var legacyScope string
	if rest == "*" || rest == "uid:*" {
		// A concrete plugin wildcard is narrower than datasources:*.
		// Leave it unchanged so admission rejects it for manual migration.
		if scopeGroup != Group && scopeGroup != "*"+K8sDatasourceAPIGroupSuffix {
			return action, scope
		}
		legacyScope = "datasources:*"
	} else if uid, ok := strings.CutPrefix(rest, "uid:"); ok && uid != "" {
		legacyScope = "datasources:uid:" + uid
	} else {
		return action, scope
	}

	if action == "query.grafana.app/query:create" {
		return "datasources:query", legacyScope
	}
	actionGroup, resourceVerb, ok := strings.Cut(action, "/")
	if !ok || !isPermissionGroup(actionGroup) {
		return action, scope
	}
	// Do not turn a mismatched plugin action/scope into a usable permission.
	if actionGroup != scopeGroup && actionGroup != "*"+K8sDatasourceAPIGroupSuffix {
		return action, scope
	}
	var legacyAction string
	switch resourceVerb {
	case "datasources:get", "datasources:list", "datasources:watch":
		legacyAction = "datasources:read"
	case "datasources:create":
		// Legacy create ignores scope, so preserve grants restricted to a UID.
		if legacyScope != "datasources:*" {
			return action, scope
		}
		legacyAction = "datasources:create"
	case "datasources:update", "datasources:patch":
		legacyAction = "datasources:write"
	case "datasources:delete":
		legacyAction = "datasources:delete"
	case "datasources:get_permissions":
		legacyAction = "datasources.permissions:read"
	case "datasources:set_permissions":
		legacyAction = "datasources.permissions:write"
	case "datasources/query:create":
		legacyAction = "datasources:query"
	case "datasources/caching:get", "datasources/caching:list", "datasources/caching:watch":
		legacyAction = "datasources.caching:read"
	case "datasources/caching:update", "datasources/caching:patch":
		legacyAction = "datasources.caching:write"
	default:
		return action, scope
	}
	return legacyAction, legacyScope
}

func isPermissionGroup(group string) bool {
	return group == Group || group == "*"+K8sDatasourceAPIGroupSuffix || DSTypeFromDatasourceAPIGroup(group) != ""
}
