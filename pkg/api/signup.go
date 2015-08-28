package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

// POST /api/user/signup
func SignUp(c *middleware.Context, form dtos.SignUpForm) Response {
	if !setting.AllowUserSignUp {
		return ApiError(401, "User signup is disabled", nil)
	}

	existing := m.GetUserByLoginQuery{LoginOrEmail: form.Email}
	if err := bus.Dispatch(&existing); err == nil {
		return ApiError(401, "User with same email address already exists", nil)
	}

	cmd := m.CreateTempUserCommand{}
	cmd.OrgId = -1
	cmd.Email = form.Email
	cmd.Status = m.TmpUserSignUpStarted
	cmd.InvitedByUserId = c.UserId
	cmd.Code = util.GetRandomString(20)
	cmd.RemoteAddr = c.Req.RemoteAddr

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to create signup", err)
	}

	bus.Publish(&events.SignUpStarted{
		Email: form.Email,
		Code:  cmd.Code,
	})

	metrics.M_Api_User_SignUpStarted.Inc(1)

	return Json(200, util.DynMap{"status": "SignUpCreated"})
}

func SignUpStep2(c *middleware.Context, form dtos.SignUpStep2Form) Response {
	if !setting.AllowUserSignUp {
		return ApiError(401, "User signup is disabled", nil)
	}

	query := m.GetTempUserByCodeQuery{Code: form.Code}

	if err := bus.Dispatch(&query); err != nil {
		if err == m.ErrTempUserNotFound {
			return ApiError(404, "Invalid email verification code", nil)
		}
		return ApiError(500, "Failed to read temp user", err)
	}

	tempUser := query.Result
	if tempUser.Email != form.Email {
		return ApiError(404, "Email verification code does not match email", nil)
	}

	existing := m.GetUserByLoginQuery{LoginOrEmail: tempUser.Email}
	if err := bus.Dispatch(&existing); err == nil {
		return ApiError(401, "User with same email address already exists", nil)
	}

	// create user
	createUserCmd := m.CreateUserCommand{
		Email:    tempUser.Email,
		Login:    form.Username,
		Name:     form.Name,
		Password: form.Password,
		OrgName:  form.OrgName,
	}

	if err := bus.Dispatch(&createUserCmd); err != nil {
		return ApiError(500, "Failed to create user", err)
	}

	user := createUserCmd.Result

	bus.Publish(&events.SignUpCompleted{
		Email: user.Email,
		Name:  user.NameOrFallback(),
	})

	// check for pending invites
	invitesQuery := m.GetTempUsersQuery{Email: tempUser.Email, Status: m.TmpUserInvitePending}
	if err := bus.Dispatch(&invitesQuery); err != nil {
		return ApiError(500, "Failed to query database for invites", err)
	}

	loginUserWithUser(&user, c)
	metrics.M_Api_User_SignUpCompleted.Inc(1)
	return Json(200, util.DynMap{"status": "SignUpCreated"})
}
