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
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
)

func TestReadEvalContext(t *testing.T) {
	b := &APIBuilder{logger: log.NewNopLogger()}

	tests := []struct {
		name        string
		body        string
		expectedCtx evalContext
		expectErr   bool
	}{
		{
			name:        "valid body",
			body:        `{"context":{"namespace":"stacks-1","slug":"myslug"}}`,
			expectedCtx: evalContext{namespace: "stacks-1", slug: "myslug"},
		},
		{
			name:        "empty context fields",
			body:        `{"context":{}}`,
			expectedCtx: evalContext{},
		},
		{
			name:        "empty body",
			body:        ``,
			expectedCtx: evalContext{},
		},
		{
			name:      "malformed JSON",
			body:      `not-json`,
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/", bytes.NewBufferString(tt.body))

			evalCtx, err := b.readEvalContext(httptest.NewRecorder(), req)
			if tt.expectErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			assert.Equal(t, tt.expectedCtx, evalCtx)

			// Body must still be readable after readEvalContext
			body, err := io.ReadAll(req.Body)
			require.NoError(t, err)
			assert.Equal(t, tt.body, string(body))
		})
	}
}

func TestAPIBuilder_ValidateNamespace(t *testing.T) {
	logger := log.NewNopLogger()
	builder := &APIBuilder{
		logger: logger,
	}

	tests := []struct {
		name                  string
		authNamespace         string // namespace from auth info
		urlNamespace          string // namespace from URL vars
		requestBody           string // request body with eval context
		noAuthInfo            bool   // if true, don't add auth info to context
		expectedValid         bool
		expectedAuthNamespace string // auth namespace returned by validateNamespace
	}{
		{
			name:                  "matching namespace",
			authNamespace:         "stacks-1",
			urlNamespace:          "stacks-1",
			requestBody:           `{"context":{"namespace":"stacks-1"}}`,
			expectedValid:         true,
			expectedAuthNamespace: "stacks-1",
		},
		{
			name:                  "matching namespace with other fields",
			authNamespace:         "stacks-1",
			urlNamespace:          "stacks-1",
			requestBody:           `{"context":{"namespace":"stacks-1","cluster":"cluster-1"}}`,
			expectedValid:         true,
			expectedAuthNamespace: "stacks-1",
		},
		{
			name:                  "mismatched namespace",
			authNamespace:         "stacks-1",
			urlNamespace:          "stacks-1",
			requestBody:           `{"context":{"namespace":"stacks-11111"}}`,
			expectedValid:         false,
			expectedAuthNamespace: "stacks-1",
		},
		{
			name:                  "missing namespace in eval context",
			authNamespace:         "stacks-1",
			urlNamespace:          "stacks-1",
			requestBody:           `{"context":{}}`,
			expectedValid:         false,
			expectedAuthNamespace: "stacks-1",
		},
		{
			name:                  "empty namespace in eval context",
			authNamespace:         "stacks-1",
			urlNamespace:          "stacks-1",
			requestBody:           `{"context":{"namespace":""}}`,
			expectedValid:         false,
			expectedAuthNamespace: "stacks-1",
		},
		{
			name:                  "missing context object",
			authNamespace:         "stacks-1",
			urlNamespace:          "stacks-1",
			requestBody:           `{"field":"value"}`,
			expectedValid:         false,
			expectedAuthNamespace: "stacks-1",
		},
		{
			name:                  "auth namespace takes precedence over URL namespace",
			authNamespace:         "stacks-2",
			urlNamespace:          "stacks-3",
			requestBody:           `{"context":{"namespace":"stacks-2"}}`,
			expectedValid:         true,
			expectedAuthNamespace: "stacks-2",
		},
		{
			name:                  "falls back to URL namespace when auth namespace is empty",
			urlNamespace:          "stacks-3",
			requestBody:           `{"context":{"namespace":"stacks-3"}}`,
			expectedValid:         true,
			expectedAuthNamespace: "stacks-3",
		},
		{
			name:                  "no auth info fails validation",
			urlNamespace:          "stacks-1",
			requestBody:           `{"context":{"namespace":"stacks-1"}}`,
			noAuthInfo:            true,
			expectedValid:         false,
			expectedAuthNamespace: "",
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

			evalCtx, err := builder.readEvalContext(httptest.NewRecorder(), req)
			require.NoError(t, err)

			authNamespace, valid := builder.validateNamespace(req, evalCtx.namespace)
			assert.Equal(t, tt.expectedValid, valid, "expected valid namespace")
			assert.Equal(t, tt.expectedAuthNamespace, authNamespace, "expected auth namespace to match")

			// Verify body can still be read after readEvalContext
			body, err := io.ReadAll(req.Body)
			require.NoError(t, err)
			assert.Equal(t, tt.requestBody, string(body), "request body should be readable after readEvalContext")
		})
	}
}
