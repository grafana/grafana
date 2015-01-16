package middleware

import (
	"strings"

	"github.com/Unknwon/macaron"

	m "github.com/torkelo/grafana-pro/pkg/models"
	"github.com/torkelo/grafana-pro/pkg/setting"
)

type AuthOptions struct {
	ReqGrafanaAdmin bool
	ReqSignedIn     bool
}

func getRequestAccountId(c *Context) int64 {
	accountId := c.Session.Get("accountId")

	if accountId != nil {
		return accountId.(int64)
	}

	// TODO: figure out a way to secure this
	if c.Query("render") == "1" {
		accountId := c.QueryInt64("accountId")
		c.Session.Set("accountId", accountId)
		return accountId
	}

	return 0
}

func getApiToken(c *Context) string {
	header := c.Req.Header.Get("Authorization")
	parts := strings.SplitN(header, " ", 2)
	if len(parts) == 2 || parts[0] == "Bearer" {
		token := parts[1]
		return token
	}

	return ""
}

func authDenied(c *Context) {
	if c.IsApiRequest() {
		c.JsonApiErr(401, "Access denied", nil)
	}

	c.Redirect(setting.AppSubUrl + "/login")
}

func RoleAuth(roles ...m.RoleType) macaron.Handler {
	return func(c *Context) {
		ok := false
		for _, role := range roles {
			if role == c.UserRole {
				ok = true
				break
			}
		}
		if !ok {
			authDenied(c)
		}
	}
}

func Auth(options *AuthOptions) macaron.Handler {
	return func(c *Context) {

		if !c.IsSignedIn && options.ReqSignedIn {
			authDenied(c)
			return
		}

		if !c.IsGrafanaAdmin && options.ReqGrafanaAdmin {
			authDenied(c)
			return
		}
	}
}
