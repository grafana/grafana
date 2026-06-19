package common

import (
	"strings"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

// TupleScopeKind describes how a stored tuple maps to a legacy RBAC scope.
type TupleScopeKind int

const (
	TupleScopeFolderOwn TupleScopeKind = iota
	TupleScopeFolderDashboard
	TupleScopeDirectDashboard
	TupleScopeWildcardFolder
	TupleScopeWildcardDashboard
)

// MappedTuplePermission is one legacy permission derived from a stored tuple.
type MappedTuplePermission struct {
	Action string
	Scope  string
}

type tupleMappingKey struct {
	objectType string
	relation   string
	groupRes   string // set for folder-scoped dashboard tuples; empty otherwise
}

var (
	folderGroupResource    = FormatGroupResource(folderGroup, folderResource, "")
	dashboardGroupResource = FormatGroupResource(dashboardGroup, dashboardResource, "")
	storedTupleToActions   map[tupleMappingKey][]string
)

func init() {
	storedTupleToActions = buildStoredTupleToActions()
}

func buildStoredTupleToActions() map[tupleMappingKey][]string {
	out := make(map[tupleMappingKey][]string)

	add := func(key tupleMappingKey, action string) {
		out[key] = append(out[key], action)
	}

	for _, kind := range []string{KindFolders, KindDashboards} {
		translation := resourceTranslations[kind]
		for action, m := range translation.mapping {
			switch translation.typ {
			case TypeFolder:
				if m.group != "" && m.resource != "" {
					gr := FormatGroupResource(m.group, m.resource, m.subresource)
					key := tupleMappingKey{
						objectType: TypeFolder,
						relation:   SubresourceRelation(m.relation),
						groupRes:   gr,
					}
					add(key, action)
					// Action-set subresource relations are stored without a condition.
					if isSubresourceRelationSet(SubresourceRelation(m.relation)) {
						keyNoCond := tupleMappingKey{
							objectType: TypeFolder,
							relation:   SubresourceRelation(m.relation),
						}
						add(keyNoCond, action)
					}
				} else {
					key := tupleMappingKey{
						objectType: TypeFolder,
						relation:   m.relation,
					}
					add(key, action)
				}
			case TypeResource:
				key := tupleMappingKey{
					objectType: TypeResource,
					relation:   m.relation,
				}
				add(key, action)
			}
		}
	}

	// Org-wide wildcards on group_resource objects.
	for _, kind := range []string{KindFolders, KindDashboards} {
		translation := resourceTranslations[kind]
		for action, m := range translation.mapping {
			gr := FormatGroupResource(translation.group, translation.resource, m.subresource)
			if m.group != "" && m.resource != "" {
				gr = FormatGroupResource(m.group, m.resource, m.subresource)
			}
			key := tupleMappingKey{
				objectType: TypeGroupResouce,
				relation:   m.relation,
				groupRes:   gr,
			}
			add(key, action)
		}
	}

	return out
}

func subresourceFilterMatches(condition *authzextv1.RelationshipCondition, wantGR string) bool {
	if condition == nil || wantGR == "" {
		return true
	}
	if condition.GetName() != "subresource_filter" {
		return false
	}
	fields := condition.GetContext().GetFields()
	subresources, ok := fields["subresources"]
	if !ok {
		return false
	}
	for _, v := range subresources.GetListValue().GetValues() {
		if v.GetStringValue() == wantGR {
			return true
		}
	}
	return false
}

func groupFilterMatches(condition *authzextv1.RelationshipCondition, wantGR string) bool {
	if condition == nil || wantGR == "" {
		return true
	}
	if condition.GetName() != "group_filter" {
		return false
	}
	fields := condition.GetContext().GetFields()
	gr, ok := fields["group_resource"]
	if !ok {
		return false
	}
	return gr.GetStringValue() == wantGR
}

func lookupStoredActions(objectType, relation, groupRes string) []string {
	if groupRes != "" {
		if actions, ok := storedTupleToActions[tupleMappingKey{objectType: objectType, relation: relation, groupRes: groupRes}]; ok {
			return actions
		}
	}
	return storedTupleToActions[tupleMappingKey{objectType: objectType, relation: relation}]
}

// PermissionsFromStoredTuple maps a physically stored OpenFGA tuple to legacy RBAC permissions.
// Returns false when the tuple is not a supported permission grant (e.g. folder parent edges).
func PermissionsFromStoredTuple(object, relation string, condition *authzextv1.RelationshipCondition) ([]MappedTuplePermission, bool) {
	switch {
	case strings.HasPrefix(object, TypeFolderPrefix):
		uid := strings.TrimPrefix(object, TypeFolderPrefix)
		if uid == "" || relation == RelationParent {
			return nil, false
		}
		if strings.HasPrefix(relation, "resource_") {
			actions := lookupStoredActions(TypeFolder, relation, dashboardGroupResource)
			if len(actions) == 0 {
				actions = lookupStoredActions(TypeFolder, relation, "")
			}
			if len(actions) == 0 {
				return nil, false
			}
			if condition != nil && !isSubresourceRelationSet(relation) && !subresourceFilterMatches(condition, dashboardGroupResource) {
				return nil, false
			}
			return appendMapped(actions, uid, TupleScopeFolderDashboard), true
		}
		actions := lookupStoredActions(TypeFolder, relation, "")
		if len(actions) == 0 {
			return nil, false
		}
		return appendMapped(actions, uid, TupleScopeFolderOwn), true

	case strings.HasPrefix(object, TypeResourcePrefix):
		rest := strings.TrimPrefix(object, TypeResourcePrefix)
		parts := strings.Split(rest, "/")
		if len(parts) < 3 {
			return nil, false
		}
		uid := parts[len(parts)-1]
		gr := strings.Join(parts[:len(parts)-1], "/")
		actions := lookupStoredActions(TypeResource, relation, "")
		if len(actions) == 0 || !groupFilterMatches(condition, gr) {
			return nil, false
		}
		return appendMapped(actions, uid, TupleScopeDirectDashboard), true

	case strings.HasPrefix(object, TypeGroupResoucePrefix):
		gr := strings.TrimPrefix(object, TypeGroupResoucePrefix)
		actions := lookupStoredActions(TypeGroupResouce, relation, gr)
		if len(actions) == 0 {
			return nil, false
		}
		switch gr {
		case folderGroupResource:
			return appendMapped(actions, "", TupleScopeWildcardFolder), true
		case dashboardGroupResource:
			return appendWildcardDashboard(actions), true
		default:
			return nil, false
		}
	default:
		return nil, false
	}
}

func appendMapped(actions []string, uid string, kind TupleScopeKind) []MappedTuplePermission {
	out := make([]MappedTuplePermission, 0, len(actions))
	scope := legacyScope(kind, uid)
	for _, action := range actions {
		out = append(out, MappedTuplePermission{Action: action, Scope: scope})
	}
	return out
}

func appendWildcardDashboard(actions []string) []MappedTuplePermission {
	var out []MappedTuplePermission
	seen := make(map[string]struct{})
	for _, action := range actions {
		scopes := wildcardPermissionsForDashboardAction(action)
		if len(scopes) == 0 {
			out = append(out, MappedTuplePermission{Action: action, Scope: legacyScope(TupleScopeWildcardDashboard, "")})
			continue
		}
		for _, s := range scopes {
			key := action + "\x00" + s
			if _, ok := seen[key]; ok {
				continue
			}
			seen[key] = struct{}{}
			out = append(out, MappedTuplePermission{Action: action, Scope: s})
		}
	}
	return out
}

func legacyScope(kind TupleScopeKind, uid string) string {
	switch kind {
	case TupleScopeFolderOwn, TupleScopeFolderDashboard:
		return scope("folders", "uid", uid)
	case TupleScopeDirectDashboard:
		return scope("dashboards", "uid", uid)
	case TupleScopeWildcardFolder:
		return scope("folders", "*")
	case TupleScopeWildcardDashboard:
		return scope("dashboards", "*")
	default:
		return ""
	}
}

func scope(parts ...string) string {
	return strings.Join(parts, ":")
}

func wildcardPermissionsForDashboardAction(action string) []string {
	if !strings.HasPrefix(action, "dashboards:") {
		return nil
	}
	return []string{"*", scope("dashboards", "*"), scope("folders", "*")}
}

// LegacyScope builds the legacy RBAC scope string for a mapped permission kind.
// Deprecated: scopes are populated on MappedTuplePermission directly.
func LegacyScope(kind TupleScopeKind, uid string) string {
	return legacyScope(kind, uid)
}

// WildcardPermissionsForDashboardAction returns extra wildcard scopes emitted for org-wide
// dashboard grants, mirroring listPermissions when resp.All is true.
func WildcardPermissionsForDashboardAction(action string) []string {
	return wildcardPermissionsForDashboardAction(action)
}
