package clients

import (
	"context"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/grafana/grafana/pkg/services/loginattempt/loginattempttest"
	"github.com/stretchr/testify/assert"
)

func TestBasic_Authenticate(t *testing.T) {
	type TestCase struct {
		desc             string
		req              *authn.Request
		blockLogin       bool
		clients          []authn.PasswordClient
		expectedErr      error
		expectedIdentity *authn.Identity
	}

	tests := []TestCase{
		{
			desc:             "should success when password client return identity",
			req:              &authn.Request{HTTPRequest: &http.Request{Header: map[string][]string{authorizationHeaderName: {encodeBasicAuth("user", "password")}}}},
			clients:          []authn.PasswordClient{authntest.FakePasswordClient{ExpectedIdentity: &authn.Identity{ID: "user:1"}}},
			expectedIdentity: &authn.Identity{ID: "user:1"},
		},
		{
			desc:             "should success when found in second client",
			req:              &authn.Request{HTTPRequest: &http.Request{Header: map[string][]string{authorizationHeaderName: {encodeBasicAuth("user", "password")}}}},
			clients:          []authn.PasswordClient{authntest.FakePasswordClient{ExpectedErr: errIdentityNotFound}, authntest.FakePasswordClient{ExpectedIdentity: &authn.Identity{ID: "user:2"}}},
			expectedIdentity: &authn.Identity{ID: "user:2"},
		},
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
		{
			desc:        "should fail when not found in any clients",
			req:         &authn.Request{HTTPRequest: &http.Request{Header: map[string][]string{authorizationHeaderName: {encodeBasicAuth("user", "password")}}}},
			clients:     []authn.PasswordClient{authntest.FakePasswordClient{ExpectedErr: errIdentityNotFound}, authntest.FakePasswordClient{ExpectedErr: errIdentityNotFound}},
			expectedErr: errBasicAuthCredentials,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			c := ProvideBasic(
				loginattempttest.FakeLoginAttemptService{ExpectedValid: !tt.blockLogin},
				tt.clients...,
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
		desc      string
		req       *authn.Request
		noClients bool
		expected  bool
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
			desc: "should fail when no password client is configured",
			req: &authn.Request{
				HTTPRequest: &http.Request{
					Header: map[string][]string{
						authorizationHeaderName: {encodeBasicAuth("user", "password")},
					},
				},
			},
			noClients: true,
			expected:  false,
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
			c := ProvideBasic(loginattempttest.FakeLoginAttemptService{}, authntest.FakePasswordClient{})
			if tt.noClients {
				c.clients = nil
			}
			assert.Equal(t, tt.expected, c.Test(context.Background(), tt.req))
		})
	}
}
