package clients

import (
	"context"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
)

func TestProxy_Authenticate(t *testing.T) {
	type testCase struct {
		desc string
	}

	tests := []testCase{
		{
			desc: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {

		})
	}
}

func TestProxy_Test(t *testing.T) {
	type testCase struct {
		desc       string
		req        *authn.Request
		expectedOK bool
	}

	tests := []testCase{
		{
			desc: "should return true when proxy header exists",
			req: &authn.Request{
				HTTPRequest: &http.Request{
					Header: map[string][]string{"Proxy-Header": {"some value"}},
				},
			},
			expectedOK: true,
		},
		{
			desc: "should return false when proxy header exists but has no value",
			req: &authn.Request{
				HTTPRequest: &http.Request{
					Header: map[string][]string{"Proxy-Header": {""}},
				},
			},
			expectedOK: false,
		},
		{
			desc: "should return false when no proxy header is set on request",
			req: &authn.Request{
				HTTPRequest: &http.Request{Header: map[string][]string{}},
			},
			expectedOK: false,
		},
		{
			desc:       "should return false when no http request is present",
			req:        &authn.Request{},
			expectedOK: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.AuthProxyHeaderName = "Proxy-Header"

			c, _ := ProvideProxy(cfg, nil)
			assert.Equal(t, tt.expectedOK, c.Test(context.Background(), tt.req))
		})
	}
}
