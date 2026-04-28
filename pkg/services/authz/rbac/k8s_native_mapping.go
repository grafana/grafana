package rbac

import "github.com/grafana/grafana/pkg/apimachinery/utils"

// k8sVerbMap maps K8s verbs to the canonical set of RBAC verbs used in K8s-native
// action strings. Multiple K8s verbs collapse to a single RBAC verb:
//
//	list, watch → get
//	patch       → update
//	deletecollection → delete
var k8sVerbMap = map[string]string{
	utils.VerbGet:              "get",
	utils.VerbList:             "get",
	utils.VerbWatch:            "get",
	utils.VerbCreate:           "create",
	utils.VerbUpdate:           "update",
	utils.VerbPatch:            "update",
	utils.VerbDelete:           "delete",
	utils.VerbDeleteCollection: "delete",
	utils.VerbGetPermissions:   "get_permissions",
	utils.VerbSetPermissions:   "set_permissions",
}

// k8sNativeMapping is a deterministic Mapping for resources not registered in the
// mapper. Actions follow the {group}/{resource}:{verb} format and all values are
// derived at call time from the group and resource name alone.
type k8sNativeMapping struct {
	group       string
	resource    string
	subresource string
}

func newK8sNativeMapping(group, resource, subresource string) Mapping {
	return &k8sNativeMapping{
		group:       group,
		resource:    resource,
		subresource: subresource,
	}
}

// Action returns the RBAC action for the given K8s verb in the format
// {group}/{resource}:{rbacVerb}.
func (m *k8sNativeMapping) Action(verb string) (string, bool) {
	v, ok := k8sVerbMap[verb]
	if !ok {
		return "", false
	}
	prefix := m.group + "/" + m.resource
	if m.subresource != "" {
		prefix += "/" + m.subresource
	}
	return prefix + ":" + v, true
}

// ActionSets returns nil; K8s-native resources have no legacy RBAC action sets.
// Can be challenged if we want to support (folders:admin, folders:edit, folders:view) action sets.
func (m *k8sNativeMapping) ActionSets(_ string) []string {
	return nil
}

// Scope returns the RBAC scope for the given resource instance name.
// Format: {resource}:uid:{name}
// Note: The subresource is not included in the scope, as the subresource applies to the resource itself.
func (m *k8sNativeMapping) Scope(name string) string {
	return m.group + "/" + m.resource + ":uid:" + name
}

// Prefix returns the scope prefix used for list queries.
// Format: {resource}:uid:
func (m *k8sNativeMapping) Prefix() string {
	return m.group + "/" + m.resource + ":uid:"
}

// AllActions returns the deduplicated set of RBAC actions for this resource.
func (m *k8sNativeMapping) AllActions() []string {
	prefix := m.group + "/" + m.resource
	if m.subresource != "" {
		prefix += "/" + m.subresource
	}

	seen := make(map[string]struct{}, len(k8sVerbMap))
	actions := make([]string, 0, len(k8sVerbMap))
	for _, v := range k8sVerbMap {
		action := prefix + ":" + v
		if _, ok := seen[action]; ok {
			continue
		}
		seen[action] = struct{}{}
		actions = append(actions, action)
	}
	return actions
}

// HasFolderSupport always returns true for K8s-native resources.
//
// Defaulting to true is the safe choice: if a resource does not live in a
// folder, the permission would not have been granted on any parent folder
// in the first place.
func (m *k8sNativeMapping) HasFolderSupport() bool {
	return true
}

// SkipScope always returns false; no verb skips scope checks by default.
func (m *k8sNativeMapping) SkipScope(_ string) bool {
	return false
}

// Resource returns the K8s resource name (without the group prefix).
func (m *k8sNativeMapping) Resource() string {
	return m.resource
}
