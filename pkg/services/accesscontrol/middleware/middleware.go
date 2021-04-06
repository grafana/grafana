package middleware

import (
	"bytes"
	"net/http"
	"text/template"

	macaron "gopkg.in/macaron.v1"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

func Middleware(ac accesscontrol.AccessControl) func(macaron.Handler, string, ...string) macaron.Handler {
	return func(fallback macaron.Handler, permission string, scopes ...string) macaron.Handler {
		if ac.IsDisabled() {
			return fallback
		}

		return func(c *models.ReqContext) {
			for i, scope := range scopes {
				var buf bytes.Buffer

				tmpl, err := template.New("scope").Parse(scope)
				if err != nil {
					c.JsonApiErr(http.StatusInternalServerError, "Internal server error", err)
					return
				}
				err = tmpl.Execute(&buf, c.AllParams())
				if err != nil {
					c.JsonApiErr(http.StatusInternalServerError, "Internal server error", err)
					return
				}
				scopes[i] = buf.String()
			}

			hasAccess, err := ac.Evaluate(c.Req.Context(), c.SignedInUser, permission, scopes...)
			if err != nil {
				c.Logger.Error("Error from access control system", "error", err)
				c.JsonApiErr(http.StatusForbidden, "Forbidden", nil)
				return
			}
			if !hasAccess {
				c.Logger.Info("Access denied", "userID", c.UserId, "permission", permission, "scopes", scopes)
				c.JsonApiErr(http.StatusForbidden, "Forbidden", nil)
				return
			}
		}
	}
}
