package api

import (
	"github.com/torkelo/grafana-pro/pkg/api/dtos"
	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/log"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
	"github.com/torkelo/grafana-pro/pkg/util"
)

func LoginView(c *middleware.Context) {
	if err := setIndexViewData(c); err != nil {
		c.Handle(500, "Failed to get settings", err)
		return
	}

	c.HTML(200, "index")
}

func LoginPost(c *middleware.Context, cmd dtos.LoginCommand) {

	userQuery := m.GetUserByLoginQuery{LoginOrEmail: cmd.User}
	err := bus.Dispatch(&userQuery)

	if err != nil {
		c.JsonApiErr(401, "Invalid username or password", err)
		return
	}

	user := userQuery.Result

	passwordHashed := util.EncodePassword(cmd.Password, user.Salt)
	if passwordHashed != user.Password {
		c.JsonApiErr(401, "Invalid username or password", err)
		return
	}

	loginUserWithUser(user, c)

	c.JsonOK("User logged in")
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
