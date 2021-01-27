package middleware

import (
	macaron "gopkg.in/macaron.v1"

	"github.com/grafana/grafana/pkg/models"
)

func RBACAuthorization() macaron.Handler {
	return func(c *models.ReqContext) {
		ok := false
		c.Logger.Debug("RBAC")

		if c.SignedInUser.HasRole(models.ROLE_EDITOR) {
			ok = true
		}

		if !ok {
			c.Logger.Debug("Access denied")
			accessForbidden(c)
			return
		}
	}
}
