package ofrep

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAPIBuilder_ValidateNamespace(t *testing.T) {
	logger := log.NewNopLogger()
	builder := &APIBuilder{
		logger: logger,
	}

	tests := []struct {
		name              string
		authNamespace     string // namespace from auth info
		urlNamespace      string // namespace from URL vars
		requestBody       string // request body with eval context
		noAuthInfo        bool   // if true, don't add auth info to context
		expectedValid     bool
		expectedNamespace string
	}{
		{
			name:              "matching namespace",
			authNamespace:     "stacks-1",
			urlNamespace:      "stacks-1",
			requestBody:       `{"context":{"namespace":"stacks-1"}}`,
			expectedValid:     true,
			expectedNamespace: "stacks-1",
		},
		{
			name:              "matching namespace with other fields",
			authNamespace:     "stacks-1",
			urlNamespace:      "stacks-1",
			requestBody:       `{"context":{"namespace":"stacks-1","cluster":"cluster-1"}}`,
			expectedValid:     true,
			expectedNamespace: "stacks-1",
		},
		{
			name:              "mismatched namespace",
			authNamespace:     "stacks-1",
			urlNamespace:      "stacks-1",
			requestBody:       `{"context":{"namespace":"stacks-11111"}}`,
			expectedValid:     false,
			expectedNamespace: "stacks-11111",
		},
		{
			name:              "missing namespace in eval context",
			authNamespace:     "stacks-1",
			urlNamespace:      "stacks-1",
			requestBody:       `{"context":{}}`,
			expectedValid:     false,
			expectedNamespace: "",
		},
		{
			name:              "empty namespace in eval context",
			authNamespace:     "stacks-1",
			urlNamespace:      "stacks-1",
			requestBody:       `{"context":{"namespace":""}}`,
			expectedValid:     false,
			expectedNamespace: "",
		},
		{
			name:              "missing context object",
			authNamespace:     "stacks-1",
			urlNamespace:      "stacks-1",
			requestBody:       `{"field":"value"}`,
			expectedValid:     false,
			expectedNamespace: "",
		},
		{
			name:              "auth namespace takes precedence over URL namespace",
			authNamespace:     "stacks-2",
			urlNamespace:      "stacks-3",
			requestBody:       `{"context":{"namespace":"stacks-2"}}`,
			expectedValid:     true,
			expectedNamespace: "stacks-2",
		},
		{
			name:              "falls back to URL namespace when auth namespace is empty",
			urlNamespace:      "stacks-3",
			requestBody:       `{"context":{"namespace":"stacks-3"}}`,
			expectedValid:     true,
			expectedNamespace: "stacks-3",
		},
		{
			name:              "no auth info fails validation",
			urlNamespace:      "stacks-1",
			requestBody:       `{"context":{"namespace":"stacks-1"}}`,
			noAuthInfo:        true,
			expectedValid:     false,
			expectedNamespace: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create request with body
			req := httptest.NewRequest(http.MethodPost, "/ofrep/v1/evaluate/flags/flag1", bytes.NewBufferString(tt.requestBody))
			req.Header.Set("Content-Type", "application/json")
			req = mux.SetURLVars(req, map[string]string{"namespace": tt.urlNamespace})

			if !tt.noAuthInfo {
				requester := &identity.StaticRequester{
					OrgID:     1,
					Namespace: tt.authNamespace,
				}
				ctx := types.WithAuthInfo(req.Context(), requester)
				req = req.WithContext(ctx)
			} else {
				req = req.WithContext(context.Background())
			}

			valid, ns := builder.validateNamespace(req)
			assert.Equal(t, tt.expectedValid, valid, "expected valid namespace")
			assert.Equal(t, tt.expectedNamespace, ns, "expected namespace to match")

			// Verify body can still be read after validation
			body, err := io.ReadAll(req.Body)
			require.NoError(t, err)
			assert.Equal(t, tt.requestBody, string(body), "request body should be readable after validation")
		})
	}
}
