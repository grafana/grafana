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

	"github.com/grafana/grafana/pkg/models/roletype"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/oauthserver"
	"github.com/grafana/grafana/pkg/services/oauthserver/oastest"
	"github.com/grafana/grafana/pkg/services/signingkeys/signingkeystest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var (
	validPayload = ExtendedJWTClaims{
		Claims: jwt.Claims{
			Issuer:   "http://localhost:3000",
			Subject:  "user:id:2",
			Audience: jwt.Audience{"http://localhost:3000"},
			ID:       "1234567890",
			Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
			IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
		},
		ClientID: "grafana",
		Scopes:   []string{"profile", "groups"},
		Entitlements: map[string][]string{
			"dashboards:create": {
				"folders:uid:general",
			},
			"folders:read": {
				"folders:uid:general",
			},
			"datasources:explore":       nil,
			"datasources.insights:read": {},
		},
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
				ExtendedJWTAuthEnabled: false,
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
				ExtendedJWTExpectIssuer: "http://localhost:3000",
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
			env := setupTestCtx(t, tc.cfg)

			validHTTPReq := &http.Request{
				Header: map[string][]string{
					"Authorization": {tc.authHeaderFunc()},
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
			name:    "successful authentication",
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
			want: &authn.Identity{
				OrgID:          1,
				OrgCount:       0,
				OrgName:        "",
				OrgRoles:       map[int64]roletype.RoleType{1: roletype.RoleAdmin},
				ID:             "user:2",
				Login:          "johndoe",
				Name:           "John Doe",
				Email:          "johndoe@grafana.com",
				IsGrafanaAdmin: boolPtr(false),
				AuthModule:     "",
				AuthID:         "",
				IsDisabled:     false,
				HelpFlags1:     0,
				Permissions: map[int64]map[string][]string{
					1: {
						"dashboards:create": {
							"folders:uid:general",
						},
						"folders:read": {
							"folders:uid:general",
						},
						"datasources:explore":       nil,
						"datasources.insights:read": []string{},
					},
				},
				ClientParams: authn.ClientParams{
					SyncUser:            false,
					AllowSignUp:         false,
					FetchSyncedUser:     false,
					EnableDisabledUsers: false,
					SyncOrgRoles:        false,
					SyncTeams:           false,
					SyncPermissions:     false,
					LookUpParams: login.UserLookupParams{
						UserID: nil,
						Email:  nil,
						Login:  nil,
					},
				},
			},
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
				ClientID: "grafana",
				Scopes:   []string{"profile", "groups"},
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
				ClientID: "grafana",
				Scopes:   []string{"profile", "groups"},
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
				ClientID: "grafana",
				Scopes:   []string{"profile", "groups"},
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
				ClientID: "grafana",
				Scopes:   []string{"profile", "groups"},
			},
			orgID:   1,
			want:    nil,
			wantErr: true,
		},
		{
			name: "should return error when the client was not found",
			payload: ExtendedJWTClaims{
				Claims: jwt.Claims{
					Issuer:   "http://localhost:3000",
					Subject:  "user:id:2",
					Audience: jwt.Audience{"http://localhost:3000"},
					ID:       "1234567890",
					Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
					IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
				},
				ClientID: "unknown-client-id",
				Scopes:   []string{"profile", "groups"},
			},
			initTestEnv: func(env *testEnv) {
				env.oauthSvc.ExpectedErr = oauthserver.ErrClientNotFound("unknown-client-id")
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
					"Authorization": {generateToken(tc.payload, pk, jose.RS256)},
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
				ClientID: "grafana",
				Scopes:   []string{"profile", "groups"},
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
				ClientID: "grafana",
				Scopes:   []string{"profile", "groups"},
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
				ClientID: "grafana",
				Scopes:   []string{"profile", "groups"},
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
				ClientID: "grafana",
				Scopes:   []string{"profile", "groups"},
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
				ClientID: "grafana",
				Scopes:   []string{"profile", "groups"},
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
				ClientID: "grafana",
				Scopes:   []string{"profile", "groups"},
			},
		},
		{
			name: "missing client_id",
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
				ClientID: "grafana",
				Scopes:   []string{"profile", "groups"},
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
				ClientID: "grafana",
				Scopes:   []string{"profile", "groups"},
			},
		},
		{
			name: "missing jti",
			payload: ExtendedJWTClaims{
				Claims: jwt.Claims{
					Issuer:   "http://localhost:3000",
					Subject:  "user:id:2",
					Audience: jwt.Audience{"http://localhost:3000"},
					Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
					IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
				},
				ClientID: "grafana",
				Scopes:   []string{"profile", "groups"},
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
				ClientID: "grafana",
				Scopes:   []string{"profile", "groups"},
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
			tokenToTest := generateToken(tc.payload, pk, tc.alg)
			_, err := env.s.verifyRFC9068Token(context.Background(), tokenToTest)
			require.Error(t, err)
		})
	}
}

func setupTestCtx(t *testing.T, cfg *setting.Cfg) *testEnv {
	if cfg == nil {
		cfg = &setting.Cfg{
			ExtendedJWTAuthEnabled:    true,
			ExtendedJWTExpectIssuer:   "http://localhost:3000",
			ExtendedJWTExpectAudience: "http://localhost:3000",
		}
	}

	signingKeysSvc := &signingkeystest.FakeSigningKeysService{}
	signingKeysSvc.ExpectedServerPublicKey = &pk.PublicKey

	userSvc := &usertest.FakeUserService{}
	oauthSvc := &oastest.FakeService{}

	extJwtClient := ProvideExtendedJWT(userSvc, cfg, signingKeysSvc, oauthSvc)

	return &testEnv{
		oauthSvc: oauthSvc,
		userSvc:  userSvc,
		s:        extJwtClient,
	}
}

type testEnv struct {
	oauthSvc *oastest.FakeService
	userSvc  *usertest.FakeUserService
	s        *ExtendedJWT
}

func generateToken(payload ExtendedJWTClaims, signingKey interface{}, alg jose.SignatureAlgorithm) string {
	signer, _ := jose.NewSigner(jose.SigningKey{Algorithm: alg, Key: signingKey}, &jose.SignerOptions{
		ExtraHeaders: map[jose.HeaderKey]interface{}{
			jose.HeaderType: "at+jwt",
		}})

	result, _ := jwt.Signed(signer).Claims(payload).CompactSerialize()
	return result
}

func mockTimeNow(timeSeed time.Time) {
	timeNow = func() time.Time {
		return timeSeed
	}
}
