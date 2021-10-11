package accesscontrol

import (
	"fmt"

	"github.com/grafana/grafana/pkg/models"
)

type KeywordedScopeResolveFunc func(*models.SignedInUser) (string, error)

var KeywordedScopeResolutions = map[string]KeywordedScopeResolveFunc{
	"orgs:current": resolveCurrentOrg,
	"users:self":   resolveUserSelf,
}

func resolveCurrentOrg(u *models.SignedInUser) (string, error) {
	return fmt.Sprintf("orgs:%v", u.OrgId), nil
}

func resolveUserSelf(u *models.SignedInUser) (string, error) {
	return fmt.Sprintf("users:%v", u.UserId), nil
}

// TODO: This is destructive for the input map, double check if that's ok.
func ResolvePermissionsKeywordedScopes(u *models.SignedInUser, permissions map[string]map[string]struct{}) (map[string]map[string]struct{}, error) {
	for action, scopes := range permissions {
		resolvedScopes, err := resolveKeywordedScopes(u, scopes)
		if err != nil {
			return nil, err
		}
		permissions[action] = resolvedScopes
	}
	return permissions, nil
}

// TODO: This is destructive for the input map, double check if that's ok.
func resolveKeywordedScopes(u *models.SignedInUser, scopes map[string]struct{}) (map[string]struct{}, error) {
	for scope := range scopes {
		if fn, ok := KeywordedScopeResolutions[scope]; ok {
			res, err := fn(u)
			if err != nil {
				return nil, fmt.Errorf("Could not resolve %v: %v", scope, err)
			}
			delete(scopes, scope)
			scopes[res] = struct{}{}
		}
	}
	return scopes, nil
}
