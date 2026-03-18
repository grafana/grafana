package resourcepermission

import (
	"fmt"
	"slices"
	"strings"

	"k8s.io/apimachinery/pkg/runtime/schema"
)

// Mapper translates between K8s GroupResource and legacy RBAC scopes/action sets.
// It knows how to produce RBAC scopes (e.g., "folders:uid:abc") and action sets
// (e.g., "folders:view") for a specific resource type (folders, dashboards, datasources, etc.).
type Mapper interface {
	// ActionSets returns all available RBAC action sets for this resource type.
	// These are used to query the database for permissions (e.g., ["folders:view", "folders:edit", "folders:admin"]).
	ActionSets() []string

	// Scope returns the full RBAC scope for a given resource name.
	// Used when creating/updating permissions to store the scope in the permission table.
	// Example: Scope("abc") returns "folders:uid:abc".
	Scope(name string) string

	// ActionSet returns the RBAC action set for a given permission level.
	// Used when creating managed roles to determine which action set to grant.
	// Example: ActionSet("view") returns "folders:view".
	ActionSet(level string) (string, error)

	// ScopePattern returns the SQL LIKE pattern for querying scopes of this resource type.
	// Used in list queries with SQL LIKE to match all permissions for this resource type.
	// Example: "folders:uid:%" matches "folders:uid:abc", "folders:uid:xyz", etc.
	ScopePattern() string
}

type mapper struct {
	resource   string
	actionSets []string
}

func NewMapper(resource string, levels []string) Mapper {
	sets := make([]string, 0, len(levels))
	for _, level := range levels {
		sets = append(sets, resource+":"+level)
	}
	return mapper{
		resource:   resource,
		actionSets: sets,
	}
}

func (m mapper) ActionSets() []string {
	return m.actionSets
}

func (m mapper) Scope(name string) string {
	return m.resource + ":uid:" + name
}

func (m mapper) ActionSet(level string) (string, error) {
	actionSet := m.resource + ":" + strings.ToLower(level)
	if !slices.Contains(m.actionSets, actionSet) {
		return "", fmt.Errorf("invalid level (%s): %w", level, errInvalidSpec)
	}
	return actionSet, nil
}

func (m mapper) ScopePattern() string {
	return m.resource + ":uid:%"
}

type mapperEntry struct {
	mapper  Mapper
	enabled func() bool // nil = always enabled
}

// MappersRegistry is a registry of resource permission mappers.
// RegisterMapper must only be called during Wire init (before the server starts serving requests).
// No mutex is needed because all registrations happen sequentially during startup.
type MappersRegistry struct {
	entries map[schema.GroupResource]mapperEntry
	reverse map[string]schema.GroupResource // scope prefix -> GroupResource
}

// NewMappersRegistry initialises the registry with folders and dashboards (always enabled).
func NewMappersRegistry() *MappersRegistry {
	m := &MappersRegistry{
		entries: make(map[schema.GroupResource]mapperEntry),
		reverse: make(map[string]schema.GroupResource),
	}
	m.RegisterMapper(
		schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"},
		NewMapper("folders", defaultLevels), nil,
	)
	m.RegisterMapper(
		schema.GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"},
		NewMapper("dashboards", defaultLevels), nil,
	)
	return m
}

// ProvideMappersRegistry is a Wire provider that returns a new MappersRegistry.
func ProvideMappersRegistry() *MappersRegistry {
	return NewMappersRegistry()
}

// RegisterMapper registers a mapper for the given GroupResource.
// The scope prefix is derived from mapper.ScopePattern() — no separate parameter is needed.
// enabled may be nil, which means the mapper is always enabled.
func (m *MappersRegistry) RegisterMapper(gr schema.GroupResource, mapper Mapper, enabled func() bool) {
	prefix := strings.SplitN(mapper.ScopePattern(), ":", 2)[0]
	m.entries[gr] = mapperEntry{mapper: mapper, enabled: enabled}
	m.reverse[prefix] = gr
}

// findGroupKey returns the registry key for gr.Group using exact match first,
// then wildcard (*.<suffix>) match. A group starting with "*" is never a valid
// input (prevents matching a wildcard key as-is). Multi-segment prefixes
// (e.g. "foo.loki.datasource.grafana.app") do not match "*.datasource.grafana.app".
func (m *MappersRegistry) findGroupKey(gr schema.GroupResource) (schema.GroupResource, bool) {
	if strings.HasPrefix(gr.Group, "*") {
		return schema.GroupResource{}, false
	}
	// Exact match
	key := schema.GroupResource{Group: gr.Group, Resource: gr.Resource}
	if _, ok := m.entries[key]; ok {
		return key, true
	}
	// Wildcard match: find a registered key of the form *.<suffix>/<resource>
	for k := range m.entries {
		if k.Resource != gr.Resource {
			continue
		}
		if !strings.HasPrefix(k.Group, "*.") {
			continue
		}
		prefix, ok := strings.CutSuffix(gr.Group, k.Group[1:]) // e.g. "loki.datasource.grafana.app" -> "loki"
		if !ok || prefix == "" || strings.Contains(prefix, ".") {
			continue
		}
		return k, true
	}
	return schema.GroupResource{}, false
}

// Get returns the mapper for the given GroupResource regardless of enabled state.
// Use this when reading or writing existing data - the mapper provides the RBAC translation
// even if the feature is currently disabled (to preserve existing permissions).
// Wildcard group keys (e.g. "*.datasource.grafana.app") are resolved transparently.
func (m *MappersRegistry) Get(gr schema.GroupResource) (Mapper, bool) {
	key, ok := m.findGroupKey(gr)
	if !ok {
		return nil, false
	}
	return m.entries[key].mapper, true
}

// IsEnabled reports whether the mapper for the given GroupResource is registered and enabled.
// Use this for admission control (create/update validation) to gate whether new permissions
// can be created for this resource type based on feature flags or licensing.
// Wildcard group keys (e.g. "*.datasource.grafana.app") are resolved transparently.
func (m *MappersRegistry) IsEnabled(gr schema.GroupResource) bool {
	key, ok := m.findGroupKey(gr)
	if !ok {
		return false
	}
	e := m.entries[key]
	return e.enabled == nil || e.enabled()
}

// ParseScope parses an RBAC scope string (e.g., "folders:uid:abc") into a groupResourceName.
// Used when reading permissions from the database for two purposes:
//  1. Populating the ResourcePermission Spec (Group, Resource, Name fields)
//  2. Making AccessClient Check requests to authorize viewing the resource
func (m *MappersRegistry) ParseScope(scope string) (*groupResourceName, error) {
	parts := strings.SplitN(scope, ":", 3)
	if len(parts) != 3 {
		return nil, fmt.Errorf("%w: %s", errInvalidScope, scope)
	}
	gr, ok := m.reverse[parts[0]]
	if !ok {
		return nil, fmt.Errorf("%w: %s", errUnknownGroupResource, parts[0])
	}
	group := gr.Group

	// FIXME: This is a hack to support wildcard entries, since we have no way to know
	// the exact concrete group from just the RBAC scope prefix
	// (e.g., "datasources" -> could be loki, tempo, etc.).
	// Return "unknown.<suffix>" as a placeholder.
	if strings.HasPrefix(group, "*.") {
		group = "unknown" + group[1:] // e.g., "unknown.datasource.grafana.app"
	}
	return &groupResourceName{Group: group, Resource: gr.Resource, Name: parts[2]}, nil
}

// EnabledActionSets returns the action sets for all currently-enabled mappers.
// Used by list operations to query the database for permissions across all enabled resource types.
// Only includes mappers whose enabled closure returns true (or nil).
func (m *MappersRegistry) EnabledActionSets() []string {
	out := make([]string, 0, 3*len(m.entries))
	for _, e := range m.entries {
		if e.enabled != nil && !e.enabled() {
			continue
		}
		out = append(out, e.mapper.ActionSets()...)
	}
	return out
}

// EnabledScopePatterns returns the scope patterns for all currently-enabled mappers.
// Used by list operations to find all resource permissions across all enabled resource types.
// Only includes mappers whose enabled closure returns true (or nil).
func (m *MappersRegistry) EnabledScopePatterns() []string {
	out := make([]string, 0, len(m.entries))
	for _, e := range m.entries {
		if e.enabled != nil && !e.enabled() {
			continue
		}
		out = append(out, e.mapper.ScopePattern())
	}
	return out
}
