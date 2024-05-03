package clients

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v3"
	"github.com/go-jose/go-jose/v3/jwt"
	"golang.org/x/oauth2"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	authlib "github.com/grafana/authlib/authn"

	"github.com/grafana/grafana/pkg/models/roletype"
	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/signingkeys"
	"github.com/grafana/grafana/pkg/services/signingkeys/signingkeystest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	validPayload = authlib.Claims[authlib.AccessTokenClaims]{
		Claims: &jwt.Claims{
			Issuer:   "http://localhost:3000",
			Subject:  "access-policy:this-uid",
			Audience: jwt.Audience{"http://localhost:3000"},
			ID:       "1234567890",
			Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
			IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
		},
		Rest: authlib.AccessTokenClaims{
			Scopes:               []string{"profile", "groups"},
			DelegatedPermissions: []string{"dashboards:create", "folders:read", "datasources:explore", "datasources.insights:read"},
			Permissions:          []string{"fixed:folders:reader"},
		},
	}
	validIDPayload = authlib.Claims[authlib.IDTokenClaims]{
		Claims: &jwt.Claims{
			Issuer:   "http://localhost:3000",
			Subject:  "user:2",
			Audience: jwt.Audience{"http://localhost:3000"},
			ID:       "1234567890",
			Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
			IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
		},
		Rest: authlib.IDTokenClaims{
			AuthenticatedBy: "extended_jwt",
		},
	}
	pk, _ = rsa.GenerateKey(rand.Reader, 4096)
)

var _ authlib.Verifier[authlib.IDTokenClaims] = &mockIDVerifier{}

type mockIDVerifier struct {
	Claims authlib.Claims[authlib.IDTokenClaims]
	Error  error
}

func (m *mockIDVerifier) Verify(ctx context.Context, token string) (*authlib.Claims[authlib.IDTokenClaims], error) {
	return &m.Claims, m.Error
}

var _ authlib.Verifier[authlib.AccessTokenClaims] = &mockVerifier{}

type mockVerifier struct {
	Claims authlib.Claims[authlib.AccessTokenClaims]
	Error  error
}

func (m *mockVerifier) Verify(ctx context.Context, token string) (*authlib.Claims[authlib.AccessTokenClaims], error) {
	return &m.Claims, m.Error
}

func TestExtendedJWT_Test(t *testing.T) {
	type testCase struct {
		name           string
		cfg            *setting.Cfg
		authHeaderFunc func() string
		want           bool
	}

	testCases := []testCase{
		{
			name: "should return false when extended jwt is disabled",
			cfg: &setting.Cfg{
				ExtJWTAuth: setting.ExtJWTSettings{
					Enabled: false,
				},
			},
			authHeaderFunc: func() string { return "eyJ" },
			want:           false,
		},
		{
			name:           "should return true when Authorization header contains Bearer prefix",
			cfg:            nil,
			authHeaderFunc: func() string { return "Bearer " + generateToken(validPayload, pk, jose.RS256) },
			want:           true,
		},
		{
			name:           "should return true when Authorization header only contains the token",
			cfg:            nil,
			authHeaderFunc: func() string { return generateToken(validPayload, pk, jose.RS256) },
			want:           true,
		},
		{
			name:           "should return false when Authorization header is empty",
			cfg:            nil,
			authHeaderFunc: func() string { return "" },
			want:           false,
		},
		{
			name:           "should return false when jwt.ParseSigned fails",
			cfg:            nil,
			authHeaderFunc: func() string { return "invalid token" },
			want:           false,
		},
		{
			name: "should return false when the issuer does not match the configured issuer",
			cfg: &setting.Cfg{
				ExtJWTAuth: setting.ExtJWTSettings{
					ExpectIssuer: "http://localhost:3000",
				},
			},
			authHeaderFunc: func() string {
				payload := validPayload
				payload.Issuer = "http://unknown-issuer"
				return generateToken(payload, pk, jose.RS256)
			},
			want: false,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			env := setupTestCtx(tc.cfg)

			validHTTPReq := &http.Request{
				Header: map[string][]string{
					"X-Access-Token": {tc.authHeaderFunc()},
				},
			}

			actual := env.s.Test(context.Background(), &authn.Request{
				HTTPRequest: validHTTPReq,
				Resp:        nil,
			})

			assert.Equal(t, tc.want, actual)
		})
	}
}

func TestExtendedJWT_Authenticate(t *testing.T) {
	type testCase struct {
		name        string
		payload     *authlib.Claims[authlib.AccessTokenClaims]
		idPayload   *authlib.Claims[authlib.IDTokenClaims]
		orgID       int64
		want        *authn.Identity
		initTestEnv func(env *testEnv)
		wantErr     error
	}
	testCases := []testCase{
		{
			name:    "successful authentication as service",
			payload: &validPayload,
			orgID:   1,
			want: &authn.Identity{OrgID: 1, OrgName: "",
				OrgRoles: map[int64]roletype.RoleType(nil),
				ID:       authn.MustParseNamespaceID("access-policy:this-uid"), Login: "", Name: "", Email: "",
				IsGrafanaAdmin: (*bool)(nil), AuthenticatedBy: "extendedjwt",
				AuthID: "access-policy:this-uid", IsDisabled: false, HelpFlags1: 0x0,
				LastSeenAt: time.Date(1, time.January, 1, 0, 0, 0, 0, time.UTC),
				Teams:      []int64(nil), Groups: []string(nil),
				OAuthToken: (*oauth2.Token)(nil), SessionToken: (*usertoken.UserToken)(nil),
				ClientParams: authn.ClientParams{SyncUser: false,
					AllowSignUp: false, EnableUser: false, FetchSyncedUser: false,
					SyncTeams: false, SyncOrgRoles: false, CacheAuthProxyKey: "",
					SyncPermissions:        true,
					FetchPermissionsParams: authn.FetchPermissionsParams{ActionsLookup: []string(nil), Roles: []string{"fixed:folders:reader"}}},
				Permissions: map[int64]map[string][]string(nil), IDToken: ""},
			wantErr: nil,
		},
		{
			name:      "successful authentication as user",
			payload:   &validPayload,
			idPayload: &validIDPayload,
			orgID:     1,
			initTestEnv: func(env *testEnv) {
				env.userSvc.ExpectedSignedInUser = &user.SignedInUser{
					UserID:  2,
					OrgID:   1,
					OrgRole: roletype.RoleAdmin,
					Name:    "John Doe",
					Email:   "johndoe@grafana.com",
					Login:   "johndoe",
				}
			},
			want: &authn.Identity{OrgID: 1, OrgName: "",
				OrgRoles: map[int64]roletype.RoleType(nil), ID: authn.MustParseNamespaceID("user:2"),
				Login: "", Name: "", Email: "",
				IsGrafanaAdmin: (*bool)(nil), AuthenticatedBy: "extendedjwt",
				AuthID: "access-policy:this-uid", IsDisabled: false, HelpFlags1: 0x0,
				LastSeenAt: time.Date(1, time.January, 1, 0, 0, 0, 0, time.UTC),
				Teams:      []int64(nil), Groups: []string(nil),
				OAuthToken: (*oauth2.Token)(nil), SessionToken: (*usertoken.UserToken)(nil),
				ClientParams: authn.ClientParams{SyncUser: false, AllowSignUp: false,
					EnableUser: false, FetchSyncedUser: true, SyncTeams: false,
					SyncOrgRoles: false, CacheAuthProxyKey: "",
					SyncPermissions: true,
					FetchPermissionsParams: authn.FetchPermissionsParams{ActionsLookup: []string{"dashboards:create",
						"folders:read", "datasources:explore", "datasources.insights:read"},
						Roles: []string(nil)}}, Permissions: map[int64]map[string][]string(nil), IDToken: ""},
			wantErr: nil,
		},
		{
			name: "should return error when the subject is not an access-policy",
			payload: &authlib.Claims[authlib.AccessTokenClaims]{
				Claims: &jwt.Claims{
					Issuer:   "http://localhost:3000",
					Subject:  "user:2",
					Audience: jwt.Audience{"http://localhost:3000"},
					ID:       "1234567890",
					Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
					IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
				},
				Rest: authlib.AccessTokenClaims{
					Permissions: []string{"fixed:folders:reader"},
				},
			},
			orgID:   1,
			want:    nil,
			wantErr: errJWTInvalid.Errorf("Failed to parse sub: %s", "invalid subject format"),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			env := setupTestCtx(nil)
			if tc.initTestEnv != nil {
				tc.initTestEnv(env)
			}

			validHTTPReq := &http.Request{
				Header: map[string][]string{
					"X-Access-Token": {generateToken(*tc.payload, pk, jose.RS256)},
				},
			}

			env.s.accessTokenVerifier = &mockVerifier{Claims: *tc.payload}
			if tc.idPayload != nil {
				env.s.accessTokenVerifier = &mockVerifier{Claims: *tc.payload}
				env.s.idTokenVerifier = &mockIDVerifier{Claims: *tc.idPayload}
				validHTTPReq.Header.Add(extJWTAuthorizationHeaderName, generateIDToken(*tc.idPayload, pk, jose.RS256))
			}

			id, err := env.s.Authenticate(context.Background(), &authn.Request{
				OrgID:       tc.orgID,
				HTTPRequest: validHTTPReq,
				Resp:        nil,
			})
			if tc.wantErr != nil {
				require.ErrorIs(t, err, tc.wantErr)
			} else {
				require.NoError(t, err)
				assert.EqualValues(t, tc.want, id, fmt.Sprintf("%+v", id))
			}
		})
	}
}

// https://datatracker.ietf.org/doc/html/rfc9068#name-data-structure
func TestVerifyRFC9068TokenFailureScenarios(t *testing.T) {
	type testCase struct {
		name             string
		payload          *authlib.Claims[authlib.AccessTokenClaims]
		idPayload        *authlib.Claims[authlib.IDTokenClaims]
		alg              jose.SignatureAlgorithm
		generateWrongTyp bool
	}

	testCases := []testCase{
		{
			name: "missing iss",
			payload: &authlib.Claims[authlib.AccessTokenClaims]{
				Claims: &jwt.Claims{
					Subject:  "access-policy:this-uid",
					Audience: jwt.Audience{"http://localhost:3000"},
					ID:       "1234567890",
					Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
					IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
				},
				Rest: authlib.AccessTokenClaims{
					Scopes: []string{"profile", "groups"},
				},
			},
		},
		{
			name: "missing expiry",
			payload: &authlib.Claims[authlib.AccessTokenClaims]{
				Claims: &jwt.Claims{
					Issuer:   "http://localhost:3000",
					Subject:  "access-policy:this-uid",
					Audience: jwt.Audience{"http://localhost:3000"},
					ID:       "1234567890",
					IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
				},
				Rest: authlib.AccessTokenClaims{
					Scopes: []string{"profile", "groups"},
				},
			},
		},
		{
			name: "expired token",
			payload: &authlib.Claims[authlib.AccessTokenClaims]{
				Claims: &jwt.Claims{
					Issuer:   "http://localhost:3000",
					Subject:  "access-policy:this-uid",
					Audience: jwt.Audience{"http://localhost:3000"},
					ID:       "1234567890",
					Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
					IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
				},
				Rest: authlib.AccessTokenClaims{
					Scopes: []string{"profile", "groups"},
				},
			},
		},
		{
			name: "missing aud",
			payload: &authlib.Claims[authlib.AccessTokenClaims]{
				Claims: &jwt.Claims{
					Issuer:   "http://localhost:3000",
					Subject:  "access-policy:this-uid",
					ID:       "1234567890",
					Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
					IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
				},
				Rest: authlib.AccessTokenClaims{
					Scopes: []string{"profile", "groups"},
				},
			},
		},
		{
			name: "wrong aud",
			payload: &authlib.Claims[authlib.AccessTokenClaims]{
				Claims: &jwt.Claims{
					Issuer:   "http://localhost:3000",
					Subject:  "access-policy:this-uid",
					Audience: jwt.Audience{"http://some-other-host:3000"},
					ID:       "1234567890",
					Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
					IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
				},
				Rest: authlib.AccessTokenClaims{
					Scopes: []string{"profile", "groups"},
				},
			},
		},
		{
			name:             "wrong typ",
			idPayload:        &validIDPayload,
			generateWrongTyp: true,
		},
		{
			name: "missing sub",
			payload: &authlib.Claims[authlib.AccessTokenClaims]{
				Claims: &jwt.Claims{
					Issuer:   "http://localhost:3000",
					Audience: jwt.Audience{"http://localhost:3000"},
					ID:       "1234567890",
					Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
					IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
				},
				Rest: authlib.AccessTokenClaims{
					Scopes: []string{"profile", "groups"},
				},
			},
		},
		{
			name: "missing iat",
			payload: &authlib.Claims[authlib.AccessTokenClaims]{
				Claims: &jwt.Claims{
					Issuer:   "http://localhost:3000",
					Subject:  "access-policy:this-uid",
					Audience: jwt.Audience{"http://localhost:3000"},
					ID:       "1234567890",
					Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
				},
				Rest: authlib.AccessTokenClaims{
					Scopes: []string{"profile", "groups"},
				},
			},
		},
		{
			name: "iat later than current time",
			payload: &authlib.Claims[authlib.AccessTokenClaims]{
				Claims: &jwt.Claims{
					Issuer:   "http://localhost:3000",
					Subject:  "access-policy:this-uid",
					Audience: jwt.Audience{"http://localhost:3000"},
					ID:       "1234567890",
					Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
					IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 2, 0, 0, time.UTC)),
				},
				Rest: authlib.AccessTokenClaims{
					Scopes: []string{"profile", "groups"},
				},
			},
		},
		{
			name: "unsupported alg",
			payload: &authlib.Claims[authlib.AccessTokenClaims]{
				Claims: &jwt.Claims{
					Issuer:   "http://localhost:3000",
					Subject:  "access-policy:this-uid",
					Audience: jwt.Audience{"http://localhost:3000"},
					ID:       "1234567890",
					Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
					IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
				},
				Rest: authlib.AccessTokenClaims{
					Scopes: []string{"profile", "groups"},
				},
			},
			alg: jose.RS384,
		},
	}

	env := setupTestCtx(nil)

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.alg == "" {
				tc.alg = jose.RS256
			}

			var tokenToTest string
			if tc.generateWrongTyp {
				tokenToTest = generateIDToken(*tc.idPayload, pk, tc.alg)
			} else {
				tokenToTest = generateToken(*tc.payload, pk, tc.alg)
			}
			_, err := env.s.accessTokenVerifier.Verify(context.Background(), tokenToTest)
			require.Error(t, err)
		})
	}
}

func setupTestCtx(cfg *setting.Cfg) *testEnv {
	if cfg == nil {
		cfg = &setting.Cfg{
			ExtJWTAuth: setting.ExtJWTSettings{
				Enabled:        true,
				ExpectIssuer:   "http://localhost:3000",
				ExpectAudience: "http://localhost:3000",
			},
		}
	}

	signingKeysSvc := &signingkeystest.FakeSigningKeysService{
		ExpectedSinger: pk,
		ExpectedKeyID:  signingkeys.ServerPrivateKeyID,
	}

	userSvc := &usertest.FakeUserService{}

	extJwtClient := ProvideExtendedJWT(userSvc, cfg, signingKeysSvc)

	return &testEnv{
		userSvc: userSvc,
		s:       extJwtClient,
	}
}

type testEnv struct {
	userSvc *usertest.FakeUserService
	s       *ExtendedJWT
}

func generateToken(payload authlib.Claims[authlib.AccessTokenClaims], signingKey any, alg jose.SignatureAlgorithm) string {
	signer, _ := jose.NewSigner(jose.SigningKey{Algorithm: alg, Key: signingKey}, &jose.SignerOptions{
		ExtraHeaders: map[jose.HeaderKey]any{
			jose.HeaderType: authlib.TokenTypeAccess,
			"kid":           "default",
		}})

	result, _ := jwt.Signed(signer).Claims(payload).CompactSerialize()
	return result
}

func generateIDToken(payload authlib.Claims[authlib.IDTokenClaims], signingKey any, alg jose.SignatureAlgorithm) string {
	signer, _ := jose.NewSigner(jose.SigningKey{Algorithm: alg, Key: signingKey}, &jose.SignerOptions{
		ExtraHeaders: map[jose.HeaderKey]any{
			jose.HeaderType: authlib.TokenTypeID,
			"kid":           "default",
		}})

	result, _ := jwt.Signed(signer).Claims(payload).CompactSerialize()
	return result
}
