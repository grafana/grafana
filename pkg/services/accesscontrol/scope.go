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

// Parameter returns injectable scope part, based on URL parameters.
// e.g. Scope("users", Parameter(":id")) or "users:" + Parameter(":id")
func Parameter(key string) string {
	return fmt.Sprintf(`{{ index .URLParams "%s" }}`, key)
}

// Field returns an injectable scope part for selected fields from the request's context available in accesscontrol.ScopeParams.
// e.g. Scope("orgs", Parameter("OrgID")) or "orgs:" + Parameter("OrgID")
func Field(key string) string {
	return fmt.Sprintf(`{{ .%s }}`, key)
}
