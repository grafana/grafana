package common

import (
	"strings"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

type grantActionMapping struct {
	actions []string
}

type grantLookupKey struct {
	objectType  string
	relation    string
	group       string
	resource    string
	subresource string
}

var grantReverseMap map[grantLookupKey]grantActionMapping

func init() {
	grantReverseMap = make(map[grantLookupKey]grantActionMapping)

	for _, translation := range resourceTranslations {
		for action, m := range translation.mapping {
			group := translation.group
			resource := translation.resource
			if m.group != "" && m.resource != "" {
				group = m.group
				resource = m.resource
			}

			// Wildcard and unscoped grants are stored on group_resource tuples.
			addGrantReverseMapping(grantLookupKey{
				objectType:  TypeGroupResouce,
				relation:    m.relation,
				group:       group,
				resource:    resource,
				subresource: m.subresource,
			}, action)

			switch translation.typ {
			case TypeResource:
				addGrantReverseMapping(grantLookupKey{
					objectType: TypeResource,
					relation:   m.relation,
					group:      group,
					resource:   resource,
				}, action)
			case TypeFolder:
				if m.group == "" && m.resource == "" {
					addGrantReverseMapping(grantLookupKey{
						objectType: TypeFolder,
						relation:   m.relation,
					}, action)
				}
				if m.group != "" && m.resource != "" {
					addGrantReverseMapping(grantLookupKey{
						objectType: TypeFolder,
						relation:   SubresourceRelation(m.relation),
						group:      group,
						resource:   resource,
					}, action)
					addGrantReverseMapping(grantLookupKey{
						objectType: TypeFolder,
						relation:   SubresourceRelation(m.relation),
					}, action)
				}
			default:
				addGrantReverseMapping(grantLookupKey{
					objectType: translation.typ,
					relation:   m.relation,
				}, action)
			}
		}
	}
}

func addGrantReverseMapping(key grantLookupKey, action string) {
	entry := grantReverseMap[key]
	entry.actions = appendUnique(entry.actions, action)
	grantReverseMap[key] = entry
}

func appendUnique(actions []string, action string) []string {
	for _, a := range actions {
		if a == action {
			return actions
		}
	}
	return append(actions, action)
}

// GrantScope describes the legacy RBAC scope for a grant tuple.
type GrantScope struct {
	Kind       string
	Identifier string
}

// GrantPermission is a legacy RBAC permission derived from a Zanzana grant tuple.
type GrantPermission struct {
	Action string
	Scope  GrantScope
}

// grResource is a (group, resource, subresource) triple a grant tuple applies to.
type grResource struct {
	group       string
	resource    string
	subresource string
}

// TranslateGrantTuple maps a stored grant tuple to legacy RBAC permissions. A single
// tuple can yield several permissions: an action set expands to multiple actions, and a
// folder-resource tuple whose subresource_filter lists several group_resources applies to
// each of them.
func TranslateGrantTuple(tuple *authzextv1.TupleKey) []GrantPermission {
	if tuple == nil {
		return nil
	}

	objectType, objectName, _ := SplitTupleObject(tuple.GetObject())
	if objectType == "" {
		return nil
	}

	relation := tuple.GetRelation()
	instanceName := grantInstanceName(objectType, tuple.GetObject(), objectName)
	candidates := grantCandidates(objectType, tuple.GetObject(), tuple)

	seen := make(map[GrantPermission]struct{})
	var out []GrantPermission
	appendActions := func(gr grResource) {
		actions := lookupGrantActions(grantLookupKey{
			objectType:  objectType,
			relation:    relation,
			group:       gr.group,
			resource:    gr.resource,
			subresource: gr.subresource,
		})
		if len(actions) == 0 {
			return
		}
		scope := grantScopeForObject(objectType, gr.group, gr.resource, instanceName)
		for _, action := range actions {
			gp := GrantPermission{Action: action, Scope: scope}
			if _, dup := seen[gp]; dup {
				continue
			}
			seen[gp] = struct{}{}
			out = append(out, gp)
		}
	}

	if len(candidates) == 0 {
		// Typed objects (folder/team direct relations) carry no group/resource.
		appendActions(grResource{})
		return out
	}
	for _, c := range candidates {
		appendActions(c)
	}
	return out
}

func lookupGrantActions(key grantLookupKey) []string {
	if actions, ok := grantReverseMap[key]; ok {
		return actions.actions
	}
	if key.objectType == TypeFolder && (key.group != "" || key.resource != "") {
		fallback := key
		fallback.group = ""
		fallback.resource = ""
		fallback.subresource = ""
		if actions, ok := grantReverseMap[fallback]; ok {
			return actions.actions
		}
	}
	return nil
}

// grantInstanceName returns the instance UID a grant tuple targets, for the object types
// that have one (resource instances and folder/team typed objects). group_resource tuples
// are type-wide and have no instance.
func grantInstanceName(objectType, object, objectName string) string {
	switch objectType {
	case TypeResource:
		_, _, _, name := parseResourceObject(object)
		return name
	case TypeFolder, TypeTeam, TypeUser, TypeServiceAccount:
		return objectName
	default:
		return ""
	}
}

// grantCandidates returns the group_resources a grant tuple applies to. Conditions take
// precedence (resource tuples carry group_filter; folder-resource tuples carry
// subresource_filter, possibly with several entries). group_resource and resource objects
// otherwise embed their group/resource in the object string. Folder/team typed objects
// have none, returning an empty slice.
func grantCandidates(objectType, object string, tuple *authzextv1.TupleKey) []grResource {
	if cands := grantConditionResources(tuple); len(cands) > 0 {
		return cands
	}
	switch objectType {
	case TypeGroupResouce:
		return []grResource{parseGroupResourceObject(object)}
	case TypeResource:
		gr, _ := parseResourceObjectGR(object)
		return []grResource{gr}
	default:
		return nil
	}
}

func grantConditionResources(tuple *authzextv1.TupleKey) []grResource {
	cond := tuple.GetCondition()
	if cond == nil || cond.GetContext() == nil {
		return nil
	}
	fields := cond.GetContext().GetFields()

	switch cond.GetName() {
	case "group_filter":
		if gr, ok := parseGroupResourceString(fields["group_resource"].GetStringValue()); ok {
			return []grResource{gr}
		}
	case "subresource_filter":
		list := fields["subresources"].GetListValue()
		if list == nil {
			return nil
		}
		out := make([]grResource, 0, len(list.GetValues()))
		for _, v := range list.GetValues() {
			if gr, ok := parseGroupResourceString(v.GetStringValue()); ok {
				out = append(out, gr)
			}
		}
		return out
	}
	return nil
}

func parseGroupResourceString(gr string) (grResource, bool) {
	if gr == "" {
		return grResource{}, false
	}
	parts := strings.Split(gr, "/")
	switch len(parts) {
	case 1:
		return grResource{group: parts[0]}, true
	case 2:
		return grResource{group: parts[0], resource: parts[1]}, true
	default:
		return grResource{group: parts[0], resource: parts[1], subresource: strings.Join(parts[2:], "/")}, true
	}
}

func parseGroupResourceObject(object string) grResource {
	gr, _ := parseGroupResourceString(strings.TrimPrefix(object, TypeGroupResoucePrefix))
	return gr
}

// parseResourceObjectGR parses "resource:<group>/<resource>[/<subresource>]/<name>",
// returning the group_resource triple and the instance name.
func parseResourceObjectGR(object string) (grResource, string) {
	gr, name, _ := splitResourceObject(object)
	return gr, name
}

func parseResourceObject(object string) (group, resource, subresource, name string) {
	gr, n, ok := splitResourceObject(object)
	if !ok {
		return "", "", "", ""
	}
	return gr.group, gr.resource, gr.subresource, n
}

func splitResourceObject(object string) (grResource, string, bool) {
	grName := strings.TrimPrefix(object, TypeResourcePrefix)
	lastSlash := strings.LastIndex(grName, "/")
	if lastSlash == -1 {
		return grResource{}, "", false
	}
	name := grName[lastSlash+1:]
	gr, ok := parseGroupResourceString(grName[:lastSlash])
	return gr, name, ok
}

func grantScopeForObject(objectType, group, resource, instanceName string) GrantScope {
	switch objectType {
	case TypeGroupResouce:
		if resource == "" {
			return GrantScope{Kind: group, Identifier: "*"}
		}
		return GrantScope{Kind: resource, Identifier: "*"}
	case TypeResource:
		return GrantScope{Kind: resource, Identifier: instanceName}
	case TypeFolder:
		return GrantScope{Kind: KindFolders, Identifier: instanceName}
	case TypeTeam:
		return GrantScope{Kind: KindTeams, Identifier: instanceName}
	case TypeUser:
		return GrantScope{Kind: KindUsers, Identifier: instanceName}
	case TypeServiceAccount:
		return GrantScope{Kind: KindServiceAccounts, Identifier: instanceName}
	default:
		return GrantScope{}
	}
}

// FormatGrantScope renders a GrantScope as a legacy RBAC scope string.
func FormatGrantScope(scope GrantScope) string {
	if scope.Identifier == "*" {
		return scope.Kind + ":*"
	}
	return scope.Kind + ":uid:" + scope.Identifier
}
