package historian

import (
	"fmt"
	"strings"
)

// BackendType identifies different kinds of state history backends.
type BackendType string

// String implements Stringer for BackendType.
func (bt BackendType) String() string {
	return string(bt)
}

const (
	BackendTypeAnnotations BackendType = "annotations"
	BackendTypeLoki        BackendType = "loki"
	BackendTypeMultiple    BackendType = "multiple"
	BackendTypeNoop        BackendType = "noop"
)

func ParseBackendType(s string) (BackendType, error) {
	norm := strings.ToLower(strings.TrimSpace(s))

	types := map[BackendType]struct{}{
		BackendTypeAnnotations: {},
		BackendTypeLoki:        {},
		BackendTypeMultiple:    {},
		BackendTypeNoop:        {},
	}
	p := BackendType(norm)
	if _, ok := types[p]; !ok {
		return "", fmt.Errorf("unrecognized state history backend: %s", p)
	}
	return p, nil
}
