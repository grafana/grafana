package app

import (
	"net/http"
	"net/http/httptest"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

type fakeProvider struct {
	called    bool
	namespace string
}

func (f *fakeProvider) ServeWS(w http.ResponseWriter, _ *http.Request, namespace string) {
	f.called = true
	f.namespace = namespace
	w.WriteHeader(http.StatusSwitchingProtocols)
}

func TestWebsocketHandler(t *testing.T) {
	user := &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "u1", Namespace: "stacks-1"}

	tests := []struct {
		name       string
		user       identity.Requester
		namespace  string
		wantStatus int
		wantCalled bool
	}{
		{name: "own namespace", user: user, namespace: "stacks-1", wantStatus: http.StatusSwitchingProtocols, wantCalled: true},
		{name: "other namespace", user: user, namespace: "stacks-2", wantStatus: http.StatusForbidden},
		{name: "missing namespace", user: user, namespace: "", wantStatus: http.StatusForbidden},
		{name: "no requester", namespace: "stacks-1", wantStatus: http.StatusUnauthorized},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			provider := &fakeProvider{}
			req := httptest.NewRequest(http.MethodGet, "/ws", nil)
			if tt.user != nil {
				req = req.WithContext(identity.WithRequester(req.Context(), tt.user))
			}
			req.SetPathValue("namespace", tt.namespace)
			rec := httptest.NewRecorder()

			NewWebsocketHandler(provider).ServeHTTP(rec, req)

			require.Equal(t, tt.wantStatus, rec.Code)
			require.Equal(t, tt.wantCalled, provider.called)
			if tt.wantCalled {
				require.Equal(t, tt.namespace, provider.namespace)
			}
		})
	}
}
