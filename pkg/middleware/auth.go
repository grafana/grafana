package middleware

import (
	"errors"
	"github.com/Unknwon/macaron"
	"github.com/macaron-contrib/session"
	"strconv"
	"strings"

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

func authByToken(c *Context) {
	header := c.Req.Header.Get("Authorization")
	parts := strings.SplitN(header, " ", 2)
	if len(parts) != 2 || parts[0] != "Bearer" {
		return
	}
	token := parts[1]
	userQuery := m.GetAccountByTokenQuery{Token: token}

	if err := bus.Dispatch(&userQuery); err != nil {
		return
	}

	usingQuery := m.GetAccountByIdQuery{Id: userQuery.Result.UsingAccountId}
	if err := bus.Dispatch(&usingQuery); err != nil {
		return
	}

	c.UserAccount = userQuery.Result
	c.Account = usingQuery.Result
}

func authBySession(c *Context, sess session.Store) {
	accountId, err := authGetRequestAccountId(c, sess)

	if err != nil && c.Req.URL.Path != "/login" {
		authDenied(c)
		return
	}

	userQuery := m.GetAccountByIdQuery{Id: accountId}
	if err := bus.Dispatch(&userQuery); err != nil {
		authDenied(c)
		return
	}

	usingQuery := m.GetAccountByIdQuery{Id: userQuery.Result.UsingAccountId}
	if err := bus.Dispatch(&usingQuery); err != nil {
		authDenied(c)
		return
	}

	c.UserAccount = userQuery.Result
	c.Account = usingQuery.Result
}

func Auth() macaron.Handler {
	return func(c *Context, sess session.Store) {
		authByToken(c)
		if c.UserAccount == nil {
			authBySession(c, sess)
		}
	}
}
