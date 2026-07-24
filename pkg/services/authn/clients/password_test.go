package clients

import (
	"context"
	"net/http"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/grafana/grafana/pkg/services/loginattempt/loginattempttest"
)

func TestPassword_AuthenticatePassword(t *testing.T) {
	type TestCase struct {
		desc             string
		username         string
		password         string
		blockLogin       bool
		clients          []authn.PasswordClient
		expectedErr      error
		expectedIdentity *authn.Identity
	}

	tests := []TestCase{
		{
			desc:             "should success when password client return identity",
			username:         "test",
			password:         "test",
			clients:          []authn.PasswordClient{authntest.FakePasswordClient{ExpectedIdentity: &authn.Identity{ID: "1", Type: claims.TypeUser}}},
			expectedIdentity: &authn.Identity{ID: "1", Type: claims.TypeUser},
		},
		{
			desc:             "should success when found in second client",
			username:         "test",
			password:         "test",
			clients:          []authn.PasswordClient{authntest.FakePasswordClient{ExpectedErr: errIdentityNotFound}, authntest.FakePasswordClient{ExpectedIdentity: &authn.Identity{ID: "2", Type: claims.TypeUser}}},
			expectedIdentity: &authn.Identity{ID: "2", Type: claims.TypeUser},
		},
		{
			desc:        "should fail for empty password",
			username:    "test",
			password:    "",
			expectedErr: errPasswordAuthFailed,
		},
		{
			desc:        "should if login is blocked by to many attempts",
			username:    "test",
			password:    "test",
			blockLogin:  true,
			expectedErr: errPasswordAuthFailed,
		},
		{
			desc:        "should fail when not found in any clients",
			username:    "test",
			password:    "test",
			clients:     []authn.PasswordClient{authntest.FakePasswordClient{ExpectedErr: errIdentityNotFound}, authntest.FakePasswordClient{ExpectedErr: errIdentityNotFound}},
			expectedErr: errPasswordAuthFailed,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			c := ProvidePassword(loginattempttest.FakeLoginAttemptService{ExpectedValid: !tt.blockLogin}, tracing.InitializeTracerForTest(), tt.clients...)
			r := &authn.Request{
				OrgID: 12345,
				HTTPRequest: &http.Request{
					Method: "GET",
					URL: &url.URL{
						Scheme: "https",
						Host:   "example.com",
						Path:   "/api/v1/resource",
					},
					Header: http.Header{
						"Content-Type": []string{"application/json"},
						"User-Agent":   []string{"MyApp/1.0"},
					},
				},
			}
			identity, err := c.AuthenticatePassword(context.Background(), r, tt.username, tt.password)
			if tt.expectedErr != nil {
				assert.ErrorIs(t, err, tt.expectedErr)
				assert.Nil(t, identity)
			} else {
				assert.NoError(t, err)
				assert.EqualValues(t, *tt.expectedIdentity, *identity)
			}
		})
	}
}
