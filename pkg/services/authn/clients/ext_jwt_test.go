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

	"github.com/grafana/grafana/pkg/models/roletype"
	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/signingkeys"
	"github.com/grafana/grafana/pkg/services/signingkeys/signingkeystest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	validPayload = ExtendedJWTClaims{
		Claims: jwt.Claims{
			Issuer:   "http://localhost:3000",
			Subject:  "service-account:id:2",
			Audience: jwt.Audience{"http://localhost:3000"},
			ID:       "1234567890",
			Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
			IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
		},
		Scopes:                []string{"profile", "groups"},
		DelegatedEntitlements: []string{"dashboards:create", "folders:read", "datasources:explore", "datasources.insights:read"},
		Entitlements:          []string{"fixed:folders:reader"},
	}
	pk, _ = rsa.GenerateKey(rand.Reader, 4096)
)

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
			authHeaderFunc: func() string { return "Bearer " + generateToken(validPayload, pk, jose.RS256, "at+jwt") },
			want:           true,
		},
		{
			name:           "should return true when Authorization header only contains the token",
			cfg:            nil,
			authHeaderFunc: func() string { return generateToken(validPayload, pk, jose.RS256, "at+jwt") },
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
				return generateToken(payload, pk, jose.RS256, "at+jwt")
			},
			want: false,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			env := setupTestCtx(t, tc.cfg)

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
		payload     ExtendedJWTClaims
		orgID       int64
		want        *authn.Identity
		initTestEnv func(env *testEnv)
		wantErr     bool
	}
	testCases := []testCase{
		{
			name:    "successful authentication as service",
			payload: validPayload,
			orgID:   1,
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
				OrgRoles: map[int64]roletype.RoleType(nil),
				ID:       "service-account:id:2", Login: "", Name: "", Email: "",
				IsGrafanaAdmin: (*bool)(nil), AuthenticatedBy: "extendedjwt",
				AuthID: "service-account:id:2", IsDisabled: false, HelpFlags1: 0x0,
				LastSeenAt: time.Date(1, time.January, 1, 0, 0, 0, 0, time.UTC),
				Teams:      []int64(nil), Groups: []string(nil),
				OAuthToken: (*oauth2.Token)(nil), SessionToken: (*usertoken.UserToken)(nil),
				ClientParams: authn.ClientParams{SyncUser: false,
					AllowSignUp: false, EnableUser: false, FetchSyncedUser: false,
					SyncTeams: false, SyncOrgRoles: false, CacheAuthProxyKey: "",
					LookUpParams: login.UserLookupParams{UserID: (*int64)(nil),
						Email: (*string)(nil), Login: (*string)(nil)}, SyncPermissions: true,
					FetchPermissionsParams: authn.FetchPermissionsParams{ActionsLookup: []string(nil), Roles: []string{"fixed:folders:reader"}}},
				Permissions: map[int64]map[string][]string(nil), IDToken: ""},
			wantErr: false,
		},
		{
			name: "should return error when the user cannot be parsed from the Subject claim",
			payload: ExtendedJWTClaims{
				Claims: jwt.Claims{
					Issuer:   "http://localhost:3000",
					Subject:  "user:2",
					Audience: jwt.Audience{"http://localhost:3000"},
					ID:       "1234567890",
					Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
					IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
				},
				Scopes: []string{"profile", "groups"},
			},
			orgID:   1,
			want:    nil,
			wantErr: true,
		},
		{
			name: "should return error when the OrgId is not the ID of the default org",
			payload: ExtendedJWTClaims{
				Claims: jwt.Claims{
					Issuer:   "http://localhost:3000",
					Subject:  "user:id:2",
					Audience: jwt.Audience{"http://localhost:3000"},
					ID:       "1234567890",
					Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
					IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
				},
				Scopes: []string{"profile", "groups"},
			},
			orgID:   0,
			want:    nil,
			wantErr: true,
		},
		{
			name: "should return error when the user cannot be found",
			payload: ExtendedJWTClaims{
				Claims: jwt.Claims{
					Issuer:   "http://localhost:3000",
					Subject:  "user:id:2",
					Audience: jwt.Audience{"http://localhost:3000"},
					ID:       "1234567890",
					Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
					IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
				},
				Scopes: []string{"profile", "groups"},
			},
			orgID: 1,
			want:  nil,
			initTestEnv: func(env *testEnv) {
				env.userSvc.ExpectedError = user.ErrUserNotFound
			},
			wantErr: true,
		},
		{
			name: "should return error when entitlements claim is missing",
			payload: ExtendedJWTClaims{
				Claims: jwt.Claims{
					Issuer:   "http://localhost:3000",
					Subject:  "user:id:2",
					Audience: jwt.Audience{"http://localhost:3000"},
					ID:       "1234567890",
					Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
					IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
				},
				Scopes: []string{"profile", "groups"},
			},
			orgID:   1,
			want:    nil,
			wantErr: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			env := setupTestCtx(t, nil)
			if tc.initTestEnv != nil {
				tc.initTestEnv(env)
			}

			validHTTPReq := &http.Request{
				Header: map[string][]string{
					"X-Access-Token": {generateToken(tc.payload, pk, jose.RS256, "at+jwt")},
				},
			}

			mockTimeNow(time.Date(2023, 5, 2, 0, 1, 0, 0, time.UTC))

			id, err := env.s.Authenticate(context.Background(), &authn.Request{
				OrgID:       tc.orgID,
				HTTPRequest: validHTTPReq,
				Resp:        nil,
			})
			if tc.wantErr {
				require.Error(t, err)
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
		name    string
		payload ExtendedJWTClaims
		alg     jose.SignatureAlgorithm
	}

	testCases := []testCase{
		{
			name: "missing iss",
			payload: ExtendedJWTClaims{
				Claims: jwt.Claims{
					Subject:  "user:id:2",
					Audience: jwt.Audience{"http://localhost:3000"},
					ID:       "1234567890",
					Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
					IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
				},
				Scopes: []string{"profile", "groups"},
			},
		},
		{
			name: "missing expiry",
			payload: ExtendedJWTClaims{
				Claims: jwt.Claims{
					Issuer:   "http://localhost:3000",
					Subject:  "user:id:2",
					Audience: jwt.Audience{"http://localhost:3000"},
					ID:       "1234567890",
					IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
				},
				Scopes: []string{"profile", "groups"},
			},
		},
		{
			name: "expired token",
			payload: ExtendedJWTClaims{
				Claims: jwt.Claims{
					Issuer:   "http://localhost:3000",
					Subject:  "user:id:2",
					Audience: jwt.Audience{"http://localhost:3000"},
					ID:       "1234567890",
					Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
					IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
				},
				Scopes: []string{"profile", "groups"},
			},
		},
		{
			name: "missing aud",
			payload: ExtendedJWTClaims{
				Claims: jwt.Claims{
					Issuer:   "http://localhost:3000",
					Subject:  "user:id:2",
					ID:       "1234567890",
					Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
					IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
				},
				Scopes: []string{"profile", "groups"},
			},
		},
		{
			name: "wrong aud",
			payload: ExtendedJWTClaims{
				Claims: jwt.Claims{
					Issuer:   "http://localhost:3000",
					Subject:  "user:id:2",
					Audience: jwt.Audience{"http://some-other-host:3000"},
					ID:       "1234567890",
					Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
					IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
				},
				Scopes: []string{"profile", "groups"},
			},
		},
		{
			name: "missing sub",
			payload: ExtendedJWTClaims{
				Claims: jwt.Claims{
					Issuer:   "http://localhost:3000",
					Audience: jwt.Audience{"http://localhost:3000"},
					ID:       "1234567890",
					Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
					IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
				},
				Scopes: []string{"profile", "groups"},
			},
		},
		{
			name: "missing iat",
			payload: ExtendedJWTClaims{
				Claims: jwt.Claims{
					Issuer:   "http://localhost:3000",
					Subject:  "user:id:2",
					Audience: jwt.Audience{"http://localhost:3000"},
					ID:       "1234567890",
					Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
				},
				Scopes: []string{"profile", "groups"},
			},
		},
		{
			name: "iat later than current time",
			payload: ExtendedJWTClaims{
				Claims: jwt.Claims{
					Issuer:   "http://localhost:3000",
					Subject:  "user:id:2",
					Audience: jwt.Audience{"http://localhost:3000"},
					ID:       "1234567890",
					Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
					IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 2, 0, 0, time.UTC)),
				},
				Scopes: []string{"profile", "groups"},
			},
		},
		{
			name: "unsupported alg",
			payload: ExtendedJWTClaims{
				Claims: jwt.Claims{
					Issuer:   "http://localhost:3000",
					Subject:  "user:id:2",
					Audience: jwt.Audience{"http://localhost:3000"},
					ID:       "1234567890",
					Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
					IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
				},
				Scopes: []string{"profile", "groups"},
			},
			alg: jose.RS384,
		},
	}

	env := setupTestCtx(t, nil)
	mockTimeNow(time.Date(2023, 5, 2, 0, 1, 0, 0, time.UTC))

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.alg == "" {
				tc.alg = jose.RS256
			}
			tokenToTest := generateToken(tc.payload, pk, tc.alg, "at+jwt")
			_, err := env.s.verifyRFC9068Token(context.Background(), tokenToTest, rfc9068ShortMediaType)
			require.Error(t, err)
		})
	}
}

func setupTestCtx(t *testing.T, cfg *setting.Cfg) *testEnv {
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

func generateToken(payload ExtendedJWTClaims, signingKey any, alg jose.SignatureAlgorithm, typ string) string {
	signer, _ := jose.NewSigner(jose.SigningKey{Algorithm: alg, Key: signingKey}, &jose.SignerOptions{
		ExtraHeaders: map[jose.HeaderKey]any{
			jose.HeaderType: typ,
			"kid":           "default",
		}})

	result, _ := jwt.Signed(signer).Claims(payload).CompactSerialize()
	return result
}

func mockTimeNow(timeSeed time.Time) {
	timeNow = func() time.Time {
		return timeSeed
	}
}

// TODO: add AuthenticateAsUser tests and user namespace should not be service-account, maybe?
