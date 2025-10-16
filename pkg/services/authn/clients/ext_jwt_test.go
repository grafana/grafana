package clients

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	authnlib "github.com/grafana/authlib/authn"
	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/setting"
)

type (
	idTokenClaims     = authnlib.Claims[authnlib.IDTokenClaims]
	accessTokenClaims = authnlib.Claims[authnlib.AccessTokenClaims]
)

var (
	validAccessTokenClaims = accessTokenClaims{
		Claims: jwt.Claims{
			Subject:  "access-policy:this-uid",
			Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
			IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
		},
		Rest: authnlib.AccessTokenClaims{
			Scopes:               []string{"profile", "groups"},
			DelegatedPermissions: []string{"dashboards:create", "folders:read", "datasources:explore", "datasources.insights:read"},
			Permissions:          []string{"fixed:folders:reader", "folders:read"},
			Namespace:            "default", // org ID of 1 is special and translates to default
		},
	}
	validIDTokenClaims = idTokenClaims{
		Claims: jwt.Claims{
			Subject:  "user:2",
			Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
			IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
		},
		Rest: authnlib.IDTokenClaims{
			AuthenticatedBy: "extended_jwt",
			Namespace:       "default", // org ID of 1 is special and translates to default
		},
	}
	validIDTokenClaimsWithStackSet = idTokenClaims{
		Claims: jwt.Claims{
			Subject:  "user:2",
			Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
			IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
		},
		Rest: authnlib.IDTokenClaims{
			AuthenticatedBy: "extended_jwt",
			Namespace:       "stacks-1234",
		},
	}
	validIDTokenClaimsWithDeprecatedStackClaimSet = idTokenClaims{
		Claims: jwt.Claims{
			Subject:  "user:2",
			Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
			IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
		},
		Rest: authnlib.IDTokenClaims{
			AuthenticatedBy: "extended_jwt",
			Namespace:       "stack-1234",
		},
	}
	validAccessTokenClaimsWildcard = accessTokenClaims{
		Claims: jwt.Claims{
			Subject:  "access-policy:this-uid",
			Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
			IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
		},
		Rest: authnlib.AccessTokenClaims{
			Namespace: "*",
		},
	}
	validAccessTokenClaimsWithStackSet = accessTokenClaims{
		Claims: jwt.Claims{
			Subject:  "access-policy:this-uid",
			Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
			IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
		},
		Rest: authnlib.AccessTokenClaims{
			Namespace: "stacks-1234",
		},
	}
	validAccessTokenClaimsWithDeprecatedStackClaimSet = accessTokenClaims{
		Claims: jwt.Claims{
			Subject:  "access-policy:this-uid",
			Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
			IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
		},
		Rest: authnlib.AccessTokenClaims{
			Namespace: "stack-1234",
		},
	}
	invalidNamespaceIDTokenClaims = idTokenClaims{
		Claims: jwt.Claims{
			Subject:  "user:2",
			Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
			IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
		},
		Rest: authnlib.IDTokenClaims{
			AuthenticatedBy: "extended_jwt",
			Namespace:       "org-2",
		},
	}
	invalidSubjectIDTokenClaims = idTokenClaims{
		Claims: jwt.Claims{
			Subject:  "service-account:2",
			Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
			IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
		},
		Rest: authnlib.IDTokenClaims{
			AuthenticatedBy: "extended_jwt",
			Namespace:       "default",
		},
	}

	// generate ES256 key
	pk, _ = ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
)

var _ authnlib.Verifier[authnlib.IDTokenClaims] = &mockIDVerifier{}

type mockIDVerifier struct {
	Claims idTokenClaims
	Error  error
}

func (m *mockIDVerifier) Verify(ctx context.Context, token string) (*idTokenClaims, error) {
	return &m.Claims, m.Error
}

var _ authnlib.Verifier[authnlib.AccessTokenClaims] = &mockVerifier{}

type mockVerifier struct {
	Claims accessTokenClaims
	Error  error
}

func (m *mockVerifier) Verify(ctx context.Context, token string) (*accessTokenClaims, error) {
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
			authHeaderFunc: func() string { return "Bearer " + generateToken(t, validAccessTokenClaims, pk, jose.ES256) },
			want:           true,
		},
		{
			name:           "should return true when Authorization header only contains the token",
			authHeaderFunc: func() string { return generateToken(t, validAccessTokenClaims, pk, jose.ES256) },
			want:           true,
		},
		{
			name:           "should return false when Authorization header is empty",
			authHeaderFunc: func() string { return "" },
			want:           false,
		},
		{
			name:           "should return false when jwt.ParseSigned fails",
			authHeaderFunc: func() string { return "invalid token" },
			want:           false,
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
			})

			assert.Equal(t, tc.want, actual)
		})
	}
}

func TestExtendedJWT_Authenticate(t *testing.T) {
	type testCase struct {
		name        string
		cfg         *setting.Cfg // optional, only used when overriding the cfg provided by default test setup
		accessToken *accessTokenClaims
		idToken     *idTokenClaims
		orgID       int64
		want        *authn.Identity
		wantErr     error
	}
	testCases := []testCase{
		{
			name:        "should authenticate as service",
			accessToken: &validAccessTokenClaims,
			orgID:       1,
			want: &authn.Identity{
				ID:                "this-uid",
				UID:               "this-uid",
				Name:              "this-uid",
				Type:              claims.TypeAccessPolicy,
				OrgID:             1,
				AccessTokenClaims: &validAccessTokenClaims,
				Namespace:         "default",
				AuthenticatedBy:   "extendedjwt",
				AuthID:            "access-policy:this-uid",
				ClientParams: authn.ClientParams{
					SyncPermissions:        true,
					FetchPermissionsParams: authn.FetchPermissionsParams{Roles: []string{"fixed:folders:reader"}, AllowedActions: []string{"folders:read"}, K8s: []string{}}},
			},
		},
		{
			name:        "should authenticate as service using wildcard namespace",
			accessToken: &validAccessTokenClaimsWildcard,
			orgID:       1,
			want: &authn.Identity{
				ID:                "this-uid",
				UID:               "this-uid",
				Name:              "this-uid",
				Type:              claims.TypeAccessPolicy,
				OrgID:             1,
				AccessTokenClaims: &validAccessTokenClaimsWildcard,
				Namespace:         "*",
				AuthenticatedBy:   "extendedjwt",
				AuthID:            "access-policy:this-uid",
				ClientParams: authn.ClientParams{
					SyncPermissions: true,
				},
			},
		},
		{
			name:        "should authenticate as user",
			accessToken: &validAccessTokenClaims,
			idToken:     &validIDTokenClaims,
			orgID:       1,
			want: &authn.Identity{
				ID:                "2",
				Type:              claims.TypeUser,
				OrgID:             1,
				AccessTokenClaims: &validAccessTokenClaims,
				IDTokenClaims:     &validIDTokenClaims,
				Namespace:         "default",
				AuthenticatedBy:   "extendedjwt",
				AuthID:            "access-policy:this-uid",
				ClientParams: authn.ClientParams{
					FetchSyncedUser: true,
					SyncPermissions: true,
					FetchPermissionsParams: authn.FetchPermissionsParams{
						RestrictedActions: []string{"dashboards:create", "folders:read", "datasources:explore", "datasources.insights:read"},
					},
				},
			},
		},
		{
			name:        "should authenticate as user in the user namespace",
			accessToken: &validAccessTokenClaimsWildcard,
			idToken:     &validIDTokenClaims,
			orgID:       1,
			want: &authn.Identity{
				ID:                "2",
				Type:              claims.TypeUser,
				OrgID:             1,
				AccessTokenClaims: &validAccessTokenClaimsWildcard,
				IDTokenClaims:     &validIDTokenClaims,
				Namespace:         "default",
				AuthenticatedBy:   "extendedjwt",
				AuthID:            "access-policy:this-uid",
				ClientParams: authn.ClientParams{
					FetchSyncedUser: true,
					SyncPermissions: true,
				},
			},
		},
		{
			name:        "should authenticate as user using wildcard namespace for access token, setting allowed namespace to specific",
			accessToken: &validAccessTokenClaimsWildcard,
			idToken:     &validIDTokenClaimsWithStackSet,
			orgID:       1,
			cfg: &setting.Cfg{
				// default org set up by the authenticator is 1
				StackID: "1234",
				ExtJWTAuth: setting.ExtJWTSettings{
					Enabled:      true,
					ExpectIssuer: "http://localhost:3000",
				},
			},
			want: &authn.Identity{
				ID:                "2",
				Type:              claims.TypeUser,
				OrgID:             1,
				AccessTokenClaims: &validAccessTokenClaimsWildcard,
				IDTokenClaims:     &validIDTokenClaimsWithStackSet,
				Namespace:         "stacks-1234",
				AuthenticatedBy:   "extendedjwt",
				AuthID:            "access-policy:this-uid",
				ClientParams: authn.ClientParams{
					FetchSyncedUser: true,
					SyncPermissions: true,
				},
			},
		},
		{
			name:        "should authenticate as service using specific namespace claim in access token",
			accessToken: &validAccessTokenClaimsWithStackSet,
			orgID:       1,
			cfg: &setting.Cfg{
				// default org set up by the authenticator is 1
				StackID: "1234",
				ExtJWTAuth: setting.ExtJWTSettings{
					Enabled:      true,
					ExpectIssuer: "http://localhost:3000",
				},
			},
			want: &authn.Identity{
				ID:                "this-uid",
				UID:               "this-uid",
				Name:              "this-uid",
				Type:              claims.TypeAccessPolicy,
				OrgID:             1,
				AccessTokenClaims: &validAccessTokenClaimsWithStackSet,
				Namespace:         "stacks-1234",
				AuthenticatedBy:   "extendedjwt",
				AuthID:            "access-policy:this-uid",
				ClientParams: authn.ClientParams{
					SyncPermissions: true,
				},
			},
		},
		{
			name:        "should authenticate as service using specific deprecated namespace claim in access token",
			accessToken: &validAccessTokenClaimsWithDeprecatedStackClaimSet,
			orgID:       1,
			cfg: &setting.Cfg{
				// default org set up by the authenticator is 1
				StackID: "1234",
				ExtJWTAuth: setting.ExtJWTSettings{
					Enabled:      true,
					ExpectIssuer: "http://localhost:3000",
				},
			},
			want: &authn.Identity{
				ID:                "this-uid",
				UID:               "this-uid",
				Name:              "this-uid",
				Type:              claims.TypeAccessPolicy,
				OrgID:             1,
				AccessTokenClaims: &validAccessTokenClaimsWithDeprecatedStackClaimSet,
				Namespace:         "stack-1234",
				AuthenticatedBy:   "extendedjwt",
				AuthID:            "access-policy:this-uid",
				ClientParams: authn.ClientParams{
					SyncPermissions: true,
				},
			},
		},
		{
			name:        "should authenticate as user using specific deprecated namespace claim in access and id tokens",
			accessToken: &validAccessTokenClaimsWithDeprecatedStackClaimSet,
			idToken:     &validIDTokenClaimsWithDeprecatedStackClaimSet,
			orgID:       1,
			cfg: &setting.Cfg{
				// default org set up by the authenticator is 1
				StackID: "1234",
				ExtJWTAuth: setting.ExtJWTSettings{
					Enabled:      true,
					ExpectIssuer: "http://localhost:3000",
				},
			},
			want: &authn.Identity{
				ID:                "2",
				Type:              claims.TypeUser,
				OrgID:             1,
				AccessTokenClaims: &validAccessTokenClaimsWithDeprecatedStackClaimSet,
				IDTokenClaims:     &validIDTokenClaimsWithDeprecatedStackClaimSet,
				Namespace:         "stack-1234",
				AuthenticatedBy:   "extendedjwt",
				AuthID:            "access-policy:this-uid",
				ClientParams: authn.ClientParams{
					SyncPermissions: true,
					FetchSyncedUser: true,
				},
			},
		},
		{
			name:        "should authenticate as user using wildcard namespace for access token, setting allowed namespace to specific",
			accessToken: &validAccessTokenClaimsWildcard,
			idToken:     &validIDTokenClaimsWithStackSet,
			orgID:       1,
			cfg: &setting.Cfg{
				// default org set up by the authenticator is 1
				StackID: "1234",
				ExtJWTAuth: setting.ExtJWTSettings{
					Enabled:      true,
					ExpectIssuer: "http://localhost:3000",
				},
			},
			want: &authn.Identity{
				ID:                "2",
				Type:              claims.TypeUser,
				OrgID:             1,
				AccessTokenClaims: &validAccessTokenClaimsWildcard,
				IDTokenClaims:     &validIDTokenClaimsWithStackSet,
				Namespace:         "stacks-1234",
				AuthenticatedBy:   "extendedjwt",
				AuthID:            "access-policy:this-uid",
				ClientParams: authn.ClientParams{
					FetchSyncedUser: true,
					SyncPermissions: true,
				},
			},
		},
		{
			name:        "should return error when id token has an invalid namespace",
			accessToken: &validAccessTokenClaims,
			idToken:     &invalidNamespaceIDTokenClaims,
			orgID:       1,
			wantErr:     errExtJWTDisallowedNamespaceClaim,
		},

		{
			name:        "should return error when id token subject is not tied to a user",
			accessToken: &validAccessTokenClaims,
			idToken:     &invalidSubjectIDTokenClaims,
			orgID:       1,
			wantErr:     errExtJWTInvalidSubject,
		},

		{
			name: "should return error when the subject is not an access-policy",
			accessToken: &accessTokenClaims{
				Claims: jwt.Claims{
					Issuer:   "http://localhost:3000",
					Subject:  "user:2",
					Audience: jwt.Audience{"http://localhost:3000"},
					ID:       "1234567890",
					Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
					IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
				},
				Rest: authnlib.AccessTokenClaims{
					Permissions: []string{"fixed:folders:reader"},
					Namespace:   "default",
				},
			},
			orgID:   1,
			wantErr: errExtJWTInvalidSubject,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			env := setupTestCtx(tc.cfg)

			validHTTPReq := &http.Request{
				Header: map[string][]string{
					"X-Access-Token": {generateToken(t, *tc.accessToken, pk, jose.ES256)},
				},
			}

			env.s.accessTokenVerifier = &mockVerifier{Claims: *tc.accessToken}
			if tc.idToken != nil {
				env.s.accessTokenVerifier = &mockVerifier{Claims: *tc.accessToken}
				env.s.idTokenVerifier = &mockIDVerifier{Claims: *tc.idToken}
				validHTTPReq.Header.Add(ExtJWTAuthorizationHeaderName, generateIDToken(t, *tc.idToken, pk, jose.ES256))
			}

			id, err := env.s.Authenticate(context.Background(), &authn.Request{
				OrgID:       tc.orgID,
				HTTPRequest: validHTTPReq,
			})
			if tc.wantErr != nil {
				assert.ErrorIs(t, err, tc.wantErr)
				assert.Nil(t, id)
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
		payload          *accessTokenClaims
		idPayload        *idTokenClaims
		alg              jose.SignatureAlgorithm
		generateWrongTyp bool
	}

	testCases := []testCase{
		{
			name: "missing iss",
			payload: &accessTokenClaims{
				Claims: jwt.Claims{
					Subject:  "access-policy:this-uid",
					Audience: jwt.Audience{"http://localhost:3000"},
					ID:       "1234567890",
					Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
					IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
				},
				Rest: authnlib.AccessTokenClaims{
					Scopes: []string{"profile", "groups"},
				},
			},
		},
		{
			name: "missing expiry",
			payload: &accessTokenClaims{
				Claims: jwt.Claims{
					Issuer:   "http://localhost:3000",
					Subject:  "access-policy:this-uid",
					Audience: jwt.Audience{"http://localhost:3000"},
					ID:       "1234567890",
					IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
				},
				Rest: authnlib.AccessTokenClaims{
					Scopes: []string{"profile", "groups"},
				},
			},
		},
		{
			name: "expired token",
			payload: &accessTokenClaims{
				Claims: jwt.Claims{
					Issuer:   "http://localhost:3000",
					Subject:  "access-policy:this-uid",
					Audience: jwt.Audience{"http://localhost:3000"},
					ID:       "1234567890",
					Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
					IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
				},
				Rest: authnlib.AccessTokenClaims{
					Scopes: []string{"profile", "groups"},
				},
			},
		},
		{
			name: "missing aud",
			payload: &accessTokenClaims{
				Claims: jwt.Claims{
					Issuer:   "http://localhost:3000",
					Subject:  "access-policy:this-uid",
					ID:       "1234567890",
					Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
					IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
				},
				Rest: authnlib.AccessTokenClaims{
					Scopes: []string{"profile", "groups"},
				},
			},
		},
		{
			name: "wrong aud",
			payload: &accessTokenClaims{
				Claims: jwt.Claims{
					Issuer:   "http://localhost:3000",
					Subject:  "access-policy:this-uid",
					Audience: jwt.Audience{"http://some-other-host:3000"},
					ID:       "1234567890",
					Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
					IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
				},
				Rest: authnlib.AccessTokenClaims{
					Scopes: []string{"profile", "groups"},
				},
			},
		},
		{
			name:             "wrong typ",
			idPayload:        &validIDTokenClaims,
			generateWrongTyp: true,
		},
		{
			name: "missing sub",
			payload: &accessTokenClaims{
				Claims: jwt.Claims{
					Issuer:   "http://localhost:3000",
					Audience: jwt.Audience{"http://localhost:3000"},
					ID:       "1234567890",
					Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
					IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
				},
				Rest: authnlib.AccessTokenClaims{
					Scopes: []string{"profile", "groups"},
				},
			},
		},
		{
			name: "missing iat",
			payload: &accessTokenClaims{
				Claims: jwt.Claims{
					Issuer:   "http://localhost:3000",
					Subject:  "access-policy:this-uid",
					Audience: jwt.Audience{"http://localhost:3000"},
					ID:       "1234567890",
					Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
				},
				Rest: authnlib.AccessTokenClaims{
					Scopes: []string{"profile", "groups"},
				},
			},
		},
		{
			name: "iat later than current time",
			payload: &accessTokenClaims{
				Claims: jwt.Claims{
					Issuer:   "http://localhost:3000",
					Subject:  "access-policy:this-uid",
					Audience: jwt.Audience{"http://localhost:3000"},
					ID:       "1234567890",
					Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
					IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 2, 0, 0, time.UTC)),
				},
				Rest: authnlib.AccessTokenClaims{
					Scopes: []string{"profile", "groups"},
				},
			},
		},
		{
			name: "unsupported alg",
			payload: &accessTokenClaims{
				Claims: jwt.Claims{
					Issuer:   "http://localhost:3000",
					Subject:  "access-policy:this-uid",
					Audience: jwt.Audience{"http://localhost:3000"},
					ID:       "1234567890",
					Expiry:   jwt.NewNumericDate(time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC)),
					IssuedAt: jwt.NewNumericDate(time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC)),
				},
				Rest: authnlib.AccessTokenClaims{
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
				tc.alg = jose.ES256
			}

			var tokenToTest string
			if tc.generateWrongTyp {
				tokenToTest = generateIDToken(t, *tc.idPayload, pk, tc.alg)
			} else {
				tokenToTest = generateToken(t, *tc.payload, pk, tc.alg)
			}
			_, err := env.s.accessTokenVerifier.Verify(context.Background(), tokenToTest)
			require.Error(t, err)
		})
	}
}

func setupTestCtx(cfg *setting.Cfg) *testEnv {
	if cfg == nil {
		cfg = &setting.Cfg{
			// default org set up by the authenticator is 1
			ExtJWTAuth: setting.ExtJWTSettings{
				Enabled:      true,
				ExpectIssuer: "http://localhost:3000",
			},
		}
	}

	extJwtClient := ProvideExtendedJWT(cfg, tracing.InitializeTracerForTest())

	return &testEnv{
		s: extJwtClient,
	}
}

type testEnv struct {
	s *ExtendedJWT
}

func generateToken(t *testing.T, payload accessTokenClaims, signingKey any, alg jose.SignatureAlgorithm) string {
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: alg, Key: signingKey}, &jose.SignerOptions{
		ExtraHeaders: map[jose.HeaderKey]any{
			jose.HeaderType: authnlib.TokenTypeAccess,
			"kid":           "default",
		}})
	if err != nil {
		// For incompatible algorithm/key combinations (like RS384 with ECDSA key),
		// return invalid token to test verification failure
		if alg == jose.RS384 {
			return "invalid.token"
		}
		require.NoError(t, err)
	}

	result, err := jwt.Signed(signer).Claims(payload).Serialize()
	require.NoError(t, err)
	return result
}

func generateIDToken(t *testing.T, payload idTokenClaims, signingKey any, alg jose.SignatureAlgorithm) string {
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: alg, Key: signingKey}, &jose.SignerOptions{
		ExtraHeaders: map[jose.HeaderKey]any{
			jose.HeaderType: authnlib.TokenTypeID,
			"kid":           "default",
		}})
	if err != nil {
		if alg == jose.RS384 {
			return "invalid.token"
		}
		require.NoError(t, err)
	}

	result, err := jwt.Signed(signer).Claims(payload).Serialize()
	require.NoError(t, err)
	return result
}
