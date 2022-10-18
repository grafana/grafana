package api

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

// GET /api/user/signup/options
func GetSignUpOptions(c *models.ReqContext) response.Response {
	return response.JSON(200, util.DynMap{
		"verifyEmailEnabled": setting.VerifyEmailEnabled,
		"autoAssignOrg":      setting.AutoAssignOrg,
	})
}

// POST /api/user/signup
func (hs *HTTPServer) SignUp(c *models.ReqContext) response.Response {
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

	existing := models.GetUserByLoginQuery{LoginOrEmail: form.Email}
	if err = hs.SQLStore.GetUserByLogin(c.Req.Context(), &existing); err == nil {
		return response.Error(422, "User with same email address already exists", nil)
	}

	cmd := models.CreateTempUserCommand{}
	cmd.OrgId = -1
	cmd.Email = form.Email
	cmd.Status = models.TmpUserSignUpStarted
	cmd.InvitedByUserId = c.UserId
	cmd.Code, err = util.GetRandomString(20)
	if err != nil {
		return response.Error(500, "Failed to generate random string", err)
	}
	cmd.RemoteAddr = c.Req.RemoteAddr

	if err := hs.SQLStore.CreateTempUser(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to create signup", err)
	}

	if err := bus.Publish(c.Req.Context(), &events.SignUpStarted{
		Email: form.Email,
		Code:  cmd.Code,
	}); err != nil {
		return response.Error(500, "Failed to publish event", err)
	}

	metrics.MApiUserSignUpStarted.Inc()

	return response.JSON(200, util.DynMap{"status": "SignUpCreated"})
}

func (hs *HTTPServer) SignUpStep2(c *models.ReqContext) response.Response {
	form := dtos.SignUpStep2Form{}
	if err := web.Bind(c.Req, &form); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if !setting.AllowUserSignUp {
		return response.Error(401, "User signup is disabled", nil)
	}

	form.Email = strings.TrimSpace(form.Email)
	form.Username = strings.TrimSpace(form.Username)

	createUserCmd := models.CreateUserCommand{
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

	user, err := hs.Login.CreateUser(createUserCmd)
	if err != nil {
		if errors.Is(err, models.ErrUserAlreadyExists) {
			return response.Error(401, "User with same email address already exists", nil)
		}

		return response.Error(500, "Failed to create user", err)
	}

	// publish signup event
	if err := bus.Publish(c.Req.Context(), &events.SignUpCompleted{
		Email: user.Email,
		Name:  user.NameOrFallback(),
	}); err != nil {
		return response.Error(500, "Failed to publish event", err)
	}

	// mark temp user as completed
	if ok, rsp := hs.updateTempUserStatus(c.Req.Context(), form.Code, models.TmpUserCompleted); !ok {
		return rsp
	}

	// check for pending invites
	invitesQuery := models.GetTempUsersQuery{Email: form.Email, Status: models.TmpUserInvitePending}
	if err := hs.SQLStore.GetTempUsersQuery(c.Req.Context(), &invitesQuery); err != nil {
		return response.Error(500, "Failed to query database for invites", err)
	}

	apiResponse := util.DynMap{"message": "User sign up completed successfully", "code": "redirect-to-landing-page"}
	for _, invite := range invitesQuery.Result {
		if ok, rsp := hs.applyUserInvite(c.Req.Context(), user, invite, false); !ok {
			return rsp
		}
		apiResponse["code"] = "redirect-to-select-org"
	}

	err = hs.loginUserWithUser(user, c)
	if err != nil {
		return response.Error(500, "failed to login user", err)
	}

	metrics.MApiUserSignUpCompleted.Inc()

	return response.JSON(200, apiResponse)
}

func (hs *HTTPServer) verifyUserSignUpEmail(ctx context.Context, email string, code string) (bool, response.Response) {
	query := models.GetTempUserByCodeQuery{Code: code}

	if err := hs.SQLStore.GetTempUserByCode(ctx, &query); err != nil {
		if errors.Is(err, models.ErrTempUserNotFound) {
			return false, response.Error(404, "Invalid email verification code", nil)
		}
		return false, response.Error(500, "Failed to read temp user", err)
	}

	tempUser := query.Result
	if tempUser.Email != email {
		return false, response.Error(404, "Email verification code does not match email", nil)
	}

	return true, nil
}
