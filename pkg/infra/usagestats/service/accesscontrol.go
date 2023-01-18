package service

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

const (
	ActionRead = "server.usagestats.report:read"
)

var (
	usagestatsReaderRole = accesscontrol.RoleDTO{
		Name:        "fixed:usagestats:reader",
		DisplayName: "Usage stats report reader",
		Description: "View usage statistics report",
		Group:       "Statistics",
		Permissions: []accesscontrol.Permission{
			{Action: ActionRead},
		},
	}
)

func declareFixedRoles(ac accesscontrol.Service) error {
	usagestatsReader := accesscontrol.RoleRegistration{
		Role:   usagestatsReaderRole,
		Grants: []string{string(accesscontrol.RoleGrafanaAdmin)},
	}

	return ac.DeclareFixedRoles(usagestatsReader)
}
