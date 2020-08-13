package api

import (
	"errors"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

// GET /api/user/signup/options
func GetSignUpOptions(c *models.ReqContext) Response {
	return JSON(200, util.DynMap{
		"verifyEmailEnabled": setting.VerifyEmailEnabled,
		"autoAssignOrg":      setting.AutoAssignOrg,
	})
}

// POST /api/user/signup
func SignUp(c *models.ReqContext, form dtos.SignUpForm) Response {
	if !setting.AllowUserSignUp {
		return Error(401, "User signup is disabled", nil)
	}

	existing := models.GetUserByLoginQuery{LoginOrEmail: form.Email}
	if err := bus.Dispatch(&existing); err == nil {
		return Error(422, "User with same email address already exists", nil)
	}

	cmd := models.CreateTempUserCommand{}
	cmd.OrgId = -1
	cmd.Email = form.Email
	cmd.Status = models.TmpUserSignUpStarted
	cmd.InvitedByUserId = c.UserId
	var err error
	cmd.Code, err = util.GetRandomString(20)
	if err != nil {
		return Error(500, "Failed to generate random string", err)
	}
	cmd.RemoteAddr = c.Req.RemoteAddr

	if err := bus.Dispatch(&cmd); err != nil {
		return Error(500, "Failed to create signup", err)
	}

	if err := bus.Publish(&events.SignUpStarted{
		Email: form.Email,
		Code:  cmd.Code,
	}); err != nil {
		return Error(500, "Failed to publish event", err)
	}

	metrics.MApiUserSignUpStarted.Inc()

	return JSON(200, util.DynMap{"status": "SignUpCreated"})
}

func (hs *HTTPServer) SignUpStep2(c *models.ReqContext, form dtos.SignUpStep2Form) Response {
	if !setting.AllowUserSignUp {
		return Error(401, "User signup is disabled", nil)
	}

	createUserCmd := models.CreateUserCommand{
		Email:    form.Email,
		Login:    form.Username,
		Name:     form.Name,
		Password: form.Password,
		OrgName:  form.OrgName,
	}

	// verify email
	if setting.VerifyEmailEnabled {
		if ok, rsp := verifyUserSignUpEmail(form.Email, form.Code); !ok {
			return rsp
		}
		createUserCmd.EmailVerified = true
	}

	// dispatch create command
	if err := bus.Dispatch(&createUserCmd); err != nil {
		if errors.Is(err, models.ErrUserAlreadyExists) {
			return Error(401, "User with same email address already exists", nil)
		}

		return Error(500, "Failed to create user", err)
	}

	// publish signup event
	user := &createUserCmd.Result
	if err := bus.Publish(&events.SignUpCompleted{
		Email: user.Email,
		Name:  user.NameOrFallback(),
	}); err != nil {
		return Error(500, "Failed to publish event", err)
	}

	// mark temp user as completed
	if ok, rsp := updateTempUserStatus(form.Code, models.TmpUserCompleted); !ok {
		return rsp
	}

	// check for pending invites
	invitesQuery := models.GetTempUsersQuery{Email: form.Email, Status: models.TmpUserInvitePending}
	if err := bus.Dispatch(&invitesQuery); err != nil {
		return Error(500, "Failed to query database for invites", err)
	}

	apiResponse := util.DynMap{"message": "User sign up completed successfully", "code": "redirect-to-landing-page"}
	for _, invite := range invitesQuery.Result {
		if ok, rsp := applyUserInvite(user, invite, false); !ok {
			return rsp
		}
		apiResponse["code"] = "redirect-to-select-org"
	}

	err := hs.loginUserWithUser(user, c)
	if err != nil {
		return Error(500, "failed to login user", err)
	}

	metrics.MApiUserSignUpCompleted.Inc()

	return JSON(200, apiResponse)
}

func verifyUserSignUpEmail(email string, code string) (bool, Response) {
	query := models.GetTempUserByCodeQuery{Code: code}

	if err := bus.Dispatch(&query); err != nil {
		if err == models.ErrTempUserNotFound {
			return false, Error(404, "Invalid email verification code", nil)
		}
		return false, Error(500, "Failed to read temp user", err)
	}

	tempUser := query.Result
	if tempUser.Email != email {
		return false, Error(404, "Email verification code does not match email", nil)
	}

	return true, nil
}
