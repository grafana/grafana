package authnimpl

import (
	"context"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/authtest"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/clients"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/passkey"
	"github.com/grafana/grafana/pkg/setting"
)

// recordingPasskeyService is a test double for passkey.Service that captures the sessionID and raw
// assertion bytes handed to FinishLogin. The assertions in these tests are on those captured bytes
// (did the body arrive intact and read exactly once?) and on the identity Login builds — never on
// the double itself.
type recordingPasskeyService struct {
	userID       int64
	finishErr    error
	called       bool
	gotSessionID string
	gotBody      []byte
}

func (s *recordingPasskeyService) BeginLogin(context.Context) (*passkey.BeginResult, error) {
	return nil, nil
}

func (s *recordingPasskeyService) FinishLogin(_ context.Context, sessionID string, body []byte) (int64, error) {
	s.called = true
	s.gotSessionID = sessionID
	s.gotBody = body
	return s.userID, s.finishErr
}

func (s *recordingPasskeyService) BeginRegistration(context.Context, passkey.RegisteringUser) (*passkey.BeginResult, error) {
	return nil, nil
}

func (s *recordingPasskeyService) FinishRegistration(context.Context, string, passkey.RegisteringUser, string, []byte) (*passkey.Credential, error) {
	return nil, nil
}

// loginRequest builds a finish-login request whose body is a real one-shot stream, exactly as it
// arrives off the wire. If any consumer in the Login pipeline read it before the passkey client,
// the client's web.Bind would see EOF and the captured body would be empty.
func loginRequest(body string) *authn.Request {
	req := httptest.NewRequest("POST", "/api/auth/passkey/login/finish", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	return &authn.Request{HTTPRequest: req}
}

func setupPasskeyLoginService(t *testing.T, svc passkey.Service) *Service {
	t.Helper()
	return setupTests(t, func(s *Service) {
		cfg := setting.NewCfg()
		cfg.Passkey = setting.PasskeySettings{Enabled: true}
		features := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaPasskeyAuthn)
		s.RegisterClient(clients.ProvidePasskey(cfg, features, svc))
		// Login's success path mints a session token; without this fake it nil-derefs at CreateToken.
		s.sessionService = &authtest.FakeUserAuthTokenService{
			CreateTokenProvider: func(_ context.Context, cmd *auth.CreateTokenCommand) (*auth.UserToken, error) {
				return &auth.UserToken{UserId: cmd.User.ID}, nil
			},
		}
	})
}

func TestPasskeyLogin_BodyReachesVerifierIntact(t *testing.T) {
	fake := &recordingPasskeyService{userID: 42}
	svc := setupPasskeyLoginService(t, fake)

	id, err := svc.Login(context.Background(), authn.ClientPasskey,
		loginRequest(`{"sessionId":"sess-1","response":{"id":"abc"}}`))
	require.NoError(t, err)

	// The body survived the trip through Service.Login -> client -> verifier, read exactly once.
	require.True(t, fake.called)
	require.Equal(t, "sess-1", fake.gotSessionID)
	require.JSONEq(t, `{"id":"abc"}`, string(fake.gotBody))

	// Reaching these proves the whole Login path ran (identity built, session minted), not just the
	// client's Authenticate in isolation.
	require.Equal(t, "42", id.ID)
	require.True(t, id.IsIdentityType(claims.TypeUser))
	require.NotNil(t, id.SessionToken)
}

func TestPasskeyLogin_ExpiredChallengePropagates(t *testing.T) {
	fake := &recordingPasskeyService{finishErr: passkey.ErrChallengeExpired}
	svc := setupPasskeyLoginService(t, fake)

	_, err := svc.Login(context.Background(), authn.ClientPasskey,
		loginRequest(`{"sessionId":"gone","response":{}}`))

	// errors.Is must survive Login so the HTTP layer can still map this case to 410 Gone.
	require.ErrorIs(t, err, passkey.ErrChallengeExpired)
}
