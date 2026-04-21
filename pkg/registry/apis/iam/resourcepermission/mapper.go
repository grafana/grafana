package resourcepermission

import (
	"context"
	"fmt"
	"slices"
	"strings"

	"github.com/grafana/authlib/types"
	v0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
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

	// AllowsKind reports whether the resource type permits assignments to the given permission kind.
	// Returns true when no kind restriction is configured (all kinds allowed).
	AllowsKind(kind v0alpha1.ResourcePermissionSpecPermissionKind) bool
}

// ScopeAttribute defines how a resource is identified in RBAC scope strings.
// It is the middle segment of a scope, e.g. "uid" in "folders:uid:abc".
type ScopeAttribute string

const (
	// ScopeAttributeUID identifies resources by their UID (e.g. "folders:uid:abc").
	ScopeAttributeUID ScopeAttribute = "uid"
	// ScopeAttributeID identifies resources by their numeric database ID (e.g. "serviceaccounts:id:123").
	ScopeAttributeID ScopeAttribute = "id"
)

type mapper struct {
	resource       string
	scopeAttribute ScopeAttribute
	actionSets     []string
	allowedKinds   []v0alpha1.ResourcePermissionSpecPermissionKind // nil = all kinds allowed
}

// NewMapper creates a Mapper for uid-scoped resources (folders, dashboards).
// All permission kinds are allowed.
func NewMapper(resource string, levels []string) Mapper {
	return NewMapperWithAttribute(resource, levels, ScopeAttributeUID, nil)
}

// NewIDScopedMapper creates a Mapper for id-scoped resources (teams, users).
// All permission kinds are allowed.
func NewIDScopedMapper(resource string, levels []string) Mapper {
	return NewMapperWithAttribute(resource, levels, ScopeAttributeID, nil)
}

// NewMapperWithAttribute creates a Mapper with an explicit scope attribute and optional kind restrictions.
// When allowedKinds is nil, all permission kinds are permitted.
func NewMapperWithAttribute(resource string, levels []string, attr ScopeAttribute, allowedKinds []v0alpha1.ResourcePermissionSpecPermissionKind) Mapper {
	sets := make([]string, 0, len(levels))
	for _, level := range levels {
		sets = append(sets, resource+":"+strings.ToLower(level))
	}
	return mapper{
		resource:       resource,
		scopeAttribute: attr,
		actionSets:     sets,
		allowedKinds:   allowedKinds,
	}
}

func (m mapper) ActionSets() []string {
	return m.actionSets
}

func (m mapper) Scope(name string) string {
	return m.resource + ":" + string(m.scopeAttribute) + ":" + name
}

func (m mapper) ActionSet(level string) (string, error) {
	actionSet := m.resource + ":" + strings.ToLower(level)
	if !slices.Contains(m.actionSets, actionSet) {
		return "", fmt.Errorf("invalid level (%s): %w", level, errInvalidSpec)
	}
	return actionSet, nil
}

func (m mapper) ScopePattern() string {
	return m.resource + ":" + string(m.scopeAttribute) + ":%"
}

func (m mapper) AllowsKind(kind v0alpha1.ResourcePermissionSpecPermissionKind) bool {
	if m.allowedKinds == nil {
		return true
	}
	return slices.Contains(m.allowedKinds, kind)
}

type mapperEntry struct {
	mapper  Mapper
	enabled func() bool // nil = always enabled
}

// MappersRegistry is a registry of resource permission mappers.
// RegisterMapper and RegisterResolver must only be called during Wire init (before the server starts serving requests).
// No mutex is needed because all registrations happen sequentially during startup.
type MappersRegistry struct {
	entries   map[schema.GroupResource]mapperEntry
	reverse   map[string]schema.GroupResource // scope prefix -> GroupResource
	resolvers map[schema.GroupResource]NameResolver
}

// NewMappersRegistry initialises the registry with folders and dashboards (always enabled).
func NewMappersRegistry() *MappersRegistry {
	m := &MappersRegistry{
		entries:   make(map[schema.GroupResource]mapperEntry),
		reverse:   make(map[string]schema.GroupResource),
		resolvers: make(map[schema.GroupResource]NameResolver),
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

// RegisterResolver registers a NameResolver for the given GroupResource.
// Must be called during Wire init; no mutex is used.
func (m *MappersRegistry) RegisterResolver(gr schema.GroupResource, r NameResolver) {
	m.resolvers[gr] = r
}

// GetResolver returns the NameResolver for the given GroupResource, or false if none is registered.
func (m *MappersRegistry) GetResolver(gr schema.GroupResource) (NameResolver, bool) {
	key, ok := m.findGroupKey(gr)
	if !ok {
		return nil, false
	}
	r, ok := m.resolvers[key]
	return r, ok
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
//
// datasourceType is the datasource type from the permission row, used to resolve the concrete group.
func (m *MappersRegistry) ParseScope(scope, datasourceType string) (*groupResourceName, error) {
	parts := strings.SplitN(scope, ":", 3)
	if len(parts) != 3 {
		return nil, fmt.Errorf("%w: %s", errInvalidScope, scope)
	}
	gr, ok := m.reverse[parts[0]]
	if !ok {
		return nil, fmt.Errorf("%w: %s", errUnknownGroupResource, parts[0])
	}

	group := resolveGroup(gr.Group, datasourceType)

	return &groupResourceName{Group: group, Resource: gr.Resource, Name: parts[2]}, nil
}

// resolveGroup resolves a wildcard group (e.g. "*.datasource.grafana.app") to a concrete group
// (e.g. "loki.datasource.grafana.app") using the prefix
func resolveGroup(group, prefix string) string {
	if !strings.HasPrefix(group, "*.") {
		return group
	}
	if prefix == "" {
		return "unknown" + group[1:]
	}
	return prefix + group[1:]
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

// ParseScopeCtx parses an RBAC scope string into a groupResourceName, resolving id to uid for
// id-scoped resources (teams, users, service accounts) using the provided store and namespace.
// For uid-scoped resources (folders, dashboards) it behaves identically to ParseScope.
func (m *MappersRegistry) ParseScopeCtx(ctx context.Context, ns types.NamespaceInfo, store IdentityStore, scope, datasourceType string) (*groupResourceName, error) {
	parts := strings.SplitN(scope, ":", 3)
	if len(parts) != 3 {
		return nil, fmt.Errorf("%w: %s", errInvalidScope, scope)
	}
	gr, ok := m.reverse[parts[0]]
	if !ok {
		return nil, fmt.Errorf("%w: %s", errUnknownGroupResource, parts[0])
	}

	entry := m.entries[gr]
	group := resolveGroup(gr.Group, datasourceType)

	name := parts[2]
	if resolver, ok := m.resolvers[gr]; ok {
		// K8s API-based ID→UID for resources with a registered resolver (e.g. service accounts).
		uid, err := resolver.IDToUID(ctx, ns.Value, name)
		if err != nil {
			return nil, err
		}
		name = uid
	} else if isIDScoped(entry.mapper) && store != nil {
		uid, err := legacy.ResolveIDScopeToUIDName(ctx, store, ns, scope)
		if err != nil {
			return nil, err
		}
		name = uid
	}

	return &groupResourceName{Group: group, Resource: gr.Resource, Name: name}, nil
}

// isIDScoped returns true if the mapper's ScopePattern uses ":id:" (id-scoped resources).
func isIDScoped(m Mapper) bool {
	return strings.Contains(m.ScopePattern(), ":id:")
}
