package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

func AdminSearchUsers(c *middleware.Context) {
	query := m.SearchUsersQuery{Query: "", Page: 0, Limit: 1000}
	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(500, "Failed to fetch users", err)
		return
	}

	c.JSON(200, query.Result)
}

func AdminGetUser(c *middleware.Context) {
	userId := c.ParamsInt64(":id")

	query := m.GetUserByIdQuery{Id: userId}

	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(500, "Failed to fetch user", err)
		return
	}

	result := m.UserDTO{
		Name:           query.Result.Name,
		Email:          query.Result.Email,
		Login:          query.Result.Login,
		IsGrafanaAdmin: query.Result.IsAdmin,
	}

	c.JSON(200, result)
}

func AdminCreateUser(c *middleware.Context, form dtos.AdminCreateUserForm) {
	cmd := m.CreateUserCommand{
		Login:    form.Login,
		Email:    form.Email,
		Password: form.Password,
		Name:     form.Name,
	}

	if len(cmd.Login) == 0 {
		cmd.Login = cmd.Email
		if len(cmd.Login) == 0 {
			c.JsonApiErr(400, "Validation error, need specify either username or email", nil)
			return
		}
	}

	if len(cmd.Password) < 4 {
		c.JsonApiErr(400, "Password is missing or too short", nil)
		return
	}

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "failed to create user", err)
		return
	}

	c.JsonOK("User created")
}

func AdminUpdateUser(c *middleware.Context, form dtos.AdminUpdateUserForm) {
	userId := c.ParamsInt64(":id")

	cmd := m.UpdateUserCommand{
		UserId: userId,
		Login:  form.Login,
		Email:  form.Email,
		Name:   form.Name,
	}

	if len(cmd.Login) == 0 {
		cmd.Login = cmd.Email
		if len(cmd.Login) == 0 {
			c.JsonApiErr(400, "Validation error, need specify either username or email", nil)
			return
		}
	}

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "failed to update user", err)
		return
	}

	c.JsonOK("User updated")
}

func AdminUpdateUserPassword(c *middleware.Context, form dtos.AdminUpdateUserPasswordForm) {
	userId := c.ParamsInt64(":id")

	if len(form.Password) < 4 {
		c.JsonApiErr(400, "New password too short", nil)
		return
	}

	userQuery := m.GetUserByIdQuery{Id: userId}

	if err := bus.Dispatch(&userQuery); err != nil {
		c.JsonApiErr(500, "Could not read user from database", err)
		return
	}

	passwordHashed := util.EncodePassword(form.Password, userQuery.Result.Salt)

	cmd := m.ChangeUserPasswordCommand{
		UserId:      userId,
		NewPassword: passwordHashed,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to update user password", err)
		return
	}

	c.JsonOK("User password updated")
}

func AdminUpdateUserPermissions(c *middleware.Context, form dtos.AdminUpdateUserPermissionsForm) {
	userId := c.ParamsInt64(":id")

	cmd := m.UpdateUserPermissionsCommand{
		UserId:         userId,
		IsGrafanaAdmin: form.IsGrafanaAdmin,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to update user permissions", err)
		return
	}

	c.JsonOK("User permissions updated")
}

func AdminDeleteUser(c *middleware.Context) {
	userId := c.ParamsInt64(":id")

	cmd := m.DeleteUserCommand{UserId: userId}

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to delete user", err)
		return
	}

	c.JsonOK("User deleted")
}
