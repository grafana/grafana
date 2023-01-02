package clients

import (
	"context"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/loginattempt/loginattempttest"
	"github.com/stretchr/testify/assert"
)

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
