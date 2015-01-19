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

	userQuery := m.GetUserByLoginQuery{LoginOrEmail: loginModel.Email}
	err := bus.Dispatch(&userQuery)

	if err != nil {
		c.JsonApiErr(401, "Invalid username or password", err)
		return
	}

	user := userQuery.Result

	passwordHashed := util.EncodePassword(loginModel.Password, user.Salt)
	if passwordHashed != user.Password {
		c.JsonApiErr(401, "Invalid username or password", err)
		return
	}

	loginUserWithUser(user, c)

	var resp = &dtos.LoginResult{}
	resp.Status = "Logged in"
	resp.User.Login = user.Login

	c.JSON(200, resp)
}

func loginUserWithUser(user *m.User, c *middleware.Context) {
	if user == nil {
		log.Error(3, "User login with nil user")
	}

	c.Session.Set("userId", user.Id)
}

func LogoutPost(c *middleware.Context) {
	c.Session.Delete("userId")
	c.JSON(200, util.DynMap{"status": "logged out"})
}
