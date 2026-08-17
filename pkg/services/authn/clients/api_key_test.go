package clients

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"k8s.io/apiserver/pkg/endpoints/request"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/components/satokengen"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/apikey/apikeytest"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
)

var (
	revoked      = true
	secret, hash = genApiKey()
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
			desc: "should fail for api key in another organization",
			req:  &authn.Request{OrgID: 1, HTTPRequest: &http.Request{Header: map[string][]string{"Authorization": {"Bearer " + secret}}}},
			expectedKey: &apikey.APIKey{
				ID:               1,
				OrgID:            2,
				Key:              hash,
				ServiceAccountId: new(int64(1)),
			},
			expectedErr: errAPIKeyOrgMismatch,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			c := ProvideAPIKey(&apikeytest.Service{ExpectedAPIKey: tt.expectedKey}, tracing.InitializeTracerForTest())

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
			c := ProvideAPIKey(&apikeytest.Service{}, tracing.InitializeTracerForTest())
			assert.Equal(t, tt.expected, c.Test(context.Background(), tt.req))
		})
	}
}

type capturingAPIKeyService struct {
	apikeytest.Service
	calls chan context.Context
}

func (s *capturingAPIKeyService) UpdateAPIKeyLastUsedDate(ctx context.Context, tokenID int64) error {
	s.calls <- ctx
	return nil
}

func TestAPIKey_Hook(t *testing.T) {
	t.Run("last used update should survive request cancellation but keep context values", func(t *testing.T) {
		service := &capturingAPIKeyService{calls: make(chan context.Context, 1)}
		c := ProvideAPIKey(service, tracing.InitializeTracerForTest())

		ctx, cancel := context.WithCancel(request.WithNamespace(context.Background(), "stacks-11"))
		req := &authn.Request{}
		req.SetMeta(metaKeyID, "7")

		assert.NoError(t, c.Hook(ctx, &authn.Identity{}, req))
		cancel() // the request ends before the detached write runs

		select {
		case got := <-service.calls:
			ns, ok := request.NamespaceFrom(got)
			assert.True(t, ok)
			assert.Equal(t, "stacks-11", ns)
			assert.NoError(t, got.Err())
		case <-time.After(time.Second):
			t.Fatal("expected UpdateAPIKeyLastUsedDate to be called")
		}
	})

	t.Run("should skip last used update when the skip meta is set", func(t *testing.T) {
		service := &capturingAPIKeyService{calls: make(chan context.Context, 1)}
		c := ProvideAPIKey(service, tracing.InitializeTracerForTest())

		req := &authn.Request{}
		req.SetMeta(metaKeyID, "7")
		req.SetMeta(metaKeySkipLastUsed, "true")

		assert.NoError(t, c.Hook(context.Background(), &authn.Identity{}, req))

		select {
		case <-service.calls:
			t.Fatal("expected UpdateAPIKeyLastUsedDate not to be called")
		default:
		}
	})
}

func genApiKey() (string, string) {
	res, _ := satokengen.New("test")
	return res.ClientSecret, res.HashedKey
}

func encodeBasicAuth(username, password string) string {
	return "Basic " + base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("%s:%s", username, password)))
}
