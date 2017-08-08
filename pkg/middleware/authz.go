package middleware

import (
	"fmt"
	"net/url"

	"github.com/casbin/casbin"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"gopkg.in/macaron.v1"
)

// Authorizer returns a Casbin authorizer Handler.
func Authorizer(e *casbin.Enforcer) macaron.Handler {
	return func(c *Context) {
		user := getRole(c)
		path := c.Req.Request.URL.Path
		method := c.Req.Request.Method

		res := e.Enforce(user, path, method)
		fmt.Println(user, path, method, " --> ", res)

		if !res {
			accessForbiddenByCasbin(c)
			return
		}
	}
}

func accessForbiddenByCasbin(c *Context) {
	if c.IsApiRequest() {
		c.JsonApiErr(403, "Permission denied by Casbin", nil)
		return
	}

	c.SetCookie("redirect_to", url.QueryEscape(setting.AppSubUrl+c.Req.RequestURI), 0, setting.AppSubUrl+"/")
	c.Redirect(setting.AppSubUrl + "/login")
}

func getRole(c *Context) string {
	if !c.IsSignedIn {
		return "guest"
	}

	if c.IsGrafanaAdmin {
		return "grafana_admin"
	}

	if c.SignedInUser.OrgRole == models.ROLE_VIEWER {
		return "org_viewer"
	} else if c.SignedInUser.OrgRole == models.ROLE_EDITOR || c.SignedInUser.OrgRole == models.ROLE_READ_ONLY_EDITOR {
		return "org_editor"
	} else if c.SignedInUser.OrgRole == models.ROLE_ADMIN {
		return "org_admin"
	} else {
		return "unknown"
	}
}
