package clients

import (
	"context"
	"testing"

	"github.com/grafana/authlib/claims"
	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/grafana/grafana/pkg/services/loginattempt/loginattempttest"
)

func TestPassword_AuthenticatePassword(t *testing.T) {
	type TestCase struct {
		desc             string
		username         string
		password         string
		req              *authn.Request
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
			req:              &authn.Request{},
			clients:          []authn.PasswordClient{authntest.FakePasswordClient{ExpectedIdentity: &authn.Identity{ID: "1", Type: claims.TypeUser}}},
			expectedIdentity: &authn.Identity{ID: "1", Type: claims.TypeUser},
		},
		{
			desc:             "should success when found in second client",
			username:         "test",
			password:         "test",
			req:              &authn.Request{},
			clients:          []authn.PasswordClient{authntest.FakePasswordClient{ExpectedErr: errIdentityNotFound}, authntest.FakePasswordClient{ExpectedIdentity: &authn.Identity{ID: "2", Type: claims.TypeUser}}},
			expectedIdentity: &authn.Identity{ID: "2", Type: claims.TypeUser},
		},
		{
			desc:        "should fail for empty password",
			username:    "test",
			password:    "",
			req:         &authn.Request{},
			expectedErr: errPasswordAuthFailed,
		},
		{
			desc:        "should if login is blocked by to many attempts",
			username:    "test",
			password:    "test",
			req:         &authn.Request{},
			blockLogin:  true,
			expectedErr: errPasswordAuthFailed,
		},
		{
			desc:        "should fail when not found in any clients",
			username:    "test",
			password:    "test",
			req:         &authn.Request{},
			clients:     []authn.PasswordClient{authntest.FakePasswordClient{ExpectedErr: errIdentityNotFound}, authntest.FakePasswordClient{ExpectedErr: errIdentityNotFound}},
			expectedErr: errPasswordAuthFailed,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			c := ProvidePassword(loginattempttest.FakeLoginAttemptService{ExpectedValid: !tt.blockLogin}, tt.clients...)

			identity, err := c.AuthenticatePassword(context.Background(), tt.req, tt.username, tt.password)
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
