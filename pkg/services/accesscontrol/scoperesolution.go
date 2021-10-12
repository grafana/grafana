package accesscontrol

import (
	"fmt"

	"github.com/grafana/grafana/pkg/models"
)

type KeywordScopeResolveFunc func(*models.SignedInUser) (string, error)

// TODO should I encapsulate this map in an object not to have a package variable?
var keywordScopeResolutions = map[string]KeywordScopeResolveFunc{
	"orgs:current": resolveCurrentOrg,
	"users:self":   resolveUserSelf,
}

func resolveCurrentOrg(u *models.SignedInUser) (string, error) {
	return Scope("orgs", "id", fmt.Sprintf("%v", u.OrgId)), nil
}

func resolveUserSelf(u *models.SignedInUser) (string, error) {
	return Scope("users", "id", fmt.Sprintf("%v", u.UserId)), nil
}

// ResolveKeywordScope resolves scope with keywords such as `self` or `current` for instance into `id` based scopes
func ResolveKeywordScope(user *models.SignedInUser, permission Permission) (*Permission, error) {
	if fn, ok := keywordScopeResolutions[permission.Scope]; ok {
		resolvedScope, err := fn(user)
		if err != nil {
			return nil, fmt.Errorf("could not resolve %v: %v", permission.Scope, err)
		}
		permission.Scope = resolvedScope
	}
	return &permission, nil
}
