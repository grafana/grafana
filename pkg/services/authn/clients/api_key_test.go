package clients

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/components/apikeygen"
	"github.com/grafana/grafana/pkg/components/satokengen"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/apikey/apikeytest"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
)

var (
	revoked      = true
	secret, hash = genApiKey(false)
)

func TestAPIKey_Authenticate(t *testing.T) {
	type TestCase struct {
		desc             string
		req              *authn.Request
		expectedKey      *apikey.APIKey
		expectedErr      error
		expectedIdentity *authn.Identity
	}

	tests := []TestCase{
		{
			desc: "should success for valid token that is not connected to a service account",
			req: &authn.Request{HTTPRequest: &http.Request{
				Header: map[string][]string{
					"Authorization": {"Bearer " + secret},
				},
			}},
			expectedKey: &apikey.APIKey{
				ID:    1,
				OrgID: 1,
				Key:   hash,
				Role:  org.RoleAdmin,
			},
			expectedIdentity: &authn.Identity{
				ID:       "1",
				Type:     claims.TypeAPIKey,
				OrgID:    1,
				OrgRoles: map[int64]org.RoleType{1: org.RoleAdmin},
				ClientParams: authn.ClientParams{
					SyncPermissions: true,
				},
				AuthenticatedBy: login.APIKeyAuthModule,
			},
		},
		{
			desc: "should success for valid token that is connected to service account",
			req: &authn.Request{HTTPRequest: &http.Request{
				Header: map[string][]string{
					"Authorization": {"Bearer " + secret},
				},
			}},
			expectedKey: &apikey.APIKey{
				ID:               1,
				OrgID:            1,
				Key:              hash,
				ServiceAccountId: intPtr(1),
			},
			expectedIdentity: &authn.Identity{
				ID:    "1",
				Type:  claims.TypeServiceAccount,
				OrgID: 1,
				ClientParams: authn.ClientParams{
					FetchSyncedUser: true,
					SyncPermissions: true,
				},
				AuthenticatedBy: login.APIKeyAuthModule,
			},
		},
		{
			desc: "should fail for expired api key",
			req:  &authn.Request{HTTPRequest: &http.Request{Header: map[string][]string{"Authorization": {"Bearer " + secret}}}},
			expectedKey: &apikey.APIKey{
				Key:     hash,
				Expires: intPtr(0),
			},
			expectedErr: errAPIKeyExpired,
		},
		{
			desc: "should fail for revoked api key",
			req:  &authn.Request{HTTPRequest: &http.Request{Header: map[string][]string{"Authorization": {"Bearer " + secret}}}},
			expectedKey: &apikey.APIKey{
				Key:       hash,
				IsRevoked: &revoked,
			},
			expectedErr: errAPIKeyRevoked,
		},
		{
			desc: "should fail for api key in another organization",
			req:  &authn.Request{OrgID: 1, HTTPRequest: &http.Request{Header: map[string][]string{"Authorization": {"Bearer " + secret}}}},
			expectedKey: &apikey.APIKey{
				ID:               1,
				OrgID:            2,
				Key:              hash,
				ServiceAccountId: intPtr(1),
			},
			expectedErr: errAPIKeyOrgMismatch,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			c := ProvideAPIKey(&apikeytest.Service{ExpectedAPIKey: tt.expectedKey})

			identity, err := c.Authenticate(context.Background(), tt.req)
			if tt.expectedErr != nil {
				assert.Nil(t, identity)
				assert.ErrorIs(t, err, tt.expectedErr)
				return
			}

			assert.NoError(t, err)
			assert.EqualValues(t, *tt.expectedIdentity, *identity)
			assert.Equal(t, tt.req.OrgID, tt.expectedIdentity.OrgID, "the request organization should match the identity's one")
		})
	}
}

func TestAPIKey_Test(t *testing.T) {
	type TestCase struct {
		desc     string
		req      *authn.Request
		expected bool
	}

	tests := []TestCase{
		{
			desc: "should succeed when api key is provided in Authorization header as bearer token",
			req: &authn.Request{HTTPRequest: &http.Request{
				Header: map[string][]string{
					"Authorization": {"Bearer 123123"},
				},
			}},
			expected: true,
		},
		{
			desc: "should succeed when api key is provided in Authorization header as basic auth and api_key as username",
			req: &authn.Request{HTTPRequest: &http.Request{
				Header: map[string][]string{
					"Authorization": {encodeBasicAuth("api_key", "test")},
				},
			}},
			expected: true,
		},
		{
			desc:     "should fail when no http request is passed",
			req:      &authn.Request{},
			expected: false,
		},
		{
			desc: "should fail when no there is no Authorization header",
			req: &authn.Request{HTTPRequest: &http.Request{
				Header: map[string][]string{},
			}},
			expected: false,
		},
		{
			desc: "should fail when Authorization header is not prefixed with Basic or Bearer",
			req: &authn.Request{HTTPRequest: &http.Request{
				Header: map[string][]string{
					"Authorization": {"test"},
				},
			}},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			c := ProvideAPIKey(&apikeytest.Service{})
			assert.Equal(t, tt.expected, c.Test(context.Background(), tt.req))
		})
	}
}

func TestAPIKey_ResolveIdentity(t *testing.T) {
	type testCase struct {
		desc string
		typ  claims.IdentityType
		id   string

		exptedApiKey *apikey.APIKey

		expectedIdenity *authn.Identity
		expectedErr     error
	}

	tests := []testCase{
		{
			desc:        "should return error for invalid type",
			id:          "1",
			typ:         claims.TypeUser,
			expectedErr: errAPIKeyInvalidType,
		},
		{
			desc: "should return error when api key has expired",
			id:   "1",
			typ:  claims.TypeAPIKey,
			exptedApiKey: &apikey.APIKey{
				ID:      1,
				OrgID:   1,
				Expires: intPtr(0),
			},
			expectedErr: errAPIKeyExpired,
		},
		{
			desc: "should return error when api key is revoked",
			id:   "1",
			typ:  claims.TypeAPIKey,
			exptedApiKey: &apikey.APIKey{
				ID:        1,
				OrgID:     1,
				IsRevoked: boolPtr(true),
			},
			expectedErr: errAPIKeyRevoked,
		},
		{
			desc: "should return error when api key is connected to service account",
			id:   "1",
			typ:  claims.TypeAPIKey,

			exptedApiKey: &apikey.APIKey{
				ID:               1,
				OrgID:            1,
				ServiceAccountId: intPtr(1),
			},
			expectedErr: errAPIKeyInvalidType,
		},
		{
			desc: "should return error when api key is belongs to different org",
			id:   "1",
			typ:  claims.TypeAPIKey,
			exptedApiKey: &apikey.APIKey{
				ID:               1,
				OrgID:            2,
				ServiceAccountId: intPtr(1),
			},
			expectedErr: errAPIKeyOrgMismatch,
		},
		{
			desc: "should return valid idenitty",
			id:   "1",
			typ:  claims.TypeAPIKey,
			exptedApiKey: &apikey.APIKey{
				ID:    1,
				OrgID: 1,
				Role:  org.RoleEditor,
			},
			expectedIdenity: &authn.Identity{
				OrgID:           1,
				OrgRoles:        map[int64]org.RoleType{1: org.RoleEditor},
				ID:              "1",
				Type:            claims.TypeAPIKey,
				AuthenticatedBy: login.APIKeyAuthModule,
				ClientParams:    authn.ClientParams{SyncPermissions: true},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			c := ProvideAPIKey(&apikeytest.Service{
				ExpectedAPIKey: tt.exptedApiKey,
			})

			identity, err := c.ResolveIdentity(context.Background(), 1, tt.typ, tt.id)
			if tt.expectedErr != nil {
				assert.Nil(t, identity)
				assert.ErrorIs(t, err, tt.expectedErr)
				return
			}

			assert.NoError(t, err)
			assert.EqualValues(t, *tt.expectedIdenity, *identity)
		})
	}
}

func intPtr(n int64) *int64 {
	return &n
}

func boolPtr(b bool) *bool {
	return &b
}

func genApiKey(legacy bool) (string, string) {
	if legacy {
		res, _ := apikeygen.New(1, "test")
		return res.ClientSecret, res.HashedKey
	}
	res, _ := satokengen.New("test")
	return res.ClientSecret, res.HashedKey
}

func encodeBasicAuth(username, password string) string {
	return "Basic " + base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("%s:%s", username, password)))
}
