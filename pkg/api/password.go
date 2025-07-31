package api

import (
	"context"
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) SendResetPasswordEmail(c *contextmodel.ReqContext) response.Response {
	cfg := hs.Cfg.Get()
	if cfg.DisableLoginForm || cfg.DisableLogin {
		return response.Error(http.StatusUnauthorized, "Not allowed to reset password when login form is disabled", nil)
	}

	form := dtos.SendResetPasswordEmailForm{}
	if err := web.Bind(c.Req, &form); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	userQuery := user.GetUserByLoginQuery{LoginOrEmail: form.UserOrEmail}

	usr, err := hs.userService.GetByLogin(c.Req.Context(), &userQuery)
	if err != nil {
		c.Logger.Info("Requested password reset for user that was not found", "user", userQuery.LoginOrEmail, "error", err)
		return response.Error(http.StatusOK, "Email sent", nil)
	}

	if usr.IsDisabled {
		c.Logger.Info("Requested password reset for disabled user", "user", userQuery.LoginOrEmail)
		return response.Error(http.StatusOK, "Email sent", nil)
	}

	getAuthQuery := login.GetAuthInfoQuery{UserId: usr.ID}
	if authInfo, err := hs.authInfoService.GetAuthInfo(c.Req.Context(), &getAuthQuery); err == nil {
		if hs.isProviderEnabled(hs.Cfg, authInfo.AuthModule) {
			c.Logger.Info("Requested password reset for external user", nil)
			return response.Error(http.StatusOK, "Email sent", nil)
		}
	}

	emailCmd := notifications.SendResetPasswordEmailCommand{User: usr}
	if err := hs.NotificationService.SendResetPasswordEmail(c.Req.Context(), &emailCmd); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to send email", err)
	}

	return response.Success("Email sent")
}

func (hs *HTTPServer) ResetPassword(c *contextmodel.ReqContext) response.Response {
	cfg := hs.Cfg.Get()
	if cfg.DisableLoginForm || cfg.DisableLogin {
		return response.Error(http.StatusUnauthorized,
			"Not allowed to reset password when grafana authentication is disabled", nil)
	}

	form := dtos.ResetUserPasswordForm{}
	if err := web.Bind(c.Req, &form); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	if form.NewPassword != form.ConfirmPassword {
		return response.Error(http.StatusBadRequest, "Passwords do not match", nil)
	}

	query := notifications.ValidateResetPasswordCodeQuery{Code: form.Code}

	// For now the only way to know the username to clear login attempts for is
	// to set it in the function provided to NotificationService
	var username string
	getUserByLogin := func(ctx context.Context, login string) (*user.User, error) {
		username = login
		userQuery := user.GetUserByLoginQuery{LoginOrEmail: login}
		usr, err := hs.userService.GetByLogin(ctx, &userQuery)
		return usr, err
	}

	userResult, err := hs.NotificationService.ValidateResetPasswordCode(c.Req.Context(), &query, getUserByLogin)
	if err != nil {
		if errors.Is(err, notifications.ErrInvalidEmailCode) {
			return response.Error(http.StatusBadRequest, "Invalid or expired reset password code", nil)
		}
		return response.Error(http.StatusInternalServerError, "Unknown error validating email code", err)
	}

	if response := hs.errOnExternalUser(c.Req.Context(), userResult.ID); response != nil {
		return response
	}

	if err := hs.userService.Update(c.Req.Context(), &user.UpdateUserCommand{UserID: userResult.ID, Password: &form.ConfirmPassword}); err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "Failed to change user password", err)
	}

	if err := hs.loginAttemptService.Reset(c.Req.Context(), username); err != nil {
		c.Logger.Warn("could not reset login attempts", "err", err, "username", username)
	}

	if err := hs.AuthTokenService.RevokeAllUserTokens(c.Req.Context(),
		userResult.ID); err != nil {
		return response.Error(http.StatusExpectationFailed,
			"User password updated but unable to revoke user sessions", err)
	}

	return response.Success("User password changed")
}
