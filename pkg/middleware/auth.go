package middleware

import (
	"errors"
	"strconv"

	"github.com/Unknwon/macaron"
	"github.com/macaron-contrib/session"

	"github.com/torkelo/grafana-pro/pkg/bus"
	m "github.com/torkelo/grafana-pro/pkg/models"
	"github.com/torkelo/grafana-pro/pkg/setting"
)

func authGetRequestAccountId(c *Context, sess session.Store) (int64, error) {
	accountId := sess.Get("accountId")

	urlQuery := c.Req.URL.Query()

	// TODO: check that this is a localhost request
	if len(urlQuery["render"]) > 0 {
		accId, _ := strconv.ParseInt(urlQuery["accountId"][0], 10, 64)
		sess.Set("accountId", accId)
		accountId = accId
	}

	if accountId == nil {
		if setting.Anonymous {
			return setting.AnonymousAccountId, nil
		}

		return -1, errors.New("Auth: session account id not found")
	}

	return accountId.(int64), nil
}

func authDenied(c *Context) {
	c.Redirect(setting.AppSubUrl + "/login")
}

func Auth() macaron.Handler {
	return func(c *Context, sess session.Store) {
		accountId, err := authGetRequestAccountId(c, sess)

		if err != nil && c.Req.URL.Path != "/login" {
			authDenied(c)
			return
		}

		userQuery := m.GetAccountByIdQuery{Id: accountId}
		err = bus.Dispatch(&userQuery)
		if err != nil {
			authDenied(c)
			return
		}

		usingQuery := m.GetAccountByIdQuery{Id: userQuery.Result.UsingAccountId}
		err = bus.Dispatch(&usingQuery)
		if err != nil {
			authDenied(c)
			return
		}

		c.UserAccount = userQuery.Result
		c.Account = usingQuery.Result
	}
}
