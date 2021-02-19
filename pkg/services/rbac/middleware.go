package rbac

import (
	"bytes"
	"context"
	"net/http"
	"text/template"

	macaron "gopkg.in/macaron.v1"

	"github.com/grafana/grafana/pkg/models"
)

type AccessControl interface {
	// Evaluate evaluates access to the given resource
	Evaluate(ctx context.Context, user *models.SignedInUser, permission string, scope ...string) (bool, error)
}

func Middleware(ac AccessControl) func(string, ...string) macaron.Handler {
	return func(permission string, scopes ...string) macaron.Handler {
		return func(c *models.ReqContext) {
			for i, scope := range scopes {
				var buf bytes.Buffer

				tmpl, err := template.New("scope").Parse(scope)
				if err != nil {
					c.JsonApiErr(http.StatusInternalServerError, "Internal server error", err)
				}
				err = tmpl.Execute(&buf, c.AllParams())
				if err != nil {
					c.JsonApiErr(http.StatusInternalServerError, "Internal server error", err)
				}
				scopes[i] = buf.String()
			}

			hasAccess, err := ac.Evaluate(context.TODO(), c.SignedInUser, permission, scopes...)
			if err != nil {
				c.Logger.Error("Error from access control system", "error", err)
				c.JsonApiErr(http.StatusForbidden, "Forbidden", nil)
				return
			}
			if !hasAccess {
				c.Logger.Info("Access denied", "error", err, "userID", c.UserId, "permission", permission, "scopes", scopes)
				c.JsonApiErr(http.StatusForbidden, "Forbidden", nil)
				return
			}
		}
	}
}
