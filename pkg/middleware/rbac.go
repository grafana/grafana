package middleware

import (
	macaron "gopkg.in/macaron.v1"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/rbac"
)

func RBACAuthorization(ac *rbac.RBACService) func() macaron.Handler {
	return func() macaron.Handler {
		return func(c *models.ReqContext) {
			c.Logger.Debug("RBAC")

			result := ac.Evaluate(c)
			if result.HasAccess {
				return
			} else {
				c.Logger.Debug("Access denied")
				accessForbidden(c)
				return
			}
		}
	}
}
