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
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
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
		{
			name:          "wildcard auth namespace - valid for any specific namespace",
			authNamespace: "*",
			requestBody:   `{"context":{"namespace":"stacks-1"}}`,
			expectedValid: true,
		},
		{
			name:          "empty body - always valid",
			authNamespace: "stacks-1",
			requestBody:   ``,
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

			evalCtx, err := b.readEvalContext(httptest.NewRecorder(), req)
			require.NoError(t, err)

			_, valid := b.validateNamespaceIfPresent(req, evalCtx)
			assert.Equal(t, tt.expectedValid, valid)

			// Body must still be readable after readEvalContext
			body, err := io.ReadAll(req.Body)
			require.NoError(t, err)
			assert.Equal(t, tt.requestBody, string(body))
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

// TestGrafanaHTTPHandler_UnauthenticatedSeen verifies that grafanaHTTPHandler does
// NOT inject the SignedInUser into the request context when IsSignedIn=false.
// Grafana always populates SignedInUser (even for unauthenticated requests) with a
// zero-value struct whose GetIdentityType() returns TypeEmpty, not TypeUnauthenticated,
// so naively injecting it would cause isAuthenticatedRequest to return true for
// unauthenticated requests and leak non-public flags.
func TestGrafanaHTTPHandler_UnauthenticatedDoesNotInjectIdentity(t *testing.T) {
	b := &APIBuilder{logger: log.NewNopLogger()}

	var gotIsAuthed bool
	inner := func(c *contextmodel.ReqContext) {
		gotIsAuthed = b.isAuthenticatedRequest(c.Req)
	}
	handler := b.grafanaHTTPHandler(inner)

	req := httptest.NewRequest(http.MethodPost, "/ofrep/v1/evaluate/flags", nil)
	c := &contextmodel.ReqContext{
		Context:      &web.Context{Req: req},
		SignedInUser: &user.SignedInUser{},
		IsSignedIn:   false,
	}

	handler(c)
	assert.False(t, gotIsAuthed, "unauthenticated request should not appear authenticated")
}

func TestGrafanaHTTPHandler_AuthenticatedInjectsIdentity(t *testing.T) {
	b := &APIBuilder{logger: log.NewNopLogger()}

	var gotIsAuthed bool
	inner := func(c *contextmodel.ReqContext) {
		gotIsAuthed = b.isAuthenticatedRequest(c.Req)
	}
	handler := b.grafanaHTTPHandler(inner)

	req := httptest.NewRequest(http.MethodPost, "/ofrep/v1/evaluate/flags", nil)
	c := &contextmodel.ReqContext{
		Context:      &web.Context{Req: req},
		SignedInUser: &user.SignedInUser{UserID: 1},
		IsSignedIn:   true,
	}

	handler(c)
	assert.True(t, gotIsAuthed, "authenticated request should appear authenticated")
}
