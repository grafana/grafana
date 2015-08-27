package api

import (
<<<<<<< aaf45d229a76bf7461b0e22adf2a0fddb6c4a352
<<<<<<< a84f1f0a3df6380f5a6561dd65aca819f7df5e8a
	"github.com/Cepave/grafana/pkg/api/dtos"
=======
>>>>>>> Replace the import path with github.com/Cepave/grafana.
	"github.com/Cepave/grafana/pkg/bus"
	"github.com/Cepave/grafana/pkg/events"
	"github.com/Cepave/grafana/pkg/metrics"
	"github.com/Cepave/grafana/pkg/middleware"
	m "github.com/Cepave/grafana/pkg/models"
	"github.com/Cepave/grafana/pkg/setting"
<<<<<<< a84f1f0a3df6380f5a6561dd65aca819f7df5e8a
	"github.com/Cepave/grafana/pkg/util"
=======
>>>>>>> Replace the import path with github.com/Cepave/grafana.
=======
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
>>>>>>> feat(signup): began work on new / alternate signup flow that includes email verification, #2353
)

// GET /api/user/signup/options
func GetSignUpOptions(c *middleware.Context) Response {
	return Json(200, util.DynMap{
		"verifyEmailEnabled": setting.VerifyEmailEnabled,
		"autoAssignOrg":      setting.AutoAssignOrg,
	})
}

// POST /api/user/signup
func SignUp(c *middleware.Context, form dtos.SignUpForm) Response {
	if !setting.AllowUserSignUp {
		return ApiError(401, "User signup is disabled", nil)
	}

	existing := m.GetUserByLoginQuery{LoginOrEmail: form.Email}
	if err := bus.Dispatch(&existing); err == nil {
<<<<<<< aaf45d229a76bf7461b0e22adf2a0fddb6c4a352
		return ApiError(422, "User with same email address already exists", nil)
=======
		return ApiError(401, "User with same email address already exists", nil)
>>>>>>> feat(signup): began work on new / alternate signup flow that includes email verification, #2353
	}

	cmd := m.CreateTempUserCommand{}
	cmd.OrgId = -1
	cmd.Email = form.Email
	cmd.Status = m.TmpUserSignUpStarted
	cmd.InvitedByUserId = c.UserId
<<<<<<< aaf45d229a76bf7461b0e22adf2a0fddb6c4a352
	cmd.Code = util.GetRandomString(20)
=======
	cmd.Code = util.GetRandomString(10)
>>>>>>> feat(signup): began work on new / alternate signup flow that includes email verification, #2353
	cmd.RemoteAddr = c.Req.RemoteAddr

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to create signup", err)
	}

<<<<<<< aaf45d229a76bf7461b0e22adf2a0fddb6c4a352
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

	createUserCmd := m.CreateUserCommand{
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

	// check if user exists
	existing := m.GetUserByLoginQuery{LoginOrEmail: form.Email}
	if err := bus.Dispatch(&existing); err == nil {
		return ApiError(401, "User with same email address already exists", nil)
	}

	// dispatch create command
	if err := bus.Dispatch(&createUserCmd); err != nil {
		return ApiError(500, "Failed to create user", err)
	}

	// publish signup event
	user := &createUserCmd.Result
	bus.Publish(&events.SignUpCompleted{
		Email: user.Email,
		Name:  user.NameOrFallback(),
	})

	// mark temp user as completed
	if ok, rsp := updateTempUserStatus(form.Code, m.TmpUserCompleted); !ok {
		return rsp
	}

	// check for pending invites
	invitesQuery := m.GetTempUsersQuery{Email: form.Email, Status: m.TmpUserInvitePending}
	if err := bus.Dispatch(&invitesQuery); err != nil {
		return ApiError(500, "Failed to query database for invites", err)
	}

	apiResponse := util.DynMap{"message": "User sign up completed succesfully", "code": "redirect-to-landing-page"}
	for _, invite := range invitesQuery.Result {
		if ok, rsp := applyUserInvite(user, invite, false); !ok {
			return rsp
		}
		apiResponse["code"] = "redirect-to-select-org"
	}

	loginUserWithUser(user, c)
	metrics.M_Api_User_SignUpCompleted.Inc(1)

	return Json(200, apiResponse)
}

func verifyUserSignUpEmail(email string, code string) (bool, Response) {
	query := m.GetTempUserByCodeQuery{Code: code}

	if err := bus.Dispatch(&query); err != nil {
		if err == m.ErrTempUserNotFound {
			return false, ApiError(404, "Invalid email verification code", nil)
		}
		return false, ApiError(500, "Failed to read temp user", err)
	}

	tempUser := query.Result
	if tempUser.Email != email {
		return false, ApiError(404, "Email verification code does not match email", nil)
	}

	return true, nil
=======
	// user := cmd.Resu

	bus.Publish(&events.UserSignedUp{Email: form.Email})

	//
	// loginUserWithUser(&user, c)
	//
	//

	metrics.M_Api_User_SignUpStarted.Inc(1)
	return ApiSuccess("User created and logged in")
>>>>>>> feat(signup): began work on new / alternate signup flow that includes email verification, #2353
}
