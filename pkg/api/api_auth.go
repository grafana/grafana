package api

import (
	"errors"
	"strconv"

	"github.com/torkelo/grafana-pro/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/sessions"
)

type authContext struct {
	account     *models.Account
	userAccount *models.Account
}

func (auth *authContext) getAccountId() int {
	return auth.account.Id
}

func (self *HttpServer) authDenied(c *gin.Context) {
	c.Writer.Header().Set("Location", "/login")
	c.Abort(302)
}

func authGetRequestAccountId(c *gin.Context, session *sessions.Session) (int, error) {
	accountId := session.Values["accountId"]

	urlQuery := c.Request.URL.Query()
	if len(urlQuery["render"]) > 0 {
		accId, _ := strconv.Atoi(urlQuery["accountId"][0])
		session.Values["accountId"] = accId
		accountId = accId
	}

	if accountId == nil {
		return -1, errors.New("Auth: session account id not found")
	}

	return accountId.(int), nil
}

func (self *HttpServer) auth() gin.HandlerFunc {
	return func(c *gin.Context) {
		session, _ := sessionStore.Get(c.Request, "grafana-session")
		accountId, err := authGetRequestAccountId(c, session)

		if err != nil && c.Request.URL.Path != "/login" {
			self.authDenied(c)
			return
		}

		account, err := self.store.GetAccount(accountId)
		if err != nil {
			self.authDenied(c)
			return
		}

		usingAccount, err := self.store.GetAccount(account.UsingAccountId)
		if err != nil {
			self.authDenied(c)
			return
		}

		c.Set("userAccount", account)
		c.Set("usingAccount", usingAccount)
		session.Save(c.Request, c.Writer)
	}
}
