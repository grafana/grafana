package accesscontrol

import (
	"fmt"

	"github.com/grafana/grafana/pkg/models"
)

type KeywordScopeResolveFunc func(*models.SignedInUser) (string, error)

// ScopeResolver contains a map of functions to resolve scope keywords such as `self` or `current` into `id` based scopes
type ScopeResolver struct {
	keywordResolvers map[string]KeywordScopeResolveFunc
}

func NewScopeResolver() ScopeResolver {
	return ScopeResolver{
		keywordResolvers: map[string]KeywordScopeResolveFunc{
			"orgs:current": resolveCurrentOrg,
			"users:self":   resolveUserSelf,
		},
	}
}

func resolveCurrentOrg(u *models.SignedInUser) (string, error) {
	return Scope("orgs", "id", fmt.Sprintf("%v", u.OrgId)), nil
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
