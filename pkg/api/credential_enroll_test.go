package api

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/auth/authtest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/authinfotest"
	"github.com/grafana/grafana/pkg/services/passkey"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	tempuser "github.com/grafana/grafana/pkg/services/temp_user"
	"github.com/grafana/grafana/pkg/services/temp_user/tempusertest"
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

	t.Run("reuses an abandoned passwordless account on retry", func(t *testing.T) {
		// A previous begin created this user but the ceremony was abandoned: no password, no passkey,
		// no external link. A retry must reuse the row and continue, not fail with "already exists".
		passkeySvc := &fakePasskeyService{beginEnrollResult: &passkey.BeginResult{
			SessionID: "enroll-2",
			Options:   json.RawMessage(`{"challenge":"abc"}`),
		}}
		orphan := &user.User{ID: 9, Login: "newbie", Email: "new@example.com"}
		userSvc := &usertest.FakeUserService{
			CreateFn: func(context.Context, *user.CreateUserCommand) (*user.User, error) {
				return nil, user.ErrUserAlreadyExists
			},
			GetByLoginFn: func(context.Context, *user.GetUserByLoginQuery) (*user.User, error) {
				return orphan, nil
			},
		}
		cfg := setting.NewCfg()
		cfg.AllowUserSignUp = true
		cfg.Passkey.Enabled = true
		server := SetupAPITestServer(t, func(hs *HTTPServer) {
			hs.Features = featuremgmt.WithFeatures(featuremgmt.FlagGrafanaPasskeyAuthn)
			hs.passkeyService = passkeySvc
			hs.userService = userSvc
			hs.passkeyStore = &fakePasskeyStore{}                                               // no passkey
			hs.authInfoService = &authinfotest.FakeService{ExpectedError: user.ErrUserNotFound} // no link
			hs.Cfg = cfg
		})

		body := `{"email":"new@example.com","username":"newbie","name":"New Bie"}`
		req := server.NewPostRequest(path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		res, err := server.Send(req)
		require.NoError(t, err)
		defer func() { require.NoError(t, res.Body.Close()) }()
		require.Equal(t, http.StatusOK, res.StatusCode)
		// Enrollment proceeds for the reclaimed row, not a freshly created user.
		require.Equal(t, int64(9), passkeySvc.gotEnrollUser.UserID)
	})

	t.Run("refuses to reclaim a usable account", func(t *testing.T) {
		tests := []struct {
			name     string
			orphan   *user.User
			store    *fakePasskeyStore
			authInfo *authinfotest.FakeService
		}{
			{
				name:     "has a password",
				orphan:   &user.User{ID: 9, Login: "newbie", Email: "new@example.com", Password: "hashed"},
				store:    &fakePasskeyStore{},
				authInfo: &authinfotest.FakeService{ExpectedError: user.ErrUserNotFound},
			},
			{
				name:     "already has a passkey",
				orphan:   &user.User{ID: 9, Login: "newbie", Email: "new@example.com"},
				store:    &fakePasskeyStore{listResult: []*passkey.Credential{{ID: 1}}},
				authInfo: &authinfotest.FakeService{ExpectedError: user.ErrUserNotFound},
			},
			{
				name:     "linked to an external auth provider",
				orphan:   &user.User{ID: 9, Login: "newbie", Email: "new@example.com"},
				store:    &fakePasskeyStore{},
				authInfo: &authinfotest.FakeService{ExpectedUserAuth: &login.UserAuth{}},
			},
		}
		for _, tc := range tests {
			t.Run(tc.name, func(t *testing.T) {
				userSvc := &usertest.FakeUserService{
					CreateFn: func(context.Context, *user.CreateUserCommand) (*user.User, error) {
						return nil, user.ErrUserAlreadyExists
					},
					GetByLoginFn: func(context.Context, *user.GetUserByLoginQuery) (*user.User, error) {
						return tc.orphan, nil
					},
				}
				cfg := setting.NewCfg()
				cfg.AllowUserSignUp = true
				cfg.Passkey.Enabled = true
				server := SetupAPITestServer(t, func(hs *HTTPServer) {
					hs.Features = featuremgmt.WithFeatures(featuremgmt.FlagGrafanaPasskeyAuthn)
					hs.passkeyService = &fakePasskeyService{}
					hs.userService = userSvc
					hs.passkeyStore = tc.store
					hs.authInfoService = tc.authInfo
					hs.Cfg = cfg
				})

				req := server.NewPostRequest(path, strings.NewReader(`{"email":"new@example.com","username":"newbie"}`))
				req.Header.Set("Content-Type", "application/json")
				res, err := server.Send(req)
				require.NoError(t, err)
				defer func() { require.NoError(t, res.Body.Close()) }()
				require.Equal(t, http.StatusUnauthorized, res.StatusCode)
			})
		}
	})

	t.Run("is gated by the user quota", func(t *testing.T) {
		// begin creates the user, so it must honour the same account cap as password signup.
		cfg := setting.NewCfg()
		cfg.AllowUserSignUp = true
		cfg.Passkey.Enabled = true
		server := SetupAPITestServer(t, func(hs *HTTPServer) {
			hs.Features = featuremgmt.WithFeatures(featuremgmt.FlagGrafanaPasskeyAuthn)
			hs.passkeyService = &fakePasskeyService{}
			hs.userService = &usertest.FakeUserService{}
			hs.QuotaService = quotatest.New(true, nil) // quota reached
			hs.Cfg = cfg
		})

		req := server.NewPostRequest(path, strings.NewReader(`{"email":"new@example.com","username":"newbie"}`))
		req.Header.Set("Content-Type", "application/json")
		res, err := server.Send(req)
		require.NoError(t, err)
		defer func() { require.NoError(t, res.Body.Close()) }()
		require.Equal(t, http.StatusForbidden, res.StatusCode)
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

	t.Run("verifies attestation, persists credential, logs in, and completes the signup", func(t *testing.T) {
		passkeySvc := &fakePasskeyService{finishEnrollUserID: 7, finishEnrollSource: passkey.EnrollSourceSignup}
		userSvc := &usertest.FakeUserService{ExpectedUser: &user.User{ID: 7, Login: "newbie", Email: "new@example.com"}}

		// Capture the signup-completed event and the pending-invite lookup so we can assert the same
		// account-completion steps SignUpStep2 performs also run for a passwordless signup.
		eventBus := bus.ProvideBus(tracing.InitializeTracerForTest())
		var completedEmail string
		eventBus.AddEventListener(func(_ context.Context, e *events.SignUpCompleted) error {
			completedEmail = e.Email
			return nil
		})
		var invitesEmail string
		tempUserSvc := &tempusertest.FakeTempUserService{
			GetTempUsersQueryFN: func(_ context.Context, q *tempuser.GetTempUsersQuery) ([]*tempuser.TempUserDTO, error) {
				invitesEmail = q.Email
				return nil, nil
			},
		}

		cfg := setting.NewCfg()
		cfg.LoginCookieName = "grafana_session"
		server := SetupAPITestServer(t, func(hs *HTTPServer) {
			hs.Features = featuremgmt.WithFeatures(featuremgmt.FlagGrafanaPasskeyAuthn)
			hs.passkeyService = passkeySvc
			hs.userService = userSvc
			hs.bus = eventBus
			hs.tempUserService = tempUserSvc
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
		// Signup completion ran: the event fired and pending invites were checked for this email.
		require.Equal(t, "new@example.com", completedEmail)
		require.Equal(t, "new@example.com", invitesEmail)
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
