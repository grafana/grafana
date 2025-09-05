package resourcepermission

import (
	"fmt"
	"slices"
	"strings"
)

type Mapper interface {
	ActionSets() []string
	Scope(name string) string
	ActionSet(level string) (string, error)
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
