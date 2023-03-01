package api

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/infra/metrics"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	tempuser "github.com/grafana/grafana/pkg/services/temp_user"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

// GET /api/user/signup/options
func (hs *HTTPServer) GetSignUpOptions(c *contextmodel.ReqContext) response.Response {
	return response.JSON(http.StatusOK, util.DynMap{
		"verifyEmailEnabled": setting.VerifyEmailEnabled,
		"autoAssignOrg":      hs.Cfg.AutoAssignOrg,
	})
}

// POST /api/user/signup
func (hs *HTTPServer) SignUp(c *contextmodel.ReqContext) response.Response {
	form := dtos.SignUpForm{}
	var err error
	if err = web.Bind(c.Req, &form); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if !setting.AllowUserSignUp {
		return response.Error(401, "User signup is disabled", nil)
	}

	form.Email, err = ValidateAndNormalizeEmail(form.Email)
	if err != nil {
		return response.Error(http.StatusBadRequest, "Invalid email address", nil)
	}

	existing := user.GetUserByLoginQuery{LoginOrEmail: form.Email}
	_, err = hs.userService.GetByLogin(c.Req.Context(), &existing)
	if err == nil {
		return response.Error(422, "User with same email address already exists", nil)
	}

	cmd := tempuser.CreateTempUserCommand{}
	cmd.OrgID = -1
	cmd.Email = form.Email
	cmd.Status = tempuser.TmpUserSignUpStarted
	cmd.InvitedByUserID = c.UserID
	cmd.Code, err = util.GetRandomString(20)
	if err != nil {
		return response.Error(500, "Failed to generate random string", err)
	}
	cmd.RemoteAddr = c.RemoteAddr()

	if _, err := hs.tempUserService.CreateTempUser(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to create signup", err)
	}

	if err := hs.bus.Publish(c.Req.Context(), &events.SignUpStarted{
		Email: form.Email,
		Code:  cmd.Code,
	}); err != nil {
		return response.Error(500, "Failed to publish event", err)
	}

	metrics.MApiUserSignUpStarted.Inc()

	return response.JSON(http.StatusOK, util.DynMap{"status": "SignUpCreated"})
}

func (hs *HTTPServer) SignUpStep2(c *contextmodel.ReqContext) response.Response {
	form := dtos.SignUpStep2Form{}
	if err := web.Bind(c.Req, &form); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if !setting.AllowUserSignUp {
		return response.Error(401, "User signup is disabled", nil)
	}

	form.Email = strings.TrimSpace(form.Email)
	form.Username = strings.TrimSpace(form.Username)

	createUserCmd := user.CreateUserCommand{
		Email:    form.Email,
		Login:    form.Username,
		Name:     form.Name,
		Password: form.Password,
		OrgName:  form.OrgName,
	}

	// verify email
	if setting.VerifyEmailEnabled {
		if ok, rsp := hs.verifyUserSignUpEmail(c.Req.Context(), form.Email, form.Code); !ok {
			return rsp
		}
		createUserCmd.EmailVerified = true
	}

	usr, err := hs.userService.Create(c.Req.Context(), &createUserCmd)
	if err != nil {
		if errors.Is(err, user.ErrUserAlreadyExists) {
			return response.Error(401, "User with same email address already exists", nil)
		}

		return response.Error(500, "Failed to create user", err)
	}

	// publish signup event
	if err := hs.bus.Publish(c.Req.Context(), &events.SignUpCompleted{
		Email: usr.Email,
		Name:  usr.NameOrFallback(),
	}); err != nil {
		return response.Error(500, "Failed to publish event", err)
	}

	// mark temp user as completed
	if ok, rsp := hs.updateTempUserStatus(c.Req.Context(), form.Code, tempuser.TmpUserCompleted); !ok {
		return rsp
	}

	// check for pending invites
	invitesQuery := tempuser.GetTempUsersQuery{Email: form.Email, Status: tempuser.TmpUserInvitePending}
	invitesQueryResult, err := hs.tempUserService.GetTempUsersQuery(c.Req.Context(), &invitesQuery)
	if err != nil {
		return response.Error(500, "Failed to query database for invites", err)
	}

	apiResponse := util.DynMap{"message": "User sign up completed successfully", "code": "redirect-to-landing-page"}
	for _, invite := range invitesQueryResult {
		if ok, rsp := hs.applyUserInvite(c.Req.Context(), usr, invite, false); !ok {
			return rsp
		}
		apiResponse["code"] = "redirect-to-select-org"
	}

	err = hs.loginUserWithUser(usr, c)
	if err != nil {
		return response.Error(500, "failed to login user", err)
	}

	metrics.MApiUserSignUpCompleted.Inc()

	return response.JSON(http.StatusOK, apiResponse)
}

func (hs *HTTPServer) verifyUserSignUpEmail(ctx context.Context, email string, code string) (bool, response.Response) {
	query := tempuser.GetTempUserByCodeQuery{Code: code}

	queryResult, err := hs.tempUserService.GetTempUserByCode(ctx, &query)
	if err != nil {
		if errors.Is(err, tempuser.ErrTempUserNotFound) {
			return false, response.Error(404, "Invalid email verification code", nil)
		}
		return false, response.Error(500, "Failed to read temp user", err)
	}

	tempUser := queryResult
	if tempUser.Email != email {
		return false, response.Error(404, "Email verification code does not match email", nil)
	}

	return true, nil
}
