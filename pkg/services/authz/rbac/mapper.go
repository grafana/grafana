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
// where the name format is "{group}_{resource}_{id}" and needs to be translated
// to the target resource's permission scope and actions.
// Supports both dashboards and folders.
type resourcePermissionTranslation struct{}

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

// Action returns a template action that needs to have the resource type substituted.
// The caller should extract the resource type from the name and substitute {resource}.
func (r resourcePermissionTranslation) Action(verb string) (string, bool) {
	switch verb {
	case utils.VerbGet, utils.VerbList, utils.VerbWatch:
		return "{resource}.permissions:read", true
	case utils.VerbCreate, utils.VerbUpdate, utils.VerbPatch:
		return "{resource}.permissions:write", true
	case utils.VerbDelete, utils.VerbDeleteCollection:
		return "{resource}.permissions:write", true
	default:
		return "", false
	}
}

// ActionForResource returns the actual action for a specific resource type and verb.
func (r resourcePermissionTranslation) ActionForResource(resourceType, verb string) (string, bool) {
	template, ok := r.Action(verb)
	if !ok {
		return "", false
	}
	return strings.ReplaceAll(template, "{resource}", resourceType), true
}

// ParseResourcePermissionName extracts the group, resource type, and ID from a resource permission name.
// Expected format: "{group}_{resource}_{id}"
// Returns: group, resourceType, id, success
func (r resourcePermissionTranslation) ParseResourcePermissionName(name string) (string, string, string, bool) {
	parts := strings.Split(name, "_")
	if len(parts) < 3 {
		return "", "", "", false
	}

	group := parts[0]
	resourceType := parts[1]
	id := strings.Join(parts[2:], "_") // Handle IDs that contain underscores

	// Validate known resource types
	if resourceType != "dashboards" && resourceType != "folders" {
		return "", "", "", false
	}

	return group, resourceType, id, true
}

func (r resourcePermissionTranslation) Scope(name string) string {
	_, resourceType, id, ok := r.ParseResourcePermissionName(name)
	if !ok {
		return ""
	}

	// Since we can't access the full mapper registry due to circular dependency,
	// we'll manually construct the scope based on known patterns
	switch resourceType {
	case "dashboards":
		return "dashboards:uid:" + id
	case "folders":
		return "folders:uid:" + id
	default:
		return ""
	}
}

func (r resourcePermissionTranslation) Prefix() string {
	// Resource permissions can target multiple resource types, so return a generic prefix
	// The actual scope is determined dynamically in the Scope method
	return ""
}

func (r resourcePermissionTranslation) AllActions() []string {
	return []string{
		"dashboards.permissions:read",
		"dashboards.permissions:write",
		"folders.permissions:read",
		"folders.permissions:write",
	}
}

func (r resourcePermissionTranslation) HasFolderSupport() bool {
	return true // Resource permissions support both dashboards and folders
}

func newResourcePermissionTranslation() Mapping {
	// Return value type since we don't need the mapper field anymore
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
