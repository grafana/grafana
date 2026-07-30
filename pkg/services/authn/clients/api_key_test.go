package clients

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/components/satokengen"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/serviceaccounttoken/contracts"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/apikey/apikeytest"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	satoken "github.com/grafana/grafana/pkg/storage/serviceaccount/token"
)

var (
	revoked      = true
	secret, hash = genApiKey()
)

// fakeTokenFetcher serves the token from an apikey.APIKey fixture, honouring the
// namespace scoping the real store applies.
type fakeTokenFetcher struct {
	key           *apikey.APIKey
	lastUsedID    string
	lastUsedCalls int
	lastUsedNSOrg int64
}

func (f *fakeTokenFetcher) UpdateLastUsedDate(_ context.Context, ns claims.NamespaceInfo, lastUsedID string) error {
	f.lastUsedCalls++
	f.lastUsedID = lastUsedID
	f.lastUsedNSOrg = ns.OrgID
	return nil
}

func (f *fakeTokenFetcher) GetByHash(_ context.Context, ns claims.NamespaceInfo, _ string) (*contracts.TokenInfo, error) {
	if f.key == nil {
		return nil, satoken.ErrTokenNotFound
	}
	// A token owned by a different org is invisible in this namespace.
	if f.key.OrgID != 0 && f.key.OrgID != ns.OrgID {
		return nil, satoken.ErrTokenNotFound
	}

	info := &contracts.TokenInfo{
		ID: f.key.ID,
		Token: &satoken.Token{
			Name:       f.key.Name,
			Expires:    f.key.Expires,
			LastUsedAt: f.key.LastUsedAt,
			IsRevoked:  f.key.IsRevoked,
		},
	}
	if f.key.ServiceAccountId != nil {
		info.ServiceAccountID = *f.key.ServiceAccountId
	}
	info.LastUsedID = strconv.FormatInt(f.key.ID, 10)
	return info, nil
}

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
			desc: "should fail for valid token that is not connected to a service account",
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
			expectedErr: errAPIKeyInvalid,
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
				ServiceAccountId: new(int64(1)),
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
				Expires: new(int64),
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
			// The token store is namespace scoped, so a token owned by another org is
			// not visible at all rather than being found and rejected.
			desc: "should fail for api key in another organization",
			req:  &authn.Request{OrgID: 1, HTTPRequest: &http.Request{Header: map[string][]string{"Authorization": {"Bearer " + secret}}}},
			expectedKey: &apikey.APIKey{
				ID:               1,
				OrgID:            2,
				Key:              hash,
				ServiceAccountId: new(int64(1)),
			},
			expectedErr: errAPIKeyInvalid,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			c := ProvideAPIKey(&apikeytest.Service{ExpectedAPIKey: tt.expectedKey}, &fakeTokenFetcher{key: tt.expectedKey}, tracing.InitializeTracerForTest())

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
			c := ProvideAPIKey(&apikeytest.Service{}, &fakeTokenFetcher{}, tracing.InitializeTracerForTest())
			assert.Equal(t, tt.expected, c.Test(context.Background(), tt.req))
		})
	}
}

func genApiKey() (string, string) {
	res, _ := satokengen.New("test")
	return res.ClientSecret, res.HashedKey
}

func encodeBasicAuth(username, password string) string {
	return "Basic " + base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("%s:%s", username, password)))
}

func TestAPIKeyHookStampsLastUsedThroughTheStorage(t *testing.T) {
	fetcher := &fakeTokenFetcher{key: &apikey.APIKey{ID: 7, OrgID: 1, ServiceAccountId: new(int64(1))}}
	c := ProvideAPIKey(&apikeytest.Service{}, fetcher, tracing.InitializeTracerForTest())

	r := &authn.Request{OrgID: 1}
	r.SetMeta(metaKeyID, "7")

	require.NoError(t, c.Hook(context.Background(), &authn.Identity{}, r))

	// The update runs in a goroutine.
	require.Eventually(t, func() bool { return fetcher.lastUsedCalls == 1 }, time.Second, 10*time.Millisecond)
	assert.Equal(t, "7", fetcher.lastUsedID)
	assert.Equal(t, int64(1), fetcher.lastUsedNSOrg)
}

func TestAPIKeyHookSkipsRecentlyUsedTokens(t *testing.T) {
	fetcher := &fakeTokenFetcher{}
	c := ProvideAPIKey(&apikeytest.Service{}, fetcher, tracing.InitializeTracerForTest())

	r := &authn.Request{OrgID: 1}
	r.SetMeta(metaKeySkipLastUsed, "true")

	require.NoError(t, c.Hook(context.Background(), &authn.Identity{}, r))
	assert.Zero(t, fetcher.lastUsedCalls)
}
