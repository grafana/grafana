package api

import (
	"github.com/gin-gonic/gin"
	"github.com/torkelo/grafana-pro/pkg/models"

	log "github.com/alecthomas/log4go"
)

func init() {
	addRoutes(func(self *HttpServer) {
		self.router.GET("/login", self.index)
		self.router.POST("/login", self.loginPost)
		self.router.POST("/logout", self.logoutPost)
	})
}

type loginJsonModel struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
	Remember bool   `json:"remember"`
}

func (self *HttpServer) loginPost(c *gin.Context) {
	var loginModel loginJsonModel

	if !c.EnsureBody(&loginModel) {
		c.JSON(400, gin.H{"status": "bad request"})
		return
	}

	account, err := self.store.GetAccountByLogin(loginModel.Email)
	if err != nil {
		c.JSON(400, gin.H{"status": err.Error()})
		return
	}

	if loginModel.Password != account.Password {
		c.JSON(401, gin.H{"status": "unauthorized"})
		return
	}

	loginUserWithAccount(account, c)

	var resp = &LoginResultDto{}
	resp.Status = "Logged in"
	resp.User.Login = account.Login

	c.JSON(200, resp)
}

func loginUserWithAccount(account *models.Account, c *gin.Context) {
	if account == nil {
		log.Error("Account login with nil account")
	}
	session, err := sessionStore.Get(c.Request, "grafana-session")
	if err != nil {
		log.Error("Failed to get session %v", err)
	}
	session.Values["accountId"] = account.Id
	session.Save(c.Request, c.Writer)
}

func (self *HttpServer) logoutPost(c *gin.Context) {
	session, _ := sessionStore.Get(c.Request, "grafana-session")
	session.Values = nil
	session.Save(c.Request, c.Writer)

	c.JSON(200, gin.H{"status": "logged out"})
}
