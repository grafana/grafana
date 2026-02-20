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
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAPIBuilder_ValidateNamespaceIfPresent(t *testing.T) {
	logger := log.NewNopLogger()
	b := &APIBuilder{logger: logger}

	tests := []struct {
		name          string
		authNamespace string
		requestBody   string
		noAuthInfo    bool
		expectedValid bool
	}{
		{
			name:          "no namespace in eval context - always valid",
			authNamespace: "stacks-1",
			requestBody:   `{"context":{}}`,
			expectedValid: true,
		},
		{
			name:          "no context object at all - always valid",
			authNamespace: "stacks-1",
			requestBody:   `{}`,
			expectedValid: true,
		},
		{
			name:          "namespace matches auth namespace - valid",
			authNamespace: "stacks-1",
			requestBody:   `{"context":{"namespace":"stacks-1"}}`,
			expectedValid: true,
		},
		{
			name:          "namespace does not match auth namespace - invalid",
			authNamespace: "stacks-1",
			requestBody:   `{"context":{"namespace":"stacks-99"}}`,
			expectedValid: false,
		},
		{
			name:          "unauthenticated with namespace in eval context - valid",
			authNamespace: "",
			requestBody:   `{"context":{"namespace":"stacks-1"}}`,
			expectedValid: true,
		},
		{
			name:          "unauthenticated with no namespace - valid",
			authNamespace: "",
			requestBody:   `{"context":{}}`,
			expectedValid: true,
		},
		{
			name:          "no auth info at all - valid (public flag gating handles unauthed)",
			requestBody:   `{"context":{"namespace":"stacks-1"}}`,
			noAuthInfo:    true,
			expectedValid: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/ofrep/v1/evaluate/flags", bytes.NewBufferString(tt.requestBody))
			req.Header.Set("Content-Type", "application/json")

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

			valid := b.validateNamespaceIfPresent(req)
			assert.Equal(t, tt.expectedValid, valid)

			// Body must still be readable after validation
			body, err := io.ReadAll(req.Body)
			require.NoError(t, err)
			assert.Equal(t, tt.requestBody, string(body))
		})
	}
}

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

func TestRootOneFlagHandler_MissingFlagKey(t *testing.T) {
	b := &APIBuilder{
		providerType: setting.OFREPProviderType,
		logger:       log.NewNopLogger(),
	}

	req := httptest.NewRequest(http.MethodPost, "/ofrep/v1/evaluate/flags/", bytes.NewBufferString(`{}`))
	// No flagKey in mux.Vars
	w := httptest.NewRecorder()
	b.rootOneFlagHandler(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestRootOneFlagHandler_UnauthedNonPublicFlag(t *testing.T) {
	b := &APIBuilder{
		providerType: setting.OFREPProviderType,
		logger:       log.NewNopLogger(),
	}

	req := httptest.NewRequest(http.MethodPost, "/ofrep/v1/evaluate/flags/secretflag", bytes.NewBufferString(`{}`))
	req = mux.SetURLVars(req, map[string]string{"flagKey": "secretflag"})

	// Unauthenticated requester
	requester := &identity.StaticRequester{
		Type: types.TypeUnauthenticated,
	}
	ctx := types.WithAuthInfo(req.Context(), requester)
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	b.rootOneFlagHandler(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestRootAllFlagsHandler_NamespaceMismatch(t *testing.T) {
	b := &APIBuilder{
		providerType: setting.OFREPProviderType,
		logger:       log.NewNopLogger(),
	}

	body := `{"context":{"namespace":"stacks-99"}}`
	req := httptest.NewRequest(http.MethodPost, "/ofrep/v1/evaluate/flags", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")

	requester := &identity.StaticRequester{
		OrgID:     1,
		Namespace: "stacks-1",
	}
	ctx := types.WithAuthInfo(req.Context(), requester)
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	b.rootAllFlagsHandler(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestRootAllFlagsHandler_NoNamespaceInBody(t *testing.T) {
	b := &APIBuilder{
		providerType: setting.OFREPProviderType,
		logger:       log.NewNopLogger(),
		// url is nil so proxy will fail - but validation should pass first
	}

	body := `{"context":{}}`
	req := httptest.NewRequest(http.MethodPost, "/ofrep/v1/evaluate/flags", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")

	requester := &identity.StaticRequester{
		OrgID:     1,
		Namespace: "stacks-1",
	}
	ctx := types.WithAuthInfo(req.Context(), requester)
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	b.rootAllFlagsHandler(w, req)
	// Validation passes (no namespace to mismatch), but proxy fails with 500 (nil URL)
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestRootOneFlagHandler_NamespaceMismatch(t *testing.T) {
	b := &APIBuilder{
		providerType: setting.OFREPProviderType,
		logger:       log.NewNopLogger(),
	}

	body := `{"context":{"namespace":"stacks-99"}}`
	req := httptest.NewRequest(http.MethodPost, "/ofrep/v1/evaluate/flags/testflag", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"flagKey": "testflag"})

	requester := &identity.StaticRequester{
		OrgID:     1,
		Namespace: "stacks-1",
	}
	ctx := types.WithAuthInfo(req.Context(), requester)
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	b.rootOneFlagHandler(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}
