package middleware

import (
	macaron "gopkg.in/macaron.v1"

	"github.com/grafana/grafana/pkg/models"
)

func Authorization(ac models.AccessControl) func() macaron.Handler {
	return func() macaron.Handler {
		return func(c *models.ReqContext) {
			c.Logger.Debug("RBAC")

			user := models.User{
				Id:    c.SignedInUser.UserId,
				OrgId: c.SignedInUser.OrgId,
				Login: c.SignedInUser.Login,
				Email: c.SignedInUser.Email,
			}
			hasAccess, err := ac.Evaluate(c, &user, "", "")
			if hasAccess {
				return
			} else {
				c.Logger.Error("Access denied", "error", err)
				accessForbidden(c)
				return
			}
		}
	}
}
