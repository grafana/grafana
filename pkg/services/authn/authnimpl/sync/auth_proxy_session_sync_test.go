package sync

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/authtest"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/setting"
)

func TestAuthProxySessionSync_SyncAuthProxySessionHook(t *testing.T) {
	type testCase struct {
		desc                    string
		identity                *authn.Identity
		authProxyEnabled        bool
		enableLoginToken        bool
		expectTokenCreated      bool
		existingSessionToken    *usertoken.UserToken
		createTokenError        error
		expectedSessionTokenNil bool
	}

	tests := []testCase{
		{
			desc: "should skip sync when auth proxy is disabled",
			identity: &authn.Identity{
				ID:              "1",
				Type:            claims.TypeUser,
				AuthenticatedBy: login.AuthProxyAuthModule,
			},
			authProxyEnabled:        false,
			enableLoginToken:        true,
			expectTokenCreated:      false,
			expectedSessionTokenNil: true,
		},
		{
			desc: "should skip sync when enable_login_token is disabled",
			identity: &authn.Identity{
				ID:              "1",
				Type:            claims.TypeUser,
				AuthenticatedBy: login.AuthProxyAuthModule,
			},
			authProxyEnabled:        true,
			enableLoginToken:        false,
			expectTokenCreated:      false,
			expectedSessionTokenNil: true,
		},
		{
			desc: "should skip sync when identity is not a user",
			identity: &authn.Identity{
				ID:              "1",
				Type:            claims.TypeServiceAccount,
				AuthenticatedBy: login.AuthProxyAuthModule,
			},
			authProxyEnabled:        true,
			enableLoginToken:        true,
			expectTokenCreated:      false,
			expectedSessionTokenNil: true,
		},
		{
			desc: "should skip sync when authenticated by different method",
			identity: &authn.Identity{
				ID:              "1",
				Type:            claims.TypeUser,
				AuthenticatedBy: login.GenericOAuthModule,
			},
			authProxyEnabled:        true,
			enableLoginToken:        true,
			expectTokenCreated:      false,
			expectedSessionTokenNil: true,
		},
		{
			desc: "should skip sync when session token already exists",
			identity: &authn.Identity{
				ID:              "1",
				Type:            claims.TypeUser,
				AuthenticatedBy: login.AuthProxyAuthModule,
				SessionToken:    &usertoken.UserToken{Id: 1},
			},
			authProxyEnabled:        true,
			enableLoginToken:        true,
			expectTokenCreated:      false,
			expectedSessionTokenNil: false,
		},
		{
			desc: "should create session token for auth proxy user",
			identity: &authn.Identity{
				ID:              "1",
				Type:            claims.TypeUser,
				AuthenticatedBy: login.AuthProxyAuthModule,
			},
			authProxyEnabled:        true,
			enableLoginToken:        true,
			expectTokenCreated:      true,
			expectedSessionTokenNil: false,
		},
		{
			desc: "should create session token for LDAP user authenticated via auth proxy",
			identity: &authn.Identity{
				ID:              "1",
				Type:            claims.TypeUser,
				AuthenticatedBy: login.LDAPAuthModule,
			},
			authProxyEnabled:        true,
			enableLoginToken:        true,
			expectTokenCreated:      true,
			expectedSessionTokenNil: false,
		},
		{
			desc: "should not fail if token creation fails",
			identity: &authn.Identity{
				ID:              "1",
				Type:            claims.TypeUser,
				AuthenticatedBy: login.AuthProxyAuthModule,
			},
			authProxyEnabled:        true,
			enableLoginToken:        true,
			expectTokenCreated:      true,
			createTokenError:        assert.AnError,
			expectedSessionTokenNil: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			var tokenCreated bool

			sessionService := &authtest.FakeUserAuthTokenService{
				CreateTokenProvider: func(_ context.Context, cmd *auth.CreateTokenCommand) (*auth.UserToken, error) {
					tokenCreated = true
					if tt.createTokenError != nil {
						return nil, tt.createTokenError
					}
					return &auth.UserToken{
						Id:            1,
						UserId:        cmd.User.ID,
						UnhashedToken: "test-token",
					}, nil
				},
			}

			cfg := setting.NewCfg()
			cfg.AuthProxy.Enabled = tt.authProxyEnabled
			cfg.AuthProxy.EnableLoginToken = tt.enableLoginToken

			sync := ProvideAuthProxySessionSync(cfg, sessionService, tracing.InitializeTracerForTest())

			req := httptest.NewRequest(http.MethodGet, "/", nil)
			req.Header.Set("User-Agent", "test-agent")
			req.RemoteAddr = "192.168.1.1:1234"

			err := sync.SyncAuthProxySessionHook(context.Background(), tt.identity, &authn.Request{
				HTTPRequest: req,
			})

			require.NoError(t, err)
			assert.Equal(t, tt.expectTokenCreated, tokenCreated)

			if tt.expectedSessionTokenNil {
				if tt.existingSessionToken != nil {
					// If there was an existing token, it should still be there
					assert.NotNil(t, tt.identity.SessionToken)
				} else if !tt.expectTokenCreated || tt.createTokenError != nil {
					assert.Nil(t, tt.identity.SessionToken)
				}
			} else {
				assert.NotNil(t, tt.identity.SessionToken)
			}
		})
	}
}

func TestIsAuthProxyOrLDAP(t *testing.T) {
	tests := []struct {
		authModule string
		expected   bool
	}{
		{login.AuthProxyAuthModule, true},
		{login.LDAPAuthModule, true},
		{"authproxy", true},
		{"ldap", true},
		{"AUTHPROXY", true},
		{"LDAP", true},
		{login.GenericOAuthModule, false},
		{login.AzureADAuthModule, false},
		{login.SAMLAuthModule, false},
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.authModule, func(t *testing.T) {
			assert.Equal(t, tt.expected, isAuthProxyOrLDAP(tt.authModule))
		})
	}
}
