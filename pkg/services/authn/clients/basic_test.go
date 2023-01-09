package clients

import (
	"context"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/loginattempt/loginattempttest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/assert"
)

func TestBasic_Authenticate(t *testing.T) {
	type TestCase struct {
		desc                 string
		req                  *authn.Request
		blockLogin           bool
		expectedErr          error
		expectedSignedInUser *user.SignedInUser
		expectedIdentity     *authn.Identity
	}

	tests := []TestCase{
		{
			desc:        "should fail for empty password",
			req:         &authn.Request{HTTPRequest: &http.Request{Header: map[string][]string{authorizationHeaderName: {encodeBasicAuth("user", "")}}}},
			expectedErr: errBasicAuthCredentials,
		},
		{
			desc:        "should if login is blocked by to many attempts",
			req:         &authn.Request{HTTPRequest: &http.Request{Header: map[string][]string{authorizationHeaderName: {encodeBasicAuth("user", "")}}}},
			blockLogin:  true,
			expectedErr: errBasicAuthCredentials,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			hashed, _ := util.EncodePassword("password", "salt")

			c := ProvideBasic(
				loginattempttest.FakeLoginAttemptService{ExpectedValid: !tt.blockLogin},
				ProvideGrafana(&usertest.FakeUserService{ExpectedUser: &user.User{Password: hashed, Salt: "salt"}, ExpectedSignedInUser: tt.expectedSignedInUser}),
			)

			identity, err := c.Authenticate(context.Background(), tt.req)
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

func TestBasic_Test(t *testing.T) {
	type TestCase struct {
		desc     string
		req      *authn.Request
		expected bool
	}

	tests := []TestCase{
		{
			desc: "should succeed when authorization header is set with basic prefix",
			req: &authn.Request{
				HTTPRequest: &http.Request{
					Header: map[string][]string{
						authorizationHeaderName: {encodeBasicAuth("user", "password")},
					},
				},
			},
			expected: true,
		},
		{
			desc: "should fail when no http request is passed",
			req:  &authn.Request{},
		},
		{
			desc: "should fail when no http authorization header is set in http request",
			req: &authn.Request{
				HTTPRequest: &http.Request{Header: map[string][]string{}},
			},
		},
		{
			desc: "should fail when authorization header is set but without basic prefix",
			req: &authn.Request{
				HTTPRequest: &http.Request{Header: map[string][]string{authorizationHeaderName: {"something"}}},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			c := ProvideBasic(loginattempttest.FakeLoginAttemptService{})
			assert.Equal(t, tt.expected, c.Test(context.Background(), tt.req))
		})
	}
}
