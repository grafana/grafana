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
	"github.com/grafana/grafana/pkg/services/signingkeys/signingkeystest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var (
	validPayload = rfc9068Payload{
		Issuer:   "http://localhost:3000",
		Subject:  "user:id:2",
		Audience: jwt.Audience{"http://localhost:3000"},
		ID:       "1234567890",
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
		Expiry:   time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC).Unix(),
		IssuedAt: time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC).Unix(),
	}
	pk, _ = rsa.GenerateKey(rand.Reader, 4096)
)

func TestExtendedJWTTest(t *testing.T) {
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
			authHeaderFunc: func() string { return "Bearer " + generateToken(validPayload, pk) },
			want:           true,
		},
		{
			name:           "should return true when Authorization header only contains the token",
			cfg:            nil,
			authHeaderFunc: func() string { return generateToken(validPayload, pk) },
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
				return generateToken(payload, pk)
			},
			want: false,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			extJwtClient := setupTestCtx(t, nil, tc.cfg)

			validHTTPReq := &http.Request{
				Header: map[string][]string{
					"Authorization": {tc.authHeaderFunc()},
				},
			}

			actual := extJwtClient.Test(context.Background(), &authn.Request{
				OrgID:       1,
				HTTPRequest: validHTTPReq,
				Resp:        nil,
			})

			assert.Equal(t, tc.want, actual)
		})
	}
}

func TestExtendedJWTAuthenticate(t *testing.T) {
	type testCase struct {
		name         string
		payload      rfc9068Payload
		want         *authn.Identity
		userSvcSetup func(userSvc *usertest.FakeUserService)
		wantErr      bool
	}
	testCases := []testCase{
		{
			name:    "successful authentication",
			payload: validPayload,
			userSvcSetup: func(userSvc *usertest.FakeUserService) {
				userSvc.ExpectedSignedInUser = &user.SignedInUser{
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
						"datasources:explore":       []string{},
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
			payload: rfc9068Payload{
				Issuer:   "http://localhost:3000",
				Subject:  "user:2",
				Audience: jwt.Audience{"http://localhost:3000"},
				ID:       "1234567890",
				ClientID: "grafana",
				Scopes:   []string{"profile", "groups"},
				Expiry:   time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC).Unix(),
				IssuedAt: time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC).Unix(),
			},
			want:    nil,
			wantErr: true,
		},
		{
			name: "should return error when the user cannot be found",
			payload: rfc9068Payload{
				Issuer:   "http://localhost:3000",
				Subject:  "user:id:2",
				Audience: jwt.Audience{"http://localhost:3000"},
				ID:       "1234567890",
				ClientID: "grafana",
				Scopes:   []string{"profile", "groups"},
				Expiry:   time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC).Unix(),
				IssuedAt: time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC).Unix(),
			},
			want: nil,
			userSvcSetup: func(userSvc *usertest.FakeUserService) {
				userSvc.ExpectedError = user.ErrUserNotFound
			},
			wantErr: true,
		},
		{
			name: "should return error when the user cannot be found",
			payload: rfc9068Payload{
				Issuer:   "http://localhost:3000",
				Subject:  "user:id:2",
				Audience: jwt.Audience{"http://localhost:3000"},
				ID:       "1234567890",
				ClientID: "grafana",
				Scopes:   []string{"profile", "groups"},
				Expiry:   time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC).Unix(),
				IssuedAt: time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC).Unix(),
			},
			want: nil,
			userSvcSetup: func(userSvc *usertest.FakeUserService) {
				userSvc.ExpectedError = user.ErrUserNotFound
			},
			wantErr: true,
		},
		{
			name: "should return error when entitlements claim is missing",
			payload: rfc9068Payload{
				Issuer:   "http://localhost:3000",
				Subject:  "user:id:2",
				Audience: jwt.Audience{"http://localhost:3000"},
				ID:       "1234567890",
				ClientID: "grafana",
				Scopes:   []string{"profile", "groups"},
				Expiry:   time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC).Unix(),
				IssuedAt: time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC).Unix(),
			},
			want:    nil,
			wantErr: true,
		},
		{
			name: "should return error when the entitlements are not in the correct format",
			payload: rfc9068Payload{
				Issuer:       "http://localhost:3000",
				Subject:      "user:id:2",
				Audience:     jwt.Audience{"http://localhost:3000"},
				ID:           "1234567890",
				ClientID:     "grafana",
				Scopes:       []string{"profile", "groups"},
				Entitlements: []string{"dashboards:create", "folders:read"},
				Expiry:       time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC).Unix(),
				IssuedAt:     time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC).Unix(),
			},
			want:    nil,
			wantErr: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			userSvc := &usertest.FakeUserService{}
			extJwtClient := setupTestCtx(t, userSvc, nil)
			if tc.userSvcSetup != nil {
				tc.userSvcSetup(userSvc)
			}

			validHTTPReq := &http.Request{
				Header: map[string][]string{
					"Authorization": {generateToken(tc.payload, pk)},
				},
			}

			mockTimeNow(time.Date(2023, 5, 2, 0, 1, 0, 0, time.UTC))

			id, err := extJwtClient.Authenticate(context.Background(), &authn.Request{
				OrgID:       1,
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
		payload rfc9068Payload
	}

	testCases := []testCase{
		{
			name: "missing iss",
			payload: rfc9068Payload{
				Subject:  "user:id:2",
				Audience: jwt.Audience{"http://localhost:3000"},
				ID:       "1234567890",
				ClientID: "grafana",
				Scopes:   []string{"profile", "groups"},
				Expiry:   time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC).Unix(),
				IssuedAt: time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC).Unix(),
			},
		},
		{
			name: "missing expiry",
			payload: rfc9068Payload{
				Issuer:   "http://localhost:3000",
				Subject:  "user:id:2",
				Audience: jwt.Audience{"http://localhost:3000"},
				ID:       "1234567890",
				ClientID: "grafana",
				Scopes:   []string{"profile", "groups"},
				IssuedAt: time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC).Unix(),
			},
		},
		{
			name: "expired token",
			payload: rfc9068Payload{
				Issuer:   "http://localhost:3000",
				Subject:  "user:id:2",
				Audience: jwt.Audience{"http://localhost:3000"},
				ID:       "1234567890",
				ClientID: "grafana",
				Scopes:   []string{"profile", "groups"},
				Expiry:   time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC).Unix(),
				IssuedAt: time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC).Unix(),
			},
		},
		{
			name: "missing aud",
			payload: rfc9068Payload{
				Issuer:   "http://localhost:3000",
				Subject:  "user:id:2",
				ID:       "1234567890",
				ClientID: "grafana",
				Scopes:   []string{"profile", "groups"},
				Expiry:   time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC).Unix(),
				IssuedAt: time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC).Unix(),
			},
		},
		{
			name: "wrong aud",
			payload: rfc9068Payload{
				Issuer:   "http://localhost:3000",
				Subject:  "user:id:2",
				Audience: jwt.Audience{"http://some-other-host:3000"},
				ID:       "1234567890",
				ClientID: "grafana",
				Scopes:   []string{"profile", "groups"},
				Expiry:   time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC).Unix(),
				IssuedAt: time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC).Unix(),
			},
		},
		{
			name: "missing sub",
			payload: rfc9068Payload{
				Issuer:   "http://localhost:3000",
				Audience: jwt.Audience{"http://localhost:3000"},
				ID:       "1234567890",
				ClientID: "grafana",
				Scopes:   []string{"profile", "groups"},
				Expiry:   time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC).Unix(),
				IssuedAt: time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC).Unix(),
			},
		},
		{
			name: "missing client_id",
			payload: rfc9068Payload{
				Issuer:   "http://localhost:3000",
				Subject:  "user:id:2",
				Audience: jwt.Audience{"http://localhost:3000"},
				ID:       "1234567890",
				Scopes:   []string{"profile", "groups"},
				Expiry:   time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC).Unix(),
				IssuedAt: time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC).Unix(),
			},
		},
		{
			name: "missing iat",
			payload: rfc9068Payload{
				Issuer:   "http://localhost:3000",
				Subject:  "user:id:2",
				Audience: jwt.Audience{"http://localhost:3000"},
				ID:       "1234567890",
				ClientID: "grafana",
				Scopes:   []string{"profile", "groups"},
				Expiry:   time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC).Unix(),
			},
		},
		{
			name: "iat later than current time",
			payload: rfc9068Payload{
				Issuer:   "http://localhost:3000",
				Subject:  "user:id:2",
				Audience: jwt.Audience{"http://localhost:3000"},
				ID:       "1234567890",
				ClientID: "grafana",
				Scopes:   []string{"profile", "groups"},
				Expiry:   time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC).Unix(),
				IssuedAt: time.Date(2023, 5, 2, 0, 2, 0, 0, time.UTC).Unix(),
			},
		},
		{
			name: "missing jti",
			payload: rfc9068Payload{
				Issuer:   "http://localhost:3000",
				Subject:  "user:id:2",
				Audience: jwt.Audience{"http://localhost:3000"},
				ClientID: "grafana",
				Scopes:   []string{"profile", "groups"},
				Expiry:   time.Date(2023, 5, 3, 0, 0, 0, 0, time.UTC).Unix(),
				IssuedAt: time.Date(2023, 5, 2, 0, 0, 0, 0, time.UTC).Unix(),
			},
		},
	}

	extJwtClient := setupTestCtx(t, nil, nil)
	mockTimeNow(time.Date(2023, 5, 2, 0, 1, 0, 0, time.UTC))

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			tokenToTest := generateToken(tc.payload, pk)
			_, err := extJwtClient.verifyRFC9068Token(context.Background(), tokenToTest)
			require.Error(t, err)
		})
	}
}

func setupTestCtx(t *testing.T, userSvc user.Service, cfg *setting.Cfg) *ExtendedJWT {
	if cfg == nil {
		cfg = &setting.Cfg{
			ExtendedJWTAuthEnabled:    true,
			ExtendedJWTExpectIssuer:   "http://localhost:3000",
			ExtendedJWTExpectAudience: "http://localhost:3000",
		}
	}

	signingKeysSvc := &signingkeystest.FakeSigningKeysService{}
	signingKeysSvc.ExpectedServerPublicKey = &pk.PublicKey

	extJwtClient := ProvideExtendedJWT(userSvc, cfg, signingKeysSvc)
	return extJwtClient
}

type rfc9068Payload struct {
	Issuer       string       `json:"iss,omitempty"`
	Subject      string       `json:"sub,omitempty"`
	Audience     jwt.Audience `json:"aud,omitempty"`
	Expiry       int64        `json:"exp,omitempty"`
	NotBefore    int64        `json:"nbf,omitempty"`
	IssuedAt     int64        `json:"iat,omitempty"`
	ID           string       `json:"jti,omitempty"`
	ClientID     string       `json:"client_id,omitempty"`
	Scopes       []string     `json:"scope,omitempty"`
	Entitlements interface{}  `json:"entitlements,omitempty"` // By default Entitlements is a map[string][]string; interface{} used for testing purposes
}

func generateToken(payload rfc9068Payload, signingKey *rsa.PrivateKey) string {
	signer, _ := jose.NewSigner(jose.SigningKey{Algorithm: jose.RS256, Key: signingKey}, &jose.SignerOptions{
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
