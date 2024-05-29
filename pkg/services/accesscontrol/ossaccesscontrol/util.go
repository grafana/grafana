package ossaccesscontrol

import "github.com/grafana/grafana/pkg/services/accesscontrol"

func permissionsForActions(actions []string, scope string) []accesscontrol.Permission {
	permissions := make([]accesscontrol.Permission, len(actions))

	for _, action := range actions {
		permissions = append(permissions, accesscontrol.Permission{
			Action: action,
			Scope:  scope,
		})
	}

	return permissions
}
