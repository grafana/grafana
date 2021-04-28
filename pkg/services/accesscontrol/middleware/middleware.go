package middleware

import (
	"bytes"
	"fmt"
	"net/http"
	"text/template"
	"time"

	"github.com/grafana/grafana/pkg/util"

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
			// We need this otherwise templated scopes get initialized only once, during the first call
			runtimeScope := make([]string, len(scopes))
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
				runtimeScope[i] = buf.String()
			}

			hasAccess, err := ac.Evaluate(c.Req.Context(), c.SignedInUser, permission, runtimeScope...)
			if err != nil {
				c.Logger.Error("Error from access control system", "error", err)
				c.JsonApiErr(http.StatusForbidden, "Forbidden", nil)
				return
			}
			if !hasAccess {
				// Less ambiguity than alphanumerical.
				base32 := []byte("0123456789")
				randomizedID, err := util.GetRandomString(8, base32...)
				if err != nil {
					randomizedID = fmt.Sprintf("%d", time.Now().UnixNano())
				}
				randomizedID = "ACE" + randomizedID
				c.Logger.Info("Access denied",
					"userID", c.UserId,
					"permission", permission,
					"scopes", runtimeScope,
					"accessErrorID", randomizedID)
				c.JsonApiErr(http.StatusForbidden, fmt.Sprintf("Access denied. [Access error ID: %s]", randomizedID), nil)
				return
			}
		}
	}
}
