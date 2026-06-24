package api

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/auth/authtest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/passkey"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
)

func TestCredentialEnrollBegin(t *testing.T) {
	const path = "/api/user/credential-enroll/begin"

	t.Run("creates a passwordless user and begins enrollment", func(t *testing.T) {
		passkeySvc := &fakePasskeyService{beginEnrollResult: &passkey.BeginResult{
			SessionID: "enroll-1",
			Options:   json.RawMessage(`{"challenge":"abc"}`),
		}}
		var gotCmd *user.CreateUserCommand
		userSvc := &usertest.FakeUserService{
			CreateFn: func(_ context.Context, cmd *user.CreateUserCommand) (*user.User, error) {
				gotCmd = cmd
				return &user.User{ID: 7, Login: cmd.Login, Email: cmd.Email}, nil
			},
		}
		cfg := setting.NewCfg()
		cfg.AllowUserSignUp = true
		cfg.Passkey.Enabled = true
		server := SetupAPITestServer(t, func(hs *HTTPServer) {
			hs.Features = featuremgmt.WithFeatures(featuremgmt.FlagGrafanaPasskeyAuthn)
			hs.passkeyService = passkeySvc
			hs.userService = userSvc
			hs.Cfg = cfg
		})

		body := `{"email":"new@example.com","username":"newbie","name":"New Bie"}`
		req := server.NewPostRequest(path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		res, err := server.Send(req)
		require.NoError(t, err)
		defer func() { require.NoError(t, res.Body.Close()) }()
		require.Equal(t, http.StatusOK, res.StatusCode)

		// The account is created with NO password — a passkey will be its only credential.
		require.NotNil(t, gotCmd)
		require.Equal(t, "newbie", gotCmd.Login)
		require.Empty(t, gotCmd.Password)
		// Enrollment begins for the created user, tagged as a signup.
		require.Equal(t, int64(7), passkeySvc.gotEnrollUser.UserID)
		require.Equal(t, passkey.EnrollSourceSignup, passkeySvc.gotEnrollSource)

		var resp passkeyBeginResponse
		require.NoError(t, json.NewDecoder(res.Body).Decode(&resp))
		require.Equal(t, "enroll-1", resp.SessionID)
	})

	t.Run("rejects when signup is disabled", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.AllowUserSignUp = false
		cfg.Passkey.Enabled = true
		server := SetupAPITestServer(t, func(hs *HTTPServer) {
			hs.Features = featuremgmt.WithFeatures(featuremgmt.FlagGrafanaPasskeyAuthn)
			hs.passkeyService = &fakePasskeyService{}
			hs.userService = &usertest.FakeUserService{}
			hs.Cfg = cfg
		})

		req := server.NewPostRequest(path, strings.NewReader(`{"email":"x@y.z","username":"x"}`))
		req.Header.Set("Content-Type", "application/json")
		res, err := server.Send(req)
		require.NoError(t, err)
		defer func() { require.NoError(t, res.Body.Close()) }()
		require.Equal(t, http.StatusUnauthorized, res.StatusCode)
	})
}

func TestCredentialEnrollFinish(t *testing.T) {
	const path = "/api/user/credential-enroll/finish"

	t.Run("verifies attestation, persists credential, and logs the user in", func(t *testing.T) {
		passkeySvc := &fakePasskeyService{finishEnrollUserID: 7, finishEnrollSource: passkey.EnrollSourceSignup}
		userSvc := &usertest.FakeUserService{ExpectedUser: &user.User{ID: 7, Login: "newbie", Email: "new@example.com"}}
		cfg := setting.NewCfg()
		cfg.LoginCookieName = "grafana_session"
		server := SetupAPITestServer(t, func(hs *HTTPServer) {
			hs.Features = featuremgmt.WithFeatures(featuremgmt.FlagGrafanaPasskeyAuthn)
			hs.passkeyService = passkeySvc
			hs.userService = userSvc
			hs.AuthTokenService = authtest.NewFakeUserAuthTokenService()
			hs.log = log.New("credential-enroll-test")
			hs.Cfg = cfg
		})

		body := `{"sessionID":"enroll-1","name":"My Laptop","response":{"id":"abc"}}`
		req := server.NewPostRequest(path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		res, err := server.Send(req)
		require.NoError(t, err)
		defer func() { require.NoError(t, res.Body.Close()) }()
		require.Equal(t, http.StatusOK, res.StatusCode)

		require.Equal(t, "enroll-1", passkeySvc.gotFinishSessionID)
		require.Equal(t, "My Laptop", passkeySvc.gotFinishName)
		// The user is logged in: a session cookie is set.
		require.NotEmpty(t, res.Cookies(), "expected a session cookie")
	})

	t.Run("expired challenge maps to 410", func(t *testing.T) {
		passkeySvc := &fakePasskeyService{finishEnrollErr: passkey.ErrChallengeExpired}
		cfg := setting.NewCfg()
		server := SetupAPITestServer(t, func(hs *HTTPServer) {
			hs.Features = featuremgmt.WithFeatures(featuremgmt.FlagGrafanaPasskeyAuthn)
			hs.passkeyService = passkeySvc
			hs.userService = &usertest.FakeUserService{}
			hs.Cfg = cfg
		})

		body := `{"sessionID":"stale","response":{"id":"abc"}}`
		req := server.NewPostRequest(path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		res, err := server.Send(req)
		require.NoError(t, err)
		defer func() { require.NoError(t, res.Body.Close()) }()
		require.Equal(t, http.StatusGone, res.StatusCode)
	})
}
