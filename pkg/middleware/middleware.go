package middleware

import "github.com/grafana/grafana/pkg/models"

var (
	ReqGrafanaAdmin = Auth(&AuthOptions{
		ReqSignedIn:     true,
		ReqGrafanaAdmin: true,
	})
	ReqSignedIn   = Auth(&AuthOptions{ReqSignedIn: true})
	ReqEditorRole = RoleAuth(models.ROLE_EDITOR, models.ROLE_ADMIN)
	ReqOrgAdmin   = RoleAuth(models.ROLE_ADMIN)
)
