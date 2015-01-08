package api

import (
	"github.com/torkelo/grafana-pro/pkg/api/dtos"
	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/log"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
	"github.com/torkelo/grafana-pro/pkg/util"
)

type loginJsonModel struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
	Remember bool   `json:"remember"`
}

func LoginPost(c *middleware.Context) {
	var loginModel loginJsonModel

	if !c.JsonBody(&loginModel) {
		c.JSON(400, util.DynMap{"message": "bad request"})
		return
	}

	userQuery := m.GetAccountByLoginQuery{Login: loginModel.Email}
	err := bus.Dispatch(&userQuery)

	if err != nil {
		c.JsonApiErr(401, "Invalid username or password", err)
		return
	}

	account := userQuery.Result

	passwordHashed := util.EncodePassword(loginModel.Password, account.Salt)
	if passwordHashed != account.Password {
		c.JsonApiErr(401, "Invalid username or password", err)
		return
	}

	loginUserWithAccount(account, c)

	var resp = &dtos.LoginResult{}
	resp.Status = "Logged in"
	resp.User.Login = account.Login

	c.JSON(200, resp)
}

func loginUserWithAccount(account *m.Account, c *middleware.Context) {
	if account == nil {
		log.Error(3, "Account login with nil account")
	}

	c.Session.Set("accountId", account.Id)
}

func LogoutPost(c *middleware.Context) {
	c.Session.Delete("accountId")
	c.JSON(200, util.DynMap{"status": "logged out"})
}
