// Package namespacedgroups recognizes namespaced groups, <name>.<namespace>.<owner>,
// which a plugin serves at runtime for one namespace only (see pkg/router,
// namespaced_groups). It has few dependencies, so that unified storage and
// the plugin route authorizer can use it.
package namespacedgroups

import "strings"

// pluginGroupSuffix is the suffix of the groups a namespaced group's owner
// may have.
const pluginGroupSuffix = ".ext.grafana.app"

// Owner returns the owner group of a namespaced group, <name>.<namespace>.<owner>,
// when its namespace label is namespace.
//
// The owner is a single label followed by .ext.grafana.app, and the namespace
// is the label before it. A namespaced group is created at runtime, for one
// namespace only, so no token's permissions can name it in advance: service
// permissions reach it through its owner instead (CheckServicePermissions).
// Requiring the group to name the namespace it is checked in keeps one
// namespace's grant from reaching another namespace's groups, and leaves every
// group that does not name the request's namespace on its own permissions. An
// empty or wildcard namespace never matches.
//
// It applies to every group of this form, since neither storage nor the plugin
// route authorizer has the configuration of which owners serve namespaced
// groups, nor knows which plugin serves a group. The router, the only server of
// plugin groups, keeps any other plugin from serving a group under an owner of
// its namespaced groups (pkg/router namespacedOwnerOf), so their kinds are
// never authorized through the owner.
func Owner(group, namespace string) (string, bool) {
	if namespace == "" || namespace == "*" {
		return "", false
	}
	rest, ok := strings.CutSuffix(group, pluginGroupSuffix)
	if !ok {
		return "", false
	}
	rest, owner, ok := cutLastLabel(rest)
	if !ok || owner == "" {
		return "", false
	}
	name, ns, ok := cutLastLabel(rest)
	if !ok || name == "" || ns != namespace {
		return "", false
	}
	return owner + pluginGroupSuffix, true
}

// cutLastLabel splits s at its last dot.
func cutLastLabel(s string) (before, last string, ok bool) {
	dot := strings.LastIndexByte(s, '.')
	if dot < 0 {
		return "", "", false
	}
	return s[:dot], s[dot+1:], true
}
