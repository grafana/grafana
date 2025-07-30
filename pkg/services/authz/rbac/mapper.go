package rbac

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// Mapping maps a verb to a RBAC action and a resource name to a RBAC scope.
type Mapping interface {
	// action returns the action for the given verb.
	// If no action is found, it returns false.
	Action(verb string) (string, bool)
	// scope returns the scope for the given resource name.
	Scope(name string) string
	// prefix returns the scope prefix for the translation.
	Prefix() string
	// AllActions returns all the actions for the translation.
	AllActions() []string
	// HasFolderSupport returns true if the translation supports folders.
	HasFolderSupport() bool
}

type translation struct {
	resource      string
	attribute     string
	verbMapping   map[string]string
	folderSupport bool
}

func (t translation) Action(verb string) (string, bool) {
	action, ok := t.verbMapping[verb]
	return action, ok
}

func (t translation) Scope(name string) string {
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

// resourcePermissionTranslation handles the special case of resource permissions
// where the name format is "{group}-{resource}-{id}" and needs to be translated
// to the target resource's permission scope and actions.
// Currently focused on dashboards only.
type resourcePermissionTranslation struct {
	mapper MapperRegistry
}

// Case 1:
// Group: iam.grafana.app
// Resource: resourcepermissions
// Name: dashboard.grafana.app_dashboards_dash123
// Verb: create

// This should translate to:
// dashboards.permissions:write
// Scope: dashboards:uid:dash123

// Case 2:
// Group: iam.grafana.app
// Resource: resourcepermissions
// Name: folders.grafana.app_folders_fold123
// Verb: create

// This should translate to:
// folders.permissions:write
// Scope: folders:uid:fold123

// Problem the action function only takes the verb and not the resource name
// therefore it's impossible to determine the correct action (e.g. dashboards vs folders).

func (r resourcePermissionTranslation) Action(verb string) (string, bool) {
	switch verb {
	case utils.VerbGet, utils.VerbList, utils.VerbWatch:
		return r.resource + ".permissions:read", true
	case utils.VerbCreate, utils.VerbUpdate, utils.VerbPatch:
		return r.resource + ".permissions:write", true
	case utils.VerbDelete, utils.VerbDeleteCollection:
		return r.resource + ".permissions:write", true
	default:
		return "", false
	}
}

func (r resourcePermissionTranslation) Scope(name string) string {
	parts := strings.Split(name, "_")
	if len(parts) < 3 {
		return ""
	}
	if parts[0] != "dashboard.grafana.app" && parts[0] != "folders.grafana.app" {
		return ""
	}
	mapper, ok := r.mapper.Get(parts[0], parts[1])
	if !ok {
		return ""
	}
	return mapper.Scope(parts[2])
}

func (r resourcePermissionTranslation) Prefix() string {
	// Dashboard resource permissions target dashboard resources
	return "dashboards:uid:"
}

func (r resourcePermissionTranslation) AllActions() []string {
	return []string{
		"dashboards.permissions:read",
		"dashboards.permissions:write",
	}
}

func (r resourcePermissionTranslation) HasFolderSupport() bool {
	return false // Resource permissions themselves don't support folders
}

func newResourcePermissionTranslation() Mapping {
	return resourcePermissionTranslation{}
}

// MapperRegistry is a registry of mappers that maps a group and resource to a translation.
type MapperRegistry interface {
	// Get returns the permission mapper for the given group and resource.
	// If no translation is found, it returns false.
	Get(group, resource string) (Mapping, bool)
	// GetAll returns all the translations for the given group
	GetAll(group string) []Mapping
}

type mapper map[string]map[string]Mapping

func newResourceTranslation(resource string, attribute string, folderSupport bool) Mapping {
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
		resource:      resource,
		attribute:     attribute,
		verbMapping:   defaultMapping(resource),
		folderSupport: folderSupport,
	}
}

func NewMapperRegistry() MapperRegistry {
	mapper := mapper(map[string]map[string]Mapping{
		"dashboard.grafana.app": {
			"dashboards": newResourceTranslation("dashboards", "uid", true),
		},
		"folder.grafana.app": {
			"folders": newResourceTranslation("folders", "uid", true),
		},
		"iam.grafana.app": {
			// Teams is a special case. We translate user permissions from id to uid based.
			"teams":     newResourceTranslation("teams", "uid", false),
			"coreroles": newResourceTranslation("roles", "uid", false),
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
			},
			"resourcepermissions": newResourcePermissionTranslation(),
		},
		"secret.grafana.app": {
			"securevalues": newResourceTranslation("secret.securevalues", "uid", false),
			"keepers":      newResourceTranslation("secret.keepers", "uid", false),
		},
		"settings.grafana.app": {
			"settings": newResourceTranslation("settings", "uid", false),
		},
		"query.grafana.app": {
			"query": translation{
				resource:  "datasources",
				attribute: "uid",
				verbMapping: map[string]string{
					utils.VerbCreate: "datasources:query",
				},
				folderSupport: false,
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

	return t, true
}

func (m mapper) GetAll(group string) []Mapping {
	resources, ok := m[group]
	if !ok {
		return nil
	}

	translations := make([]Mapping, 0, len(resources))
	for _, t := range resources {
		translations = append(translations, t)
	}

	return translations
}
