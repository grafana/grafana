package login

import (
	"github.com/gin-gonic/gin"
	"github.com/torkelo/grafana-pro/pkg/log"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	"github.com/torkelo/grafana-pro/pkg/models"
	"github.com/torkelo/grafana-pro/pkg/routes/apimodel"
)

type loginJsonModel struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
	Remember bool   `json:"remember"`
}

func LoginPost(c *middleware.Context) {
	var loginModel loginJsonModel

	if !c.JsonBody(&loginModel) {
		c.JSON(400, gin.H{"status": "bad request"})
		return
	}

	account, err := models.GetAccountByLogin(loginModel.Email)
	if err != nil {
		c.JSON(401, gin.H{"status": "unauthorized"})
		return
	}

	if loginModel.Password != account.Password {
		c.JSON(401, gin.H{"status": "unauthorized"})
		return
	}

	loginUserWithAccount(account, c)

	var resp = &apimodel.LoginResultDto{}
	resp.Status = "Logged in"
	resp.User.Login = account.Login

	c.JSON(200, resp)
}

func loginUserWithAccount(account *models.Account, c *middleware.Context) {
	if account == nil {
		log.Error(3, "Account login with nil account")
	}

	c.Session.Set("accountId", account.Id)
}

func LogoutPost(c *middleware.Context) {
	c.Session.Delete("accountId")
	c.JSON(200, gin.H{"status": "logged out"})
}
