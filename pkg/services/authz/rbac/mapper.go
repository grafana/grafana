package rbac

import (
	"fmt"
	"slices"
	"strings"

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
	// SkipScope returns true if the translation does not require a scope for the given verb.
	SkipScope(verb string) bool
	// Resource returns the K8s resource name for this mapping.
	Resource() string
}

type translation struct {
	resource         string
	attribute        string
	verbMapping      map[string]string
	actionSetMapping map[string][]string
	folderSupport    bool
	// actions to skip scope on, e.g., create actions
	skipScopeOnVerb map[string]bool
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

func (t translation) SkipScope(verb string) bool {
	if t.skipScopeOnVerb != nil {
		return t.skipScopeOnVerb[verb]
	}
	return false
}

func (t translation) Resource() string {
	return t.resource
}

// MapperRegistry is a registry of mappers that maps a group and resource to a translation.
type MapperRegistry interface {
	// Get returns the permission mapper for the given group and resource.
	// If no translation is found, it returns false.
	Get(group, resource string) (Mapping, bool)
	// GetAll returns all the translations for the given group
	GetAll(group string) []Mapping
	// GetGroups returns all registered group names
	GetGroups() []string
}

type mapper map[string]map[string]translation

func newResourceTranslation(resource string, attribute string, folderSupport bool, skipScopeOnVerb map[string]bool) translation {
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
		resource:        resource,
		attribute:       attribute,
		verbMapping:     defaultMapping(resource),
		folderSupport:   folderSupport,
		skipScopeOnVerb: skipScopeOnVerb,
	}
}

// newDashboardTranslation creates a translation for dashboards and also maps the actions to action sets
func newDashboardTranslation() translation {
	dashTranslation := newResourceTranslation("dashboards", "uid", true, nil)

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
	folderTranslation := newResourceTranslation("folders", "uid", true, nil)

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

func NewMapperRegistry() MapperRegistry {
	skipScopeOnAllVerbs := map[string]bool{
		utils.VerbCreate:           true,
		utils.VerbGet:              true,
		utils.VerbUpdate:           true,
		utils.VerbPatch:            true,
		utils.VerbDelete:           true,
		utils.VerbDeleteCollection: true,
		utils.VerbList:             true,
		utils.VerbWatch:            true,
		utils.VerbGetPermissions:   true,
		utils.VerbSetPermissions:   true,
	}

	mapper := mapper(map[string]map[string]translation{
		"dashboard.grafana.app": {
			"dashboards":    newDashboardTranslation(),
			"librarypanels": newResourceTranslation("library.panels", "uid", true, nil),
		},
		"folder.grafana.app": {
			"folders": newFolderTranslation(),
		},
		"iam.grafana.app": {
			// Users is a special case. We translate user permissions from id to uid based.
			"users":           newResourceTranslation("users", "uid", false, map[string]bool{utils.VerbCreate: true}),
			"serviceaccounts": newResourceTranslation("serviceaccounts", "uid", false, map[string]bool{utils.VerbCreate: true}),
			// Teams is a special case. We translate user permissions from id to uid based.
			"teams": newResourceTranslation("teams", "uid", false, map[string]bool{utils.VerbCreate: true}),
			"coreroles": translation{
				resource:  "roles",
				attribute: "uid",
				verbMapping: map[string]string{
					utils.VerbGet:   "roles:read",
					utils.VerbList:  "roles:read",
					utils.VerbWatch: "roles:read",
				},
				folderSupport: false,
				// No need to skip scope on create for roles because we translate `permissions:type:delegate` to `roles:*``
				skipScopeOnVerb: nil,
			},
			"globalroles": translation{
				resource:  "roles",
				attribute: "uid",
				verbMapping: map[string]string{
					utils.VerbGet:   "roles:read",
					utils.VerbList:  "roles:read",
					utils.VerbWatch: "roles:read",
				},
				folderSupport:    false,
				useWildcardScope: true,
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
				folderSupport: false,
				// No need to skip scope on create for roles because we translate `permissions:type:delegate` to `roles:*``
				skipScopeOnVerb: nil,
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
		"provisioning.grafana.app": {
			"repositories": newResourceTranslation("provisioning.repositories", "uid", false, skipScopeOnAllVerbs),
			"connections":  newResourceTranslation("provisioning.connections", "uid", false, skipScopeOnAllVerbs),
			"jobs":         newResourceTranslation("provisioning.jobs", "uid", false, skipScopeOnAllVerbs),
			"historicjobs": newResourceTranslation("provisioning.historicjobs", "uid", false, skipScopeOnAllVerbs),
			"settings":     newResourceTranslation("provisioning.settings", "", false, skipScopeOnAllVerbs),
			"stats":        newResourceTranslation("provisioning.stats", "", false, skipScopeOnAllVerbs),
		},
		"secret.grafana.app": {
			"securevalues": newResourceTranslation("secret.securevalues", "uid", false, nil),
			"keepers":      newResourceTranslation("secret.keepers", "uid", false, nil),
		},
		"query.grafana.app": {
			"query": translation{
				resource:  "datasources",
				attribute: "uid",
				verbMapping: map[string]string{
					utils.VerbCreate: "datasources:query",
				},
				folderSupport:   false,
				skipScopeOnVerb: nil,
			},
		},
		"datasource.grafana.app": { // duplicate the query group here
			"query": translation{
				resource:  "datasources",
				attribute: "uid",
				verbMapping: map[string]string{
					utils.VerbCreate: "datasources:query",
				},
				folderSupport:   false,
				skipScopeOnVerb: nil,
			},
		},
		"*.datasource.grafana.app": {
			"datasources": newResourceTranslation("datasources", "uid", false, nil),
		},
		"plugins.grafana.app": {
			"plugins": newResourceTranslation("plugins.plugins", "uid", false, nil),
			"metas":   newResourceTranslation("plugins.metas", "uid", false, nil),
		},
		"advisor.grafana.app": {
			"checks":     newResourceTranslation("advisor.checks", "uid", false, nil),
			"checktypes": newResourceTranslation("advisor.checktypes", "uid", false, nil),
			"register":   newResourceTranslation("advisor.register", "uid", false, nil),
		},
	})

	return mapper
}

// findGroupKey returns the registry key for group, using exact match first,
// then wildcard match. A wildcard key has the form "*.<suffix>" (e.g. "*.datasource.grafana.app");
// group matches if it has that suffix, is longer than the suffix (non-empty prefix), and the prefix
// contains no dot (so "loki.datasource.grafana.app" matches but "foo.loki.datasource.grafana.app" does not).
// Group starting with "*" never matches (so we never exact-match a wildcard registry key as input).
func (m mapper) findGroupKey(group string) (string, bool) {
	if strings.HasPrefix(group, "*") {
		return "", false
	}
	if _, ok := m[group]; ok {
		return group, true
	}
	for key := range m {
		// is this a wildcard key?
		if len(key) < 2 || key[0] != '*' || key[1] != '.' {
			continue
		}
		suffix := key[1:]                              // remove the leading "*"
		prefix, ok := strings.CutSuffix(group, suffix) // loki.datasource.grafana.app -> loki
		if !ok || prefix == "" {
			continue
		}
		// prefix must be a single segment (no nested dots)
		if strings.Contains(prefix, ".") {
			continue
		}
		return key, true
	}
	return "", false
}

func (m mapper) Get(group, resource string) (Mapping, bool) {
	groupKey, ok := m.findGroupKey(group)
	if !ok {
		return nil, false
	}

	resources := m[groupKey]
	t, ok := resources[resource]
	if !ok {
		return nil, false
	}

	return &t, true
}

func (m mapper) GetAll(group string) []Mapping {
	groupKey, ok := m.findGroupKey(group)
	if !ok {
		return nil
	}

	resources := m[groupKey]

	translations := make([]Mapping, 0, len(resources))
	for _, t := range resources {
		translations = append(translations, &t)
	}

	return translations
}

func (m mapper) GetGroups() []string {
	groups := make([]string, 0, len(m))
	for group := range m {
		groups = append(groups, group)
	}
	return groups
}
