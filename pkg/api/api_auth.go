package api

import (
	"github.com/gin-gonic/gin"
	"github.com/torkelo/grafana-pro/pkg/models"
)

type authContext struct {
	account     *models.UserAccount
	userAccount *models.UserAccount
}

func (auth *authContext) getAccountId() int {
	return auth.account.Id
}

func (self *HttpServer) authDenied(c *gin.Context) {
	c.Writer.Header().Set("Location", "/login")
	c.Abort(302)
}

func (self *HttpServer) auth() gin.HandlerFunc {
	return func(c *gin.Context) {
		session, _ := sessionStore.Get(c.Request, "grafana-session")

		if c.Request.URL.Path != "/login" && session.Values["userAccountId"] == nil {
			self.authDenied(c)
			return
		}

		account, err := self.store.GetAccount(session.Values["userAccountId"].(int))
		if err != nil {
			self.authDenied(c)
			return
		}

		usingAccount, err := self.store.GetAccount(session.Values["usingAccountId"].(int))
		if err != nil {
			self.authDenied(c)
			return
		}

		c.Set("userAccount", account)
		c.Set("usingAccount", usingAccount)

		session.Save(c.Request, c.Writer)
	}
}
