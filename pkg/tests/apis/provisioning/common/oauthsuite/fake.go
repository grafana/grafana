package oauthsuite

import (
	"encoding/json"
	"fmt"
	"maps"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

const (
	FakeAuthorizationCode = "test-authorization-code"
	FakeShortLivedCode    = "short-lived-code"
	FakeClientSecret      = "test-client-secret"
)

type FakeTokens struct {
	mu     sync.Mutex
	issued map[string]int
}

func NewFakeTokens() *FakeTokens {
	return &FakeTokens{issued: map[string]int{}}
}

func (f *FakeTokens) HandleToken(w http.ResponseWriter, r *http.Request) {
	clientID, secret, ok := r.BasicAuth()
	if !ok {
		clientID, secret = r.FormValue("client_id"), r.FormValue("client_secret")
	}
	if secret != FakeClientSecret {
		WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "invalid_client"})
		return
	}

	expiresIn := 7200
	switch r.FormValue("grant_type") {
	case "authorization_code":
		if r.FormValue("code") == FakeShortLivedCode {
			expiresIn = 30
		}
	case "refresh_token":
	default:
		WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "unsupported_grant_type"})
		return
	}

	f.mu.Lock()
	f.issued[clientID]++
	n := f.issued[clientID]
	f.mu.Unlock()
	WriteJSON(w, http.StatusOK, map[string]any{
		"access_token":  fmt.Sprintf("%s-%d", clientID, n),
		"refresh_token": fmt.Sprintf("%s-refresh-%d", clientID, n),
		"token_type":    "bearer",
		"expires_in":    expiresIn,
	})
}

func (f *FakeTokens) Authorized(r *http.Request) bool {
	token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
	if !ok {
		return false
	}
	i := strings.LastIndex(token, "-")
	if i < 0 {
		return false
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	return fmt.Sprintf("%s-%d", token[:i], f.issued[token[:i]]) == token
}

func ServeRecorded(r *http.Request, handler http.HandlerFunc) *http.Response {
	rec := httptest.NewRecorder()
	handler(rec, r)
	resp := rec.Result()
	resp.Request = r
	return resp
}

func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

type FakeProvider struct {
	ProviderName string
	Type         provisioning.ConnectionType
	Spec         map[string]any
	Repos        []provisioning.ExternalRepository
}

func (p *FakeProvider) Name() string { return p.ProviderName }

func (p *FakeProvider) NewConnection(_ *testing.T, name string) *unstructured.Unstructured {
	spec := map[string]any{
		"title": name,
		"type":  string(p.Type),
		"oauth": map[string]any{"clientID": name + "-client"},
	}
	maps.Copy(spec, p.Spec)
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": provisioning.APIVERSION,
		"kind":       "Connection",
		"metadata":   map[string]any{"name": name, "namespace": "default"},
		"spec":       spec,
		"secure": map[string]any{
			"clientSecret": map[string]any{"create": FakeClientSecret},
		},
	}}
}

func (p *FakeProvider) AuthorizationCode(*testing.T, string) string { return FakeAuthorizationCode }

func (p *FakeProvider) ShortLivedAuthorizationCode(*testing.T, string) string {
	return FakeShortLivedCode
}

func (p *FakeProvider) Repositories() []provisioning.ExternalRepository { return p.Repos }
