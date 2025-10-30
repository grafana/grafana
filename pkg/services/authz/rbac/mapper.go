package rbac

import (
	"fmt"
	"slices"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ossaccesscontrol"
)

// Mapping maps a verb to a RBAC action and a resource name to a RBAC scope.
type Mapping interface {
	// action returns the action for the given verb.
	// If no action is found, it returns false.
	Action(verb string) (string, bool)
	// ActionSets returns the action sets for the given verb.
	// If no action sets are found, it returns an empty slice. This is expected for resources that do not have action sets (anything apart from dashboards and folders).
	ActionSets(verb string) []string
	// scope returns the scope for the given resource name.
	Scope(name string) string
	// prefix returns the scope prefix for the translation.
	Prefix() string
	// AllActions returns all the actions for the translation.
	AllActions() []string
	// HasFolderSupport returns true if the translation supports folders.
	HasFolderSupport() bool
	// SkipScopeOnCreate returns true if the translation does not require a scope on create.
	SkipScopeOnCreate() bool
}

type translation struct {
	resource          string
	attribute         string
	verbMapping       map[string]string
	actionSetMapping  map[string][]string
	folderSupport     bool
	skipScopeOnCreate bool
	// use this option if you need to limit access to users that can access all resources
	useWildcardScope bool
}

func (t translation) Action(verb string) (string, bool) {
	action, ok := t.verbMapping[verb]
	return action, ok
}

func (t translation) ActionSets(verb string) []string {
	actionSets := t.actionSetMapping[verb]
	return actionSets
}

func (t translation) Scope(name string) string {
	if t.useWildcardScope {
		return "*"
	}
	return t.resource + ":" + t.attribute + ":" + name
}

func (t translation) Prefix() string {
	return t.resource + ":" + t.attribute + ":"
}

func (t translation) AllActions() []string {
	actions := make([]string, 0, len(t.verbMapping))
	actionsMap := make(map[string]bool)
	for _, action := range t.verbMapping {
		if actionsMap[action] {
			continue
		}
		actionsMap[action] = true
		actions = append(actions, action)
	}
	return actions
}

func (t translation) HasFolderSupport() bool {
	return t.folderSupport
}

func (t translation) SkipScopeOnCreate() bool {
	return t.skipScopeOnCreate
}

// MapperRegistry is a registry of mappers that maps a group and resource to a translation.
type MapperRegistry interface {
	// Get returns the permission mapper for the given group and resource.
	// If no translation is found, it returns false.
	Get(group, resource string) (Mapping, bool)
	// GetAll returns all the translations for the given group
	GetAll(group string) []Mapping
}

type mapper map[string]map[string]translation

func newResourceTranslation(resource string, attribute string, folderSupport, skipScopeOnCreate bool) translation {
	defaultMapping := func(r string) map[string]string {
		return map[string]string{
			utils.VerbGet:              fmt.Sprintf("%s:read", r),
			utils.VerbList:             fmt.Sprintf("%s:read", r),
			utils.VerbWatch:            fmt.Sprintf("%s:read", r),
			utils.VerbCreate:           fmt.Sprintf("%s:create", r),
			utils.VerbUpdate:           fmt.Sprintf("%s:write", r),
			utils.VerbPatch:            fmt.Sprintf("%s:write", r),
			utils.VerbDelete:           fmt.Sprintf("%s:delete", r),
			utils.VerbDeleteCollection: fmt.Sprintf("%s:delete", r),
			utils.VerbGetPermissions:   fmt.Sprintf("%s.permissions:read", r),
			utils.VerbSetPermissions:   fmt.Sprintf("%s.permissions:write", r),
		}
	}

	return translation{
		resource:          resource,
		attribute:         attribute,
		verbMapping:       defaultMapping(resource),
		folderSupport:     folderSupport,
		skipScopeOnCreate: skipScopeOnCreate,
	}
}

// newDashboardTranslation creates a translation for dashboards and also maps the actions to action sets
func newDashboardTranslation() translation {
	dashTranslation := newResourceTranslation("dashboards", "uid", true, false)

	actionSetMapping := make(map[string][]string)
	for verb, rbacAction := range dashTranslation.verbMapping {
		var dashActionSets []string

		// Dashboard creation is only part of folder action sets, so we handle it separately
		if rbacAction == "dashboards:create" {
			dashActionSets = append(dashActionSets, "folders:edit")
			dashActionSets = append(dashActionSets, "folders:admin")
		}

		if slices.Contains(ossaccesscontrol.DashboardViewActions, rbacAction) {
			dashActionSets = append(dashActionSets, "dashboards:view")
			dashActionSets = append(dashActionSets, "folders:view")
		}
		if slices.Contains(ossaccesscontrol.DashboardEditActions, rbacAction) {
			dashActionSets = append(dashActionSets, "dashboards:edit")
			dashActionSets = append(dashActionSets, "folders:edit")
		}
		if slices.Contains(ossaccesscontrol.DashboardAdminActions, rbacAction) {
			dashActionSets = append(dashActionSets, "dashboards:admin")
			dashActionSets = append(dashActionSets, "folders:admin")
		}
		actionSetMapping[verb] = dashActionSets
	}

	dashTranslation.actionSetMapping = actionSetMapping
	return dashTranslation
}

// newFolderTranslation creates a translation for folders and also maps the actions to action sets
func newFolderTranslation() translation {
	folderTranslation := newResourceTranslation("folders", "uid", true, false)

	actionSetMapping := make(map[string][]string)
	for verb, rbacAction := range folderTranslation.verbMapping {
		var actionSets []string
		// Folder creation has not been added to the FolderEditActions and FolderAdminActions slices (https://github.com/grafana/identity-access-team/issues/794)
		// so we handle it as a special case for now
		if rbacAction == "folders:create" {
			actionSets = append(actionSets, "folders:edit")
			actionSets = append(actionSets, "folders:admin")
		}
		if slices.Contains(ossaccesscontrol.FolderViewActions, rbacAction) {
			actionSets = append(actionSets, "folders:view")
		}
		if slices.Contains(ossaccesscontrol.FolderEditActions, rbacAction) {
			actionSets = append(actionSets, "folders:edit")
		}
		if slices.Contains(ossaccesscontrol.FolderAdminActions, rbacAction) {
			actionSets = append(actionSets, "folders:admin")
		}
		actionSetMapping[verb] = actionSets
	}
	folderTranslation.actionSetMapping = actionSetMapping
	return folderTranslation
}

func newExternalGroupMappingTranslation() translation {
	return translation{
		resource:  "teams.permissions",
		attribute: "uid",
		verbMapping: map[string]string{
			utils.VerbGet:            "teams.permissions:read",
			utils.VerbList:           "teams.permissions:read",
			utils.VerbWatch:          "teams.permissions:read",
			utils.VerbCreate:         "teams.permissions:write",
			utils.VerbUpdate:         "teams.permissions:write",
			utils.VerbPatch:          "teams.permissions:write",
			utils.VerbDelete:         "teams.permissions:write",
			utils.VerbGetPermissions: "teams.permissions:write",
			utils.VerbSetPermissions: "teams.permissions:write",
		},
		folderSupport:     false,
		skipScopeOnCreate: false,
	}
}

func NewMapperRegistry() MapperRegistry {
	mapper := mapper(map[string]map[string]translation{
		"dashboard.grafana.app": {
			"dashboards":    newDashboardTranslation(),
			"librarypanels": newResourceTranslation("library.panels", "uid", true, false),
		},
		"folder.grafana.app": {
			"folders": newFolderTranslation(),
		},
		"iam.grafana.app": {
			// Users is a special case. We translate user permissions from id to uid based.
			"users":           newResourceTranslation("users", "uid", false, true),
			"serviceaccounts": newResourceTranslation("serviceaccounts", "uid", false, true),
			// Teams is a special case. We translate team permissions from id to uid based.
			"teams": newResourceTranslation("teams", "uid", false, true),
			// ExternalGroupMappings is a special case. We translate team permissions from id to uid based.
			"externalgroupmappings": newExternalGroupMappingTranslation(),
			// No need to skip scope on create for roles because we translate `permissions:type:delegate` to `roles:*``
			"coreroles": translation{
				resource:  "roles",
				attribute: "uid",
				verbMapping: map[string]string{
					utils.VerbGet:   "roles:read",
					utils.VerbList:  "roles:read",
					utils.VerbWatch: "roles:read",
				},
				folderSupport:     false,
				skipScopeOnCreate: false,
			},
			"roles": translation{
				resource:  "roles",
				attribute: "uid",
				verbMapping: map[string]string{
					utils.VerbCreate:           "roles:write",
					utils.VerbGet:              "roles:read",
					utils.VerbUpdate:           "roles:write",
					utils.VerbPatch:            "roles:write",
					utils.VerbDelete:           "roles:delete",
					utils.VerbDeleteCollection: "roles:delete",
					utils.VerbList:             "roles:read",
					utils.VerbWatch:            "roles:read",
				},
				folderSupport:     false,
				skipScopeOnCreate: false,
			},
			"rolebindings": translation{
				resource: "rolebindings",
				// rolebidings should only be modifiable by admins with a wildcard access
				useWildcardScope: true,
				verbMapping: map[string]string{
					utils.VerbCreate:           "users.roles:add",
					utils.VerbGet:              "users.roles:read",
					utils.VerbUpdate:           "users.roles:add",
					utils.VerbPatch:            "users.roles:add",
					utils.VerbDelete:           "users.roles:remove",
					utils.VerbDeleteCollection: "users.roles:remove",
					utils.VerbList:             "users.roles:read",
					utils.VerbWatch:            "users.roles:read",
				},
				folderSupport: false,
			},
		},
		"secret.grafana.app": {
			"securevalues": newResourceTranslation("secret.securevalues", "uid", false, false),
			"keepers":      newResourceTranslation("secret.keepers", "uid", false, false),
		},
		"query.grafana.app": {
			"query": translation{
				resource:  "datasources",
				attribute: "uid",
				verbMapping: map[string]string{
					utils.VerbCreate: "datasources:query",
				},
				folderSupport:     false,
				skipScopeOnCreate: false,
			},
		},
	})

	return mapper
}

func (m mapper) Get(group, resource string) (Mapping, bool) {
	resources, ok := m[group]
	if !ok {
		return nil, false
	}

	t, ok := resources[resource]
	if !ok {
		return nil, false
	}

	return &t, true
}

func (m mapper) GetAll(group string) []Mapping {
	resources, ok := m[group]
	if !ok {
		return nil
	}

	translations := make([]Mapping, 0, len(resources))
	for _, t := range resources {
		translations = append(translations, &t)
	}

	return translations
}
