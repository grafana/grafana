package common

import (
	"slices"
	"sort"

	authlib "github.com/grafana/authlib/types"

	dashboards "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
)

const (
	roleGrafanaAdmin = "Grafana Admin"
	roleAdmin        = "Admin"
	roleEditor       = "Editor"
	roleViewer       = "Viewer"
	roleNone         = "None"
)

var basicRolesTranslations = map[string]string{
	roleGrafanaAdmin: "basic_grafana_admin",
	roleAdmin:        "basic_admin",
	roleEditor:       "basic_editor",
	roleViewer:       "basic_viewer",
	roleNone:         "basic_none",
}

var basicRolesUIDs = []string{
	"basic_grafana_admin",
	"basic_admin",
	"basic_editor",
	"basic_viewer",
	"basic_none",
}

type resourceTranslation struct {
	typ      string
	group    string
	resource string
	mapping  map[string]actionMapping
}

type actionMapping struct {
	relation    string
	group       string
	resource    string
	subresource string
	// skipScope marks actions that are valid without a scope (e.g. create verbs).
	// TranslateToResourceTuple treats these as wildcard when kind/name are empty.
	skipScope bool
}

func newMapping(relation, subresource string) actionMapping {
	return newScopedMapping(relation, "", "", subresource)
}

func newUnscopedMapping(relation string) actionMapping {
	return actionMapping{relation: relation, skipScope: true}
}

func newScopedMapping(relation, group, resource, subresource string) actionMapping {
	return actionMapping{relation: relation, group: group, resource: resource, subresource: subresource}
}

// SubresourceAnnotations is the dashboards subresource that gates the legacy
// annotations:* actions (mirrors "dashboards/annotations" in the RBAC mapper).
const SubresourceAnnotations = "annotations"

var (
	folderGroup    = folders.FolderResourceInfo.GroupResource().Group
	folderResource = folders.FolderResourceInfo.GroupResource().Resource

	dashboardGroup    = dashboards.DashboardResourceInfo.GroupResource().Group
	dashboardResource = dashboards.DashboardResourceInfo.GroupResource().Resource

	iamGroup      = iamv0.TeamResourceInfo.GroupResource().Group
	teamsResource = iamv0.TeamResourceInfo.GroupResource().Resource
	usersResource = iamv0.UserResourceInfo.GroupResource().Resource
)

var resourceTranslations = map[string]resourceTranslation{
	KindFolders: {
		typ:      TypeFolder,
		group:    folderGroup,
		resource: folderResource,
		mapping: map[string]actionMapping{
			"folders:read":      newMapping(RelationGet, ""),
			"folders:write":     newMapping(RelationUpdate, ""),
			"folders:create":    newMapping(RelationCreate, ""),
			"folders:delete":    newMapping(RelationDelete, ""),
			"dashboards:read":   newScopedMapping(RelationGet, dashboardGroup, dashboardResource, ""),
			"dashboards:write":  newScopedMapping(RelationUpdate, dashboardGroup, dashboardResource, ""),
			"dashboards:create": newScopedMapping(RelationCreate, dashboardGroup, dashboardResource, ""),
			"dashboards:delete": newScopedMapping(RelationDelete, dashboardGroup, dashboardResource, ""),
			// Permission management
			"folders.permissions:read":     newMapping(RelationGetPermissions, ""),
			"folders.permissions:write":    newMapping(RelationSetPermissions, ""),
			"dashboards.permissions:read":  newScopedMapping(RelationGetPermissions, dashboardGroup, dashboardResource, ""),
			"dashboards.permissions:write": newScopedMapping(RelationSetPermissions, dashboardGroup, dashboardResource, ""),
			// Dashboard annotations, modeled as the dashboards/annotations subresource
			// (mirrors the RBAC mapper). Legacy folder view/edit/admin action sets pair
			// these with the dashboard actions on the same folder scope.
			"annotations:read":   newScopedMapping(RelationGet, dashboardGroup, dashboardResource, SubresourceAnnotations),
			"annotations:write":  newScopedMapping(RelationUpdate, dashboardGroup, dashboardResource, SubresourceAnnotations),
			"annotations:create": newScopedMapping(RelationCreate, dashboardGroup, dashboardResource, SubresourceAnnotations),
			"annotations:delete": newScopedMapping(RelationDelete, dashboardGroup, dashboardResource, SubresourceAnnotations),
			// Action sets
			"folders:view":     newMapping(RelationSetView, ""),
			"folders:edit":     newMapping(RelationSetEdit, ""),
			"folders:admin":    newMapping(RelationSetAdmin, ""),
			"dashboards:view":  newScopedMapping(RelationSetView, dashboardGroup, dashboardResource, ""),
			"dashboards:edit":  newScopedMapping(RelationSetEdit, dashboardGroup, dashboardResource, ""),
			"dashboards:admin": newScopedMapping(RelationSetAdmin, dashboardGroup, dashboardResource, ""),
		},
	},
	KindDashboards: {
		typ:      TypeResource,
		group:    dashboardGroup,
		resource: dashboardResource,
		mapping: map[string]actionMapping{
			"dashboards:read":   newMapping(RelationGet, ""),
			"dashboards:write":  newMapping(RelationUpdate, ""),
			"dashboards:create": newMapping(RelationCreate, ""),
			"dashboards:delete": newMapping(RelationDelete, ""),
			// Permission management
			"dashboards.permissions:read":  newMapping(RelationGetPermissions, ""),
			"dashboards.permissions:write": newMapping(RelationSetPermissions, ""),
			// Dashboard annotations (dashboards/annotations subresource); legacy dashboard
			// view/edit/admin action sets pair these with the dashboard actions.
			"annotations:read":   newMapping(RelationGet, SubresourceAnnotations),
			"annotations:write":  newMapping(RelationUpdate, SubresourceAnnotations),
			"annotations:create": newMapping(RelationCreate, SubresourceAnnotations),
			"annotations:delete": newMapping(RelationDelete, SubresourceAnnotations),
			// Action sets
			"dashboards:view":  newMapping(RelationSetView, ""),
			"dashboards:edit":  newMapping(RelationSetEdit, ""),
			"dashboards:admin": newMapping(RelationSetAdmin, ""),
		},
	},
	KindTeams: {
		typ:      TypeTeam,
		group:    iamGroup,      // "iam.grafana.app"
		resource: teamsResource, // "teams"
		mapping: map[string]actionMapping{
			"teams:read":              newMapping(RelationGet, ""),
			"teams:write":             newMapping(RelationUpdate, ""),
			"teams:create":            newUnscopedMapping(RelationCreate),
			"teams:delete":            newMapping(RelationDelete, ""),
			"teams.permissions:read":  newMapping(RelationGetPermissions, ""),
			"teams.permissions:write": newMapping(RelationSetPermissions, ""),
		},
	},
	KindUsers: {
		typ:      TypeUser,
		group:    iamGroup,      // "iam.grafana.app"
		resource: usersResource, // "users"
		mapping: map[string]actionMapping{
			"users:read":              newMapping(RelationGet, ""),
			"users:write":             newMapping(RelationUpdate, ""),
			"users:create":            newUnscopedMapping(RelationCreate),
			"users:delete":            newMapping(RelationDelete, ""),
			"users.permissions:read":  newMapping(RelationGetPermissions, ""),
			"users.permissions:write": newMapping(RelationSetPermissions, ""),
			// The org.users:* family gates the same iam.grafana.app/users verbs as the
			// global users:* family (see userManagementMappings in tuple_helpers.go).
			// org.users:add is intentionally omitted, matching the write-side mapping.
			"org.users:read":   newMapping(RelationGet, ""),
			"org.users:write":  newMapping(RelationUpdate, ""),
			"org.users:remove": newMapping(RelationDelete, ""),
		},
	},
}

func TranslateToCheckRequest(namespace, action, kind, name string) (*authlib.CheckRequest, bool) {
	translation, ok := resourceTranslations[kind]

	if !ok {
		return nil, false
	}

	m, ok := translation.mapping[action]
	if !ok {
		return nil, false
	}

	verb, ok := RelationToVerbMapping[m.relation]
	if !ok {
		return nil, false
	}

	req := &authlib.CheckRequest{
		Namespace:   namespace,
		Verb:        verb,
		Group:       translation.group,
		Resource:    translation.resource,
		Subresource: m.subresource,
		Name:        name,
	}

	return req, true
}

func TranslateToListRequest(namespace, action, kind string) (*authlib.ListRequest, bool) {
	translation, ok := resourceTranslations[kind]

	if !ok {
		return nil, false
	}

	// FIXME: support different verbs
	req := &authlib.ListRequest{
		Namespace: namespace,
		Group:     translation.group,
		Resource:  translation.resource,
	}

	return req, true
}

func TranslateToGroupResource(kind string) string {
	translation, ok := resourceTranslations[kind]
	if !ok {
		return ""
	}
	return FormatGroupResource(translation.group, translation.resource, "")
}

func TranslateBasicRole(name string) string {
	return basicRolesTranslations[name]
}

func IsBasicRole(name string) bool {
	return slices.Contains(basicRolesUIDs, name)
}

func actionListParams(translation resourceTranslation, m actionMapping) (group, resource, subresource, verb string, ok bool) {
	group = translation.group
	resource = translation.resource
	if m.group != "" && m.resource != "" {
		group = m.group
		resource = m.resource
	}

	verb, ok = RelationToVerbMapping[m.relation]
	if !ok {
		return "", "", "", "", false
	}

	return group, resource, m.subresource, verb, true
}

// TranslateActionToListParams translates an RBAC action to Zanzana List request parameters
// (group, resource, subresource, verb). Returns empty strings if the action cannot be translated.
func TranslateActionToListParams(action string) (group, resource, subresource, verb string) {
	translationTypes := make([]string, 0, len(resourceTranslations))
	for typ := range resourceTranslations {
		translationTypes = append(translationTypes, typ)
	}
	sort.Strings(translationTypes)

	for _, typ := range translationTypes {
		translation := resourceTranslations[typ]
		if m, ok := translation.mapping[action]; ok {
			group, resource, subresource, verb, ok := actionListParams(translation, m)
			if !ok {
				return "", "", "", ""
			}
			return group, resource, subresource, verb
		}
	}
	return "", "", "", ""
}

// ActionListEntry describes an action that Zanzana supports, along with
// its List request parameters.
type ActionListEntry struct {
	Action      string
	Group       string
	Resource    string
	Subresource string
	Verb        string
}

// supportedActions is the memoized result of building the action list from
// resourceTranslations. The translation table is constant at runtime, so this
// slice can be computed once and reused.
var supportedActions = func() []ActionListEntry {
	translationTypes := make([]string, 0, len(resourceTranslations))
	for typ := range resourceTranslations {
		translationTypes = append(translationTypes, typ)
	}
	sort.Strings(translationTypes)

	var out []ActionListEntry
	seen := make(map[string]struct{})
	for _, typ := range translationTypes {
		translation := resourceTranslations[typ]

		actions := make([]string, 0, len(translation.mapping))
		for action := range translation.mapping {
			actions = append(actions, action)
		}
		sort.Strings(actions)

		for _, action := range actions {
			m := translation.mapping[action]
			if _, ok := seen[action]; ok {
				continue
			}
			group, resource, subresource, verb, ok := actionListParams(translation, m)
			if !ok {
				continue
			}

			seen[action] = struct{}{}
			out = append(out, ActionListEntry{
				Action:      action,
				Group:       group,
				Resource:    resource,
				Subresource: subresource,
				Verb:        verb,
			})
		}
	}
	return out
}()

// SupportedActions returns every RBAC action that Zanzana can resolve,
// derived from the resource translation table.
func SupportedActions() []ActionListEntry {
	return supportedActions
}
