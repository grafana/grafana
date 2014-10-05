package middleware

import (
	"errors"
	"strconv"

	"github.com/Unknwon/macaron"
	"github.com/macaron-contrib/session"
	"github.com/torkelo/grafana-pro/pkg/models"
)

func authGetRequestAccountId(c *Context, sess session.Store) (int, error) {
	accountId := sess.Get("accountId")

	urlQuery := c.Req.URL.Query()
	if len(urlQuery["render"]) > 0 {
		accId, _ := strconv.Atoi(urlQuery["accountId"][0])
		sess.Set("accountId", accId)
		accountId = accId
	}

	if accountId == nil {
		return -1, errors.New("Auth: session account id not found")
	}

	return accountId.(int), nil
}

func authDenied(c *Context) {
	c.Redirect("/login")
}

func Auth() macaron.Handler {
	return func(c *Context, sess session.Store) {
		accountId, err := authGetRequestAccountId(c, sess)

		if err != nil && c.Req.URL.Path != "/login" {
			authDenied(c)
			return
		}

		account, err := models.GetAccount(accountId)
		if err != nil {
			authDenied(c)
			return
		}

		usingAccount, err := models.GetAccount(account.UsingAccountId)
		if err != nil {
			authDenied(c)
			return
		}

		c.UserAccount = account
		c.Account = usingAccount
	}
}
