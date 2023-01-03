package clients

import (
	"context"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/stretchr/testify/assert"
)

func TestRender_Authenticate(t *testing.T) {}

func TestRender_Test(t *testing.T) {
	type TestCase struct {
		desc     string
		req      *authn.Request
		expected bool
	}

	tests := []TestCase{
		{
			desc: "should success when request has render cookie available",
			req: &authn.Request{HTTPRequest: &http.Request{
				Header: map[string][]string{"Cookie": {"renderKey=123"}},
			}},
			expected: true,
		},
		{
			desc: "should fail if no http request is passed",
			req:  &authn.Request{},
		},
		{
			desc: "should fail if no renderKey cookie is present in request",
			req: &authn.Request{HTTPRequest: &http.Request{
				Header: map[string][]string{"Cookie": {"notRenderKey=123"}},
			}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			c := ProvideRender()
			assert.Equal(t, tt.expected, c.Test(context.Background(), tt.req))
		})
	}
}
