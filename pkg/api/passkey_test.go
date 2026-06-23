package api

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	loginservice "github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/loginattempt/loginattempttest"
	"github.com/grafana/grafana/pkg/services/passkey"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web/webtest"
)

// fakePasskeyService is a test double for passkey.Service that records its arguments and returns
// canned results. Assertions are on the handler's HTTP output and on the arguments forwarded here,
// never on the fake itself.
type fakePasskeyService struct {
	beginLoginResult *passkey.BeginResult
	beginLoginErr    error

	beginRegResult *passkey.BeginResult
	beginRegErr    error
	gotRegUser     passkey.RegisteringUser

	finishRegCred *passkey.Credential
	finishRegErr  error
}

func (f *fakePasskeyService) BeginLogin(context.Context) (*passkey.BeginResult, error) {
	return f.beginLoginResult, f.beginLoginErr
}

func (f *fakePasskeyService) FinishLogin(context.Context, string, []byte) (int64, error) {
	return 0, nil
}

func (f *fakePasskeyService) BeginRegistration(_ context.Context, u passkey.RegisteringUser) (*passkey.BeginResult, error) {
	f.gotRegUser = u
	return f.beginRegResult, f.beginRegErr
}

func (f *fakePasskeyService) FinishRegistration(context.Context, string, passkey.RegisteringUser, string, []byte) (*passkey.Credential, error) {
	return f.finishRegCred, f.finishRegErr
}

// fakePasskeyStore is a test double for passkey.Store. Rename/Delete record their user-scoped
// arguments so the tests can prove the handler keys off the session user, not the request body.
type fakePasskeyStore struct {
	listResult []*passkey.Credential

	renamedID     int64
	renamedUserID int64
	renamedName   string

	deletedID     int64
	deletedUserID int64
}

func (f *fakePasskeyStore) Create(context.Context, *passkey.Credential) error { return nil }
func (f *fakePasskeyStore) GetByCredentialID(context.Context, []byte) (*passkey.Credential, error) {
	return nil, nil
}
func (f *fakePasskeyStore) ListByUser(context.Context, int64) ([]*passkey.Credential, error) {
	return f.listResult, nil
}
func (f *fakePasskeyStore) RecordUse(context.Context, int64, int64) error { return nil }
func (f *fakePasskeyStore) Rename(_ context.Context, id, userID int64, name string) error {
	f.renamedID, f.renamedUserID, f.renamedName = id, userID, name
	return nil
}
func (f *fakePasskeyStore) Delete(_ context.Context, id, userID int64) error {
	f.deletedID, f.deletedUserID = id, userID
	return nil
}

func setupPasskeyServer(t *testing.T, svc passkey.Service, store passkey.Store, authnSvc authn.Service) *webtest.Server {
	t.Helper()
	return SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.Features = featuremgmt.WithFeatures(featuremgmt.FlagGrafanaPasskeyAuthn)
		hs.passkeyService = svc
		hs.passkeyStore = store
		hs.loginAttemptService = &loginattempttest.FakeLoginAttemptService{ExpectedValid: true}
		if authnSvc != nil {
			hs.authnService = authnSvc
		}
	})
}

func TestPasskeyLoginBegin(t *testing.T) {
	svc := &fakePasskeyService{beginLoginResult: &passkey.BeginResult{
		SessionID: "sess-1",
		Options:   json.RawMessage(`{"challenge":"abc"}`),
	}}
	server := setupPasskeyServer(t, svc, &fakePasskeyStore{}, nil)

	res, err := server.Send(server.NewPostRequest("/api/auth/passkey/login/begin", nil))
	require.NoError(t, err)
	defer func() { require.NoError(t, res.Body.Close()) }()
	require.Equal(t, http.StatusOK, res.StatusCode)

	var body passkeyBeginResponse
	require.NoError(t, json.NewDecoder(res.Body).Decode(&body))
	require.Equal(t, "sess-1", body.SessionID)
	require.JSONEq(t, `{"challenge":"abc"}`, string(body.Options))
}

func TestPasskeyLoginFinish(t *testing.T) {
	finishBody := `{"sessionId":"sess-1","response":{"id":"abc"}}`

	t.Run("expired challenge maps to 410", func(t *testing.T) {
		authnSvc := &authntest.FakeService{ExpectedErr: passkey.ErrChallengeExpired}
		server := setupPasskeyServer(t, &fakePasskeyService{}, &fakePasskeyStore{}, authnSvc)

		res, err := server.Send(server.NewPostRequest("/api/auth/passkey/login/finish", strings.NewReader(finishBody)))
		require.NoError(t, err)
		defer func() { require.NoError(t, res.Body.Close()) }()

		require.Equal(t, http.StatusGone, res.StatusCode)
		require.Contains(t, decodeMessage(t, res), "passkey.challenge-expired")
	})

	t.Run("login failure maps to a uniform 401", func(t *testing.T) {
		authnSvc := &authntest.FakeService{ExpectedErr: passkey.ErrLoginFailed}
		server := setupPasskeyServer(t, &fakePasskeyService{}, &fakePasskeyStore{}, authnSvc)

		res, err := server.Send(server.NewPostRequest("/api/auth/passkey/login/finish", strings.NewReader(finishBody)))
		require.NoError(t, err)
		defer func() { require.NoError(t, res.Body.Close()) }()

		require.Equal(t, http.StatusUnauthorized, res.StatusCode)
	})

	t.Run("verified assertion logs the user in", func(t *testing.T) {
		authnSvc := &authntest.FakeService{ExpectedIdentity: &authn.Identity{SessionToken: &auth.UserToken{}}}
		server := setupPasskeyServer(t, &fakePasskeyService{}, &fakePasskeyStore{}, authnSvc)

		res, err := server.Send(server.NewPostRequest("/api/auth/passkey/login/finish", strings.NewReader(finishBody)))
		require.NoError(t, err)
		defer func() { require.NoError(t, res.Body.Close()) }()

		require.Equal(t, http.StatusOK, res.StatusCode)
		require.Contains(t, decodeMessage(t, res), "Logged in")
	})
}

func TestPasskeyRegisterBegin(t *testing.T) {
	svc := &fakePasskeyService{beginRegResult: &passkey.BeginResult{SessionID: "reg-1", Options: json.RawMessage(`{}`)}}
	server := setupPasskeyServer(t, svc, &fakePasskeyStore{}, nil)

	req := webtest.RequestWithSignedInUser(
		server.NewPostRequest("/api/user/passkey/register/begin", nil),
		&user.SignedInUser{UserID: 99, OrgID: 1, Login: "alice", Name: "Alice Doe", AuthenticatedBy: loginservice.PasswordAuthModule},
	)
	res, err := server.Send(req)
	require.NoError(t, err)
	defer func() { require.NoError(t, res.Body.Close()) }()

	require.Equal(t, http.StatusOK, res.StatusCode)
	// The enrolling user is taken from the session, never the request body.
	require.Equal(t, int64(99), svc.gotRegUser.UserID)
	require.Equal(t, "alice", svc.gotRegUser.Name)
	require.Equal(t, "Alice Doe", svc.gotRegUser.DisplayName)
}

func TestPasskeyListCredentials(t *testing.T) {
	store := &fakePasskeyStore{listResult: []*passkey.Credential{
		{ID: 1, Name: "laptop", PublicKey: []byte("secret-key"), SignCount: 7},
	}}
	server := setupPasskeyServer(t, &fakePasskeyService{}, store, nil)

	req := webtest.RequestWithSignedInUser(
		server.NewGetRequest("/api/user/passkey/credentials"),
		&user.SignedInUser{UserID: 99, OrgID: 1},
	)
	res, err := server.Send(req)
	require.NoError(t, err)
	defer func() { require.NoError(t, res.Body.Close()) }()
	require.Equal(t, http.StatusOK, res.StatusCode)

	// Key material and the sign counter must never be serialized to the client.
	raw := decodeRaw(t, res)
	require.Contains(t, raw, "laptop")
	require.NotContains(t, raw, "secret-key")
	require.NotContains(t, raw, "signCount")
}

func TestPasskeyRenameCredential(t *testing.T) {
	store := &fakePasskeyStore{}
	server := setupPasskeyServer(t, &fakePasskeyService{}, store, nil)

	renameReq := server.NewRequest(http.MethodPatch, "/api/user/passkey/credentials/7", strings.NewReader(`{"name":"work laptop"}`))
	renameReq.Header.Set("Content-Type", "application/json")
	req := webtest.RequestWithSignedInUser(renameReq, &user.SignedInUser{UserID: 99, OrgID: 1})
	res, err := server.Send(req)
	require.NoError(t, err)
	defer func() { require.NoError(t, res.Body.Close()) }()
	require.Equal(t, http.StatusOK, res.StatusCode)

	require.Equal(t, int64(7), store.renamedID)
	require.Equal(t, int64(99), store.renamedUserID) // scoped to the session user, not the body
	require.Equal(t, "work laptop", store.renamedName)
}

func TestPasskeyDeleteCredential(t *testing.T) {
	store := &fakePasskeyStore{}
	server := setupPasskeyServer(t, &fakePasskeyService{}, store, nil)

	req := webtest.RequestWithSignedInUser(
		server.NewRequest(http.MethodDelete, "/api/user/passkey/credentials/7", nil),
		&user.SignedInUser{UserID: 99, OrgID: 1},
	)
	res, err := server.Send(req)
	require.NoError(t, err)
	defer func() { require.NoError(t, res.Body.Close()) }()
	require.Equal(t, http.StatusOK, res.StatusCode)

	require.Equal(t, int64(7), store.deletedID)
	require.Equal(t, int64(99), store.deletedUserID) // scoped to the session user
}

func decodeMessage(t *testing.T, res *http.Response) string {
	t.Helper()
	var body struct {
		Message string `json:"message"`
	}
	require.NoError(t, json.NewDecoder(res.Body).Decode(&body))
	return body.Message
}

func decodeRaw(t *testing.T, res *http.Response) string {
	t.Helper()
	var raw json.RawMessage
	require.NoError(t, json.NewDecoder(res.Body).Decode(&raw))
	return string(raw)
}

func TestPasskeyRegisterRejectsNonInteractiveSession(t *testing.T) {
	svc := &fakePasskeyService{beginRegResult: &passkey.BeginResult{SessionID: "reg-1", Options: json.RawMessage(`{}`)}}
	server := setupPasskeyServer(t, svc, &fakePasskeyStore{}, nil)

	// An API-key identity is authenticated but not an interactive human login, so enrollment is refused.
	req := webtest.RequestWithSignedInUser(
		server.NewPostRequest("/api/user/passkey/register/begin", nil),
		&user.SignedInUser{UserID: 99, OrgID: 1, AuthenticatedBy: loginservice.APIKeyAuthModule},
	)
	res, err := server.Send(req)
	require.NoError(t, err)
	defer func() { require.NoError(t, res.Body.Close()) }()
	require.Equal(t, http.StatusForbidden, res.StatusCode)
}

func TestIsInteractiveAuthModule(t *testing.T) {
	for _, m := range []string{
		loginservice.PasswordAuthModule, loginservice.LDAPAuthModule, loginservice.SAMLAuthModule,
		loginservice.PasskeyAuthModule, loginservice.GithubAuthModule, loginservice.GenericOAuthModule,
	} {
		require.True(t, isInteractiveAuthModule(m), "expected %q to be interactive", m)
	}
	for _, m := range []string{
		loginservice.APIKeyAuthModule, loginservice.JWTModule, loginservice.ExtendedJWTModule,
		loginservice.RenderModule, loginservice.AuthProxyAuthModule, "", "some-future-module",
	} {
		require.False(t, isInteractiveAuthModule(m), "expected %q to be rejected", m)
	}
}
