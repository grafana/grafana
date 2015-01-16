package middleware

import (
	"errors"
	"strconv"
	"strings"

	"github.com/Unknwon/macaron"

	"github.com/torkelo/grafana-pro/pkg/bus"
	m "github.com/torkelo/grafana-pro/pkg/models"
	"github.com/torkelo/grafana-pro/pkg/setting"
)

type AuthOptions struct {
	ReqGrafanaAdmin bool
	ReqSignedIn     bool
}

func getRequestAccountId(c *Context) (int64, error) {
	accountId := c.Session.Get("accountId")

	if accountId != nil {
		return accountId.(int64), nil
	}

	// localhost render query
	urlQuery := c.Req.URL.Query()
	if len(urlQuery["render"]) > 0 {
		accId, _ := strconv.ParseInt(urlQuery["accountId"][0], 10, 64)
		c.Session.Set("accountId", accId)
		accountId = accId
	}

	// check api token
	header := c.Req.Header.Get("Authorization")
	parts := strings.SplitN(header, " ", 2)
	if len(parts) == 2 || parts[0] == "Bearer" {
		token := parts[1]
		userQuery := m.GetAccountByTokenQuery{Token: token}
		if err := bus.Dispatch(&userQuery); err != nil {
			return -1, err
		}
		return userQuery.Result.Id, nil
	}

	// anonymous gues user
	if setting.Anonymous {
		return setting.AnonymousAccountId, nil
	}

	return -1, errors.New("Auth: session account id not found")
}

func authDenied(c *Context) {
	if c.IsApiRequest() {
		c.JsonApiErr(401, "Access denied", nil)
	}

	c.Redirect(setting.AppSubUrl + "/login")
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
