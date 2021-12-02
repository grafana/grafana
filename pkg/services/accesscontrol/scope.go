package accesscontrol

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/models"
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

type KeywordScopeResolveFunc func(*models.SignedInUser) (string, error)

// ScopeResolver contains a map of functions to resolve scope keywords such as `self` or `current` into `id` based scopes
type ScopeResolver struct {
	keywordResolvers map[string]KeywordScopeResolveFunc
}

func NewScopeResolver() ScopeResolver {
	return ScopeResolver{
		keywordResolvers: map[string]KeywordScopeResolveFunc{
			"users:self": resolveUserSelf,
		},
	}
}

func resolveUserSelf(u *models.SignedInUser) (string, error) {
	return Scope("users", "id", fmt.Sprintf("%v", u.UserId)), nil
}

// ResolveKeyword resolves scope with keywords such as `self` or `current` into `id` based scopes
func (s *ScopeResolver) ResolveKeyword(user *models.SignedInUser, permission Permission) (*Permission, error) {
	if fn, ok := s.keywordResolvers[permission.Scope]; ok {
		resolvedScope, err := fn(user)
		if err != nil {
			return nil, fmt.Errorf("could not resolve %v: %v", permission.Scope, err)
		}
		permission.Scope = resolvedScope
	}
	return &permission, nil
}
