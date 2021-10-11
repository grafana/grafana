package accesscontrol

import (
	"fmt"

	"github.com/grafana/grafana/pkg/models"
)

type KeywordScopeResolveFunc func(*models.SignedInUser) (string, error)

// TODO should I encapsulate this map in an object not to have a package variable
var keywordScopeResolutions = map[string]KeywordScopeResolveFunc{
	"orgs:current": resolveCurrentOrg,
	"users:self":   resolveUserSelf,
}

func resolveCurrentOrg(u *models.SignedInUser) (string, error) {
	return fmt.Sprintf("orgs:%v", u.OrgId), nil
}

func resolveUserSelf(u *models.SignedInUser) (string, error) {
	return fmt.Sprintf("users:%v", u.UserId), nil
}

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
