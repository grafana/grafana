package accesscontrol

import (
	"fmt"
	"strings"
)

// Scope builds scope from parts
// e.g. Scope("users", "*") return "users:*"
func Scope(parts ...string) string {
	b := strings.Builder{}
	for i, c := range parts {
		if i != 0 {
			b.WriteRune(':')
		}
		b.WriteString(c)
	}
	return b.String()
}

// Parameter returns injectable scope part, based on the URL parameter
// e.g. Scope("users", Parameter(":id")) or "users:" + Parameter(":id")
func Parameter(key string) string {
	return fmt.Sprintf(`{{ index .UrlParams "%s" }}`, key)
}

// ExtraParameter returns injectable scope part, based on ScopeParams fields
// e.g. Scope("orgs", Parameter("OrgID")) or "orgs:" + Parameter("OrgID")
func ExtraParameter(key string) string {
	return fmt.Sprintf(`{{ .%s }}`, key)
}
