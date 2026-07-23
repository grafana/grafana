package ofrep

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	goffmodel "github.com/thomaspoignant/go-feature-flag/cmd/relayproxy/model"
)

func TestAPIBuilder_ValidateNamespace(t *testing.T) {
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

			_, valid := b.validateNamespace(req, evalCtx)
			assert.Equal(t, tt.expectedValid, valid)

			// Body must still be readable after readEvalContext
			body, err := io.ReadAll(req.Body)
			require.NoError(t, err)
			assert.Equal(t, tt.requestBody, string(body))
		})
	}
}

// TestValidateNamespace_UnauthPathNamespace verifies that an unauthenticated request on
// the deprecated /apis/.../namespaces/:namespace/ofrep path forwards the namespace taken
// from the URL (mirroring the apiserver's useNamespaceFromPath behavior) without
// authenticating the request.
func TestValidateNamespace_UnauthPathNamespace(t *testing.T) {
	b := &APIBuilder{logger: log.NewNopLogger()}

	newReq := func(body, pathNS string) *http.Request {
		target := "/apis/features.grafana.app/v0alpha1/namespaces/" + pathNS + "/ofrep/v1/evaluate/flags"
		req := httptest.NewRequest(http.MethodPost, target, bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		// Unauthenticated: no auth info injected, only the path namespace is available.
		return mux.SetURLVars(req, map[string]string{"namespace": pathNS})
	}

	tests := []struct {
		name        string
		body        string
		pathNS      string
		expectedNS  string
		expectValid bool
	}{
		{"no eval-context namespace forwards path namespace", `{"context":{}}`, "stacks-1", "stacks-1", true},
		{"matching eval-context namespace is valid", `{"context":{"namespace":"stacks-1"}}`, "stacks-1", "stacks-1", true},
		{"conflicting eval-context namespace is rejected", `{"context":{"namespace":"stacks-99"}}`, "stacks-1", "stacks-1", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := newReq(tt.body, tt.pathNS)
			evalCtx, err := b.readEvalContext(httptest.NewRecorder(), req)
			require.NoError(t, err)

			ns, valid := b.validateNamespace(req, evalCtx)
			assert.Equal(t, tt.expectValid, valid)
			assert.Equal(t, tt.expectedNS, ns)
		})
	}
}

// TestAllFlagsHandler_UnauthForwardsPathNamespace verifies the resolved path namespace
// reaches the upstream provider as a namespace-scoped User-Agent.
func TestAllFlagsHandler_UnauthForwardsPathNamespace(t *testing.T) {
	var gotUserAgent string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotUserAgent = r.Header.Get("User-Agent")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(goffmodel.OFREPBulkEvaluateSuccessResponse{})
	}))
	t.Cleanup(srv.Close)
	b := newTestBuilder(t, srv.URL)

	w := httptest.NewRecorder()
	r := newUnauthReq("/apis/features.grafana.app/v0alpha1/namespaces/stacks-7/ofrep/v1/evaluate/flags", map[string]string{"namespace": "stacks-7"})
	b.allFlagsHandler(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "features-grafana-app/stacks-7", gotUserAgent)
}

func TestOneFlagHandler_MissingFlagKey(t *testing.T) {
	b := &APIBuilder{
		providerType: setting.OFREPProviderType,
		logger:       log.NewNopLogger(),
	}

	req := httptest.NewRequest(http.MethodPost, "/ofrep/v1/evaluate/flags/", bytes.NewBufferString(`{}`))
	// No flagKey in mux.Vars
	w := httptest.NewRecorder()
	b.oneFlagHandler(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestOneFlagHandler_Unauth(t *testing.T) {
	tests := []struct {
		name       string
		metadata   map[string]any
		wantStatus int
	}{
		{"public flag returns 200", map[string]any{"public": true}, http.StatusOK},
		{"private flag returns 404, indistinguishable from a genuinely missing flag", nil, http.StatusNotFound},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := newSingleEvalBuilder(t, tt.metadata)
			w := httptest.NewRecorder()
			r := newUnauthReq("/ofrep/v1/evaluate/flags/brandnewflag", map[string]string{"flagKey": "brandnewflag", "namespace": ""})
			b.oneFlagHandler(w, r)
			assert.Equal(t, tt.wantStatus, w.Code)
		})
	}
}

func TestAllFlagsHandler_Unauth(t *testing.T) {
	upstreamFlags := []goffmodel.OFREPFlagBulkEvaluateSuccessResponse{
		{OFREPEvaluateSuccessResponse: goffmodel.OFREPEvaluateSuccessResponse{Key: "publicFlag", Metadata: map[string]any{"public": true}}},
		{OFREPEvaluateSuccessResponse: goffmodel.OFREPEvaluateSuccessResponse{Key: "privateFlag", Metadata: map[string]any{"public": false}}},
	}

	b := newBulkEvalBuilder(t, upstreamFlags, http.StatusOK)
	w := httptest.NewRecorder()
	r := newUnauthReq("/ofrep/v1/evaluate/flags", map[string]string{"namespace": ""})
	b.allFlagsHandler(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	var result goffmodel.OFREPBulkEvaluateSuccessResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &result))
	assert.Equal(t, []string{"publicFlag"}, flagKeys(result.Flags))
}

func TestAllFlagsHandler_NamespaceMismatch(t *testing.T) {
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
	b.allFlagsHandler(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAllFlagsHandler_NoNamespaceInBody(t *testing.T) {
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
	b.allFlagsHandler(w, req)
	// Validation passes (no namespace to mismatch), but proxy fails with 500 (nil URL)
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestOneFlagHandler_NamespaceMismatch(t *testing.T) {
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
	b.oneFlagHandler(w, req)
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
	inner := func(w http.ResponseWriter, r *http.Request) {
		gotIsAuthed = b.isAuthenticatedRequest(r)
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
	inner := func(w http.ResponseWriter, r *http.Request) {
		gotIsAuthed = b.isAuthenticatedRequest(r)
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
