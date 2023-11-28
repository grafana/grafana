package clients

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
)

func TestBasic_Authenticate(t *testing.T) {
	type TestCase struct {
		desc             string
		req              *authn.Request
		client           authn.PasswordClient
		expectedErr      error
		expectedIdentity *authn.Identity
	}

	tests := []TestCase{
		{
			desc:             "should success when password client return identity",
			req:              &authn.Request{HTTPRequest: &http.Request{Header: map[string][]string{authorizationHeaderName: {encodeBasicAuth("user", "password")}}}},
			client:           authntest.FakePasswordClient{ExpectedIdentity: &authn.Identity{ID: "user:1"}},
			expectedIdentity: &authn.Identity{ID: "user:1"},
		},
		{
			desc:        "should fail when basic auth header could not be decoded",
			req:         &authn.Request{HTTPRequest: &http.Request{Header: map[string][]string{authorizationHeaderName: {}}}},
			expectedErr: errDecodingBasicAuthHeader,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			c := ProvideBasic(tt.client)

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
		{
			desc: "should fail when the URL ends with /oauth2/introspect",
			req: &authn.Request{
				HTTPRequest: &http.Request{Header: map[string][]string{authorizationHeaderName: {encodeBasicAuth("user", "password")}}, RequestURI: "/oauth2/introspect"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			c := ProvideBasic(authntest.FakePasswordClient{})
			assert.Equal(t, tt.expected, c.Test(context.Background(), tt.req))
		})
	}
}
