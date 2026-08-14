package clients

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
)

func TestForm_Authenticate(t *testing.T) {
	type testCase struct {
		desc        string
		req         *authn.Request
		expectedErr error
	}

	tests := []testCase{
		{
			desc: "should success on valid request",
			req: &authn.Request{HTTPRequest: &http.Request{
				Header: map[string][]string{"Content-Type": {"application/json"}},
				Body:   io.NopCloser(strings.NewReader(`{"user": "test", "password": "test"}`)),
			}},
		},
		{
			desc: "should return error for bad request",
			req: &authn.Request{HTTPRequest: &http.Request{
				Header: map[string][]string{"Content-Type": {"application/json"}},
				Body:   io.NopCloser(strings.NewReader(`{}`)),
			}},
			expectedErr: errBadForm,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			c := ProvideForm(&authntest.FakePasswordClient{})
			_, err := c.Authenticate(context.Background(), tt.req)
			assert.ErrorIs(t, err, tt.expectedErr)
		})
	}
}
