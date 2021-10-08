package accesscontrol

import (
	"fmt"

	"github.com/grafana/grafana/pkg/models"
)

type ScopeResolveFunc func(*models.SignedInUser) (string, error)

var ScopeResolutions = map[string]ScopeResolveFunc{
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
func ResolveGroupedPermissions(u *models.SignedInUser, permissions map[string]map[string]struct{}) (map[string]map[string]struct{}, error) {
	for action, scopes := range permissions {
		resolvedScopes, err := resolveScopes(u, scopes)
		if err != nil {
			return nil, err
		}
		permissions[action] = resolvedScopes
	}
	return permissions, nil
}

// TODO: This is destructive for the input map, double check if that's ok.
func resolveScopes(u *models.SignedInUser, scopes map[string]struct{}) (map[string]struct{}, error) {
	for scope := range scopes {
		if fn, ok := ScopeResolutions[scope]; ok {
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
