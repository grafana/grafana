package clients

import (
	"context"
	"net/http/httptest"
	"strings"
	"testing"

	claims "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/passkey"
	"github.com/grafana/grafana/pkg/setting"
)

// fakePasskeyService is a test double for passkey.Service. Only FinishLogin is exercised by the
// client under test; it records its arguments and returns a canned result so the assertions can be
// made on the client's output (the Identity), never on the double itself.
type fakePasskeyService struct {
	userID       int64
	err          error
	called       bool
	gotSessionID string
	gotBody      []byte
}

func (f *fakePasskeyService) BeginLogin(context.Context) (*passkey.BeginResult, error) {
	return nil, nil
}

func (f *fakePasskeyService) FinishLogin(_ context.Context, sessionID string, body []byte) (int64, error) {
	f.called = true
	f.gotSessionID = sessionID
	f.gotBody = body
	return f.userID, f.err
}

func (f *fakePasskeyService) BeginRegistration(context.Context, passkey.RegisteringUser) (*passkey.BeginResult, error) {
	return nil, nil
}

func (f *fakePasskeyService) FinishRegistration(context.Context, string, passkey.RegisteringUser, string, []byte) (*passkey.Credential, error) {
	return nil, nil
}

func newPasskeyClient(enabled, toggle bool, svc passkey.Service) *Passkey {
	cfg := setting.NewCfg()
	cfg.Passkey = setting.PasskeySettings{Enabled: enabled}

	features := featuremgmt.WithFeatures()
	if toggle {
		features = featuremgmt.WithFeatures(featuremgmt.FlagGrafanaPasskeyAuthn)
	}

	return ProvidePasskey(cfg, features, svc)
}

func requestWithBody(body string) *authn.Request {
	req := httptest.NewRequest("POST", "/api/auth/passkey/login/finish", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	return &authn.Request{OrgID: 7, HTTPRequest: req}
}

func TestPasskeyName(t *testing.T) {
	c := newPasskeyClient(true, true, &fakePasskeyService{})
	require.Equal(t, authn.ClientPasskey, c.Name())
}

func TestPasskeyIsEnabled(t *testing.T) {
	tests := []struct {
		name            string
		enabled, toggle bool
		want            bool
	}{
		{"config and toggle on", true, true, true},
		{"config off", false, true, false},
		{"toggle off", true, false, false},
		{"both off", false, false, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := newPasskeyClient(tt.enabled, tt.toggle, &fakePasskeyService{})
			require.Equal(t, tt.want, c.IsEnabled())
		})
	}
}

func TestPasskeyAuthenticate(t *testing.T) {
	ctx := context.Background()

	t.Run("verified assertion builds an attributable identity that runs post-auth hooks", func(t *testing.T) {
		svc := &fakePasskeyService{userID: 42}
		c := newPasskeyClient(true, true, svc)

		id, err := c.Authenticate(ctx, requestWithBody(`{"sessionId":"sess-1","response":{"id":"abc"}}`))
		require.NoError(t, err)

		require.Equal(t, "42", id.ID)
		require.Equal(t, claims.TypeUser, id.Type)
		require.EqualValues(t, 7, id.OrgID)
		require.Equal(t, login.PasskeyAuthModule, id.AuthenticatedBy)
		// These two flags are what make the authn service reject a disabled user and load permissions.
		require.True(t, id.ClientParams.FetchSyncedUser)
		require.True(t, id.ClientParams.SyncPermissions)

		// The session id and raw assertion must reach the verifier intact.
		require.True(t, svc.called)
		require.Equal(t, "sess-1", svc.gotSessionID)
		require.JSONEq(t, `{"id":"abc"}`, string(svc.gotBody))
	})

	t.Run("login failure propagates and stays distinguishable via errors.Is", func(t *testing.T) {
		svc := &fakePasskeyService{err: passkey.ErrLoginFailed}
		c := newPasskeyClient(true, true, svc)

		_, err := c.Authenticate(ctx, requestWithBody(`{"sessionId":"s","response":{}}`))
		require.ErrorIs(t, err, passkey.ErrLoginFailed)
	})

	t.Run("expired challenge stays distinguishable for the 410 path", func(t *testing.T) {
		svc := &fakePasskeyService{err: passkey.ErrChallengeExpired}
		c := newPasskeyClient(true, true, svc)

		_, err := c.Authenticate(ctx, requestWithBody(`{"sessionId":"s","response":{}}`))
		require.ErrorIs(t, err, passkey.ErrChallengeExpired)
	})

	t.Run("malformed body is rejected before the service is called", func(t *testing.T) {
		svc := &fakePasskeyService{}
		c := newPasskeyClient(true, true, svc)

		_, err := c.Authenticate(ctx, requestWithBody(`not json`))
		require.Error(t, err)
		require.False(t, svc.called)
	})
}
