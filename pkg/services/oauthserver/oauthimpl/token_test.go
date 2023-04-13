package oauthimpl

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"strings"
	"testing"
	"time"

	"github.com/ory/fosite"
	"github.com/ory/fosite/storage"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models/roletype"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/oauthserver"
	"github.com/grafana/grafana/pkg/services/oauthserver/oauthtest"
	satests "github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
	"github.com/grafana/grafana/pkg/services/team/teamtest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
)

type TestEnv struct {
	S           *OAuth2ServiceImpl
	Cfg         *setting.Cfg
	AcStore     *actest.FakeStore
	OAuthStore  *oauthtest.FakeStore
	UserService *usertest.FakeUserService
	TeamService *teamtest.FakeService
	SAService   *satests.MockServiceAccountService
}

func setupTestEnv(t *testing.T) *TestEnv {
	t.Helper()

	config := &fosite.Config{
		AccessTokenLifespan: time.Hour,
		TokenURL:            "test/oauth2/token",
		AccessTokenIssuer:   "test",
		IDTokenIssuer:       "test",
		ScopeStrategy:       fosite.WildcardScopeStrategy,
	}

	env := &TestEnv{
		Cfg:         setting.NewCfg(),
		AcStore:     &actest.FakeStore{},
		OAuthStore:  &oauthtest.FakeStore{},
		UserService: usertest.NewUserServiceFake(),
		TeamService: teamtest.NewFakeService(),
		SAService:   &satests.MockServiceAccountService{},
	}

	cfg := setting.NewCfg()

	// TODO: Replace this part with KeyService.GetServerPrivateKey()
	var errGenKey error
	privateKey, errGenKey := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, errGenKey)

	// TODO: add feature toggle
	fmgt := featuremgmt.WithFeatures()

	s := &OAuth2ServiceImpl{
		cache:         localcache.New(cacheExpirationTime, cacheCleanupInterval),
		cfg:           cfg,
		accessControl: acimpl.ProvideAccessControl(cfg),
		acService:     acimpl.ProvideOSSService(cfg, env.AcStore, localcache.New(0, 0), fmgt),
		memstore:      storage.NewMemoryStore(),
		sqlstore:      env.OAuthStore,
		logger:        log.New("oauthserver.test"),
		userService:   env.UserService,
		saService:     env.SAService,
		teamService:   env.TeamService,
		publicKey:     &privateKey.PublicKey,
	}

	s.oauthProvider = newProvider(config, s, privateKey)

	env.S = s

	return env
}

func TestOAuth2ServiceImpl_handleClientCredentials(t *testing.T) {
	client1 := &oauthserver.Client{
		ExternalServiceName: "testapp",
		ClientID:            "RANDOMID",
		GrantTypes:          string(fosite.GrantTypeClientCredentials),
		ServiceAccountID:    2,
		SignedInUser: &user.SignedInUser{
			UserID:  2,
			Name:    "Test App",
			Login:   "testapp",
			OrgRole: roletype.RoleViewer,
			Permissions: map[int64]map[string][]string{
				oauthserver.TmpOrgID: {
					"dashboards:read":  {"dashboards:*", "folders:*"},
					"dashboards:write": {"dashboards:uid:1"},
				},
			},
		},
	}

	tests := []struct {
		name           string
		scopes         []string
		client         *oauthserver.Client
		expectedClaims map[string]interface{}
		wantErr        bool
	}{
		{
			name: "no claim without client_credentials grant type",
			client: &oauthserver.Client{
				ExternalServiceName: "testapp",
				ClientID:            "RANDOMID",
				GrantTypes:          string(fosite.GrantTypeJWTBearer),
				ServiceAccountID:    2,
				SignedInUser:        &user.SignedInUser{},
			},
			wantErr: false,
		},
		{
			name:    "no claims without scopes",
			client:  client1,
			wantErr: false,
		},
		{
			name:           "profile claims",
			client:         client1,
			scopes:         []string{"profile"},
			expectedClaims: map[string]interface{}{"name": "Test App", "login": "testapp"},
			wantErr:        false,
		},
		{
			name:    "email claims should be empty",
			client:  client1,
			scopes:  []string{"email"},
			wantErr: false,
		},
		{
			name:    "groups claims should be empty",
			client:  client1,
			scopes:  []string{"groups"},
			wantErr: false,
		},
		{
			name:   "entitlements claims",
			client: client1,
			scopes: []string{"entitlements"},
			expectedClaims: map[string]interface{}{"entitlements": map[string][]string{
				"dashboards:read":  {"dashboards:*", "folders:*"},
				"dashboards:write": {"dashboards:uid:1"},
			}},
			wantErr: false,
		},
		{
			name:   "scoped entitlements claims",
			client: client1,
			scopes: []string{"entitlements", "dashboards:write"},
			expectedClaims: map[string]interface{}{"entitlements": map[string][]string{
				"dashboards:write": {"dashboards:uid:1"},
			}},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			env := setupTestEnv(t)
			session := &fosite.DefaultSession{}
			requester := fosite.NewAccessRequest(session)
			requester.GrantTypes = fosite.Arguments(strings.Split(tt.client.GrantTypes, ","))
			requester.RequestedScope = fosite.Arguments(tt.scopes)
			sessionData := NewPluginAuthSession("")
			err := env.S.handleClientCredentials(ctx, requester, sessionData, tt.client)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			if tt.expectedClaims == nil {
				require.Empty(t, sessionData.JWTClaims.Extra)
				return
			}
			require.Len(t, sessionData.JWTClaims.Extra, len(tt.expectedClaims))
			for k, v := range tt.expectedClaims {
				require.Equal(t, v, sessionData.JWTClaims.Extra[k])
			}
		})
	}
}
