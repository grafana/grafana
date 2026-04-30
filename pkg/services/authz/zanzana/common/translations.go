package common

import (
	"slices"
	"sort"

	authlib "github.com/grafana/authlib/types"

	dashboards "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
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
}

func newMapping(relation, subresource string) actionMapping {
	return newScopedMapping(relation, "", "", subresource)
}

func newScopedMapping(relation, group, resource, subresource string) actionMapping {
	return actionMapping{relation, group, resource, subresource}
}

var (
	folderGroup    = folders.FolderResourceInfo.GroupResource().Group
	folderResource = folders.FolderResourceInfo.GroupResource().Resource

	dashboardGroup    = dashboards.DashboardResourceInfo.GroupResource().Group
	dashboardResource = dashboards.DashboardResourceInfo.GroupResource().Resource
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
			// Action sets
			"dashboards:view":  newMapping(RelationSetView, ""),
			"dashboards:edit":  newMapping(RelationSetEdit, ""),
			"dashboards:admin": newMapping(RelationSetAdmin, ""),
		},
	},
	KindSnapshots: {
		typ:      TypeResource,
		group:    dashboardGroup,
		resource: KindSnapshots,
		mapping: map[string]actionMappig{
			"snapshots:read":   newMapping(RelationGet, ""),
			"snapshots:create": newMapping(RelationCreate, ""),
			"snapshots:delete": newMapping(RelationDelete, ""),
		},
	},
	KindLibraryPanels: {
		typ:      TypeResource,
		group:    dashboardGroup,
		resource: KindLibraryPanels,
		mapping: map[string]actionMappig{
			"library.panels:read":  newMapping(RelationGet, ""),
			"library.panels:write": newMapping(RelationUpdate, ""),
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
		Namespace: namespace,
		Verb:      verb,
		Group:     translation.group,
		Resource:  translation.resource,
		Name:      name,
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

func actionListParams(translation resourceTranslation, m actionMapping) (group, resource, verb string, ok bool) {
	group = translation.group
	resource = translation.resource
	if m.group != "" && m.resource != "" {
		group = m.group
		resource = m.resource
	}

	verb, ok = RelationToVerbMapping[m.relation]
	if !ok {
		return "", "", "", false
	}

	return group, resource, verb, true
}

// TranslateActionToListParams translates an RBAC action to Zanzana List request parameters (group, resource, verb).
// Returns empty strings if the action cannot be translated.
func TranslateActionToListParams(action string) (group, resource, verb string) {
	translationTypes := make([]string, 0, len(resourceTranslations))
	for typ := range resourceTranslations {
		translationTypes = append(translationTypes, typ)
	}
	sort.Strings(translationTypes)

	for _, typ := range translationTypes {
		translation := resourceTranslations[typ]
		if m, ok := translation.mapping[action]; ok {
			group, resource, verb, ok := actionListParams(translation, m)
			if !ok {
				return "", "", ""
			}
			return group, resource, verb
		}
	}
	return "", "", ""
}

// ActionListEntry describes an action that Zanzana supports, along with
// its List request parameters.
type ActionListEntry struct {
	Action   string
	Group    string
	Resource string
	Verb     string
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
			group, resource, verb, ok := actionListParams(translation, m)
			if !ok {
				continue
			}

			seen[action] = struct{}{}
			out = append(out, ActionListEntry{
				Action:   action,
				Group:    group,
				Resource: resource,
				Verb:     verb,
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
