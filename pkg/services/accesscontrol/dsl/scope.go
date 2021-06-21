package dsl

import (
	"fmt"
	"strings"
)

const (
	ScopeNone     = ""
	ScopeAll      = "*"
	ScopeWildcard = "**"
)

func Combine(scopes ...string) string {
	b := strings.Builder{}
	for i, s := range scopes {
		if i != 0 {
			b.WriteRune(':')
		}
		b.WriteString(s)
	}
	return b.String()
}

func Parameter(key string) string {
	return fmt.Sprintf(`{{ index . "%s" }}`, key)
}
