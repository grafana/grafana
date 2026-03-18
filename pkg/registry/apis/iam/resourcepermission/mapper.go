package resourcepermission

import (
	"fmt"
	"slices"
	"strings"

	"k8s.io/apimachinery/pkg/runtime/schema"
)

type Mapper interface {
	ActionSets() []string
	Scope(name string) string
	ActionSet(level string) (string, error)
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

// Mappers is a registry of resource permission mappers.
// RegisterMapper must only be called during Wire init (before the server starts serving requests).
// No mutex is needed because all registrations happen sequentially during startup.
type Mappers struct {
	entries map[schema.GroupResource]mapperEntry
	reverse map[string]schema.GroupResource // scope prefix -> GroupResource
}

// NewMappers initialises the registry with folders and dashboards (always enabled).
func NewMappers() *Mappers {
	m := &Mappers{
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

// ProvideMappers is a Wire provider that returns a new Mappers registry.
func ProvideMappers() *Mappers {
	return NewMappers()
}

// RegisterMapper registers a mapper for the given GroupResource.
// The scope prefix is derived from mapper.ScopePattern() — no separate parameter is needed.
// enabled may be nil, which means the mapper is always enabled.
func (m *Mappers) RegisterMapper(gr schema.GroupResource, mapper Mapper, enabled func() bool) {
	prefix := strings.SplitN(mapper.ScopePattern(), ":", 2)[0]
	m.entries[gr] = mapperEntry{mapper: mapper, enabled: enabled}
	m.reverse[prefix] = gr
}

// Get returns the mapper for the given GroupResource regardless of enabled state.
// Use this for reads of existing data.
func (m *Mappers) Get(gr schema.GroupResource) (Mapper, bool) {
	e, ok := m.entries[gr]
	if !ok {
		return nil, false
	}
	return e.mapper, true
}

// IsEnabled reports whether the mapper for the given GroupResource is registered and enabled.
func (m *Mappers) IsEnabled(gr schema.GroupResource) bool {
	e, ok := m.entries[gr]
	return ok && (e.enabled == nil || e.enabled())
}

// ParseScope parses a scope string (e.g. "folders:uid:abc") into a groupResourceName.
func (m *Mappers) ParseScope(scope string) (*groupResourceName, error) {
	parts := strings.SplitN(scope, ":", 3)
	if len(parts) != 3 {
		return nil, fmt.Errorf("%w: %s", errInvalidScope, scope)
	}
	gr, ok := m.reverse[parts[0]]
	if !ok {
		return nil, fmt.Errorf("%w: %s", errUnknownGroupResource, parts[0])
	}
	return &groupResourceName{Group: gr.Group, Resource: gr.Resource, Name: parts[2]}, nil
}

// EnabledActionSets returns the action sets for all currently-enabled mappers.
func (m *Mappers) EnabledActionSets() []string {
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
func (m *Mappers) EnabledScopePatterns() []string {
	out := make([]string, 0, len(m.entries))
	for _, e := range m.entries {
		if e.enabled != nil && !e.enabled() {
			continue
		}
		out = append(out, e.mapper.ScopePattern())
	}
	return out
}
