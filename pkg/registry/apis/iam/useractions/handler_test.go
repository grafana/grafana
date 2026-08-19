package useractions

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

type fakeProvider struct {
	actions map[string]bool
	err     error
}

func (f *fakeProvider) ActionsForUser(_ context.Context, _ identity.Requester, _ Options) (map[string]bool, error) {
	return f.actions, f.err
}

func do(t *testing.T, handler *Handler, requester identity.Requester) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/apis/iam.grafana.app/v0alpha1/namespaces/default/userActions", nil)
	if requester != nil {
		req = req.WithContext(identity.WithRequester(req.Context(), requester))
	}
	rec := httptest.NewRecorder()
	handler.handle(rec, req)
	return rec
}

func TestHandler(t *testing.T) {
	requester := &user.SignedInUser{OrgID: 1, OrgRole: org.RoleEditor}

	t.Run("returns the provider's action map as json", func(t *testing.T) {
		handler := NewHandler(&fakeProvider{actions: map[string]bool{"dashboards:read": true}})
		rec := do(t, handler, requester)
		require.Equal(t, http.StatusOK, rec.Code)

		var actions map[string]bool
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &actions))
		require.Equal(t, map[string]bool{"dashboards:read": true}, actions)
	})

	t.Run("empty action set encodes as an empty object", func(t *testing.T) {
		handler := NewHandler(&fakeProvider{actions: map[string]bool{}})
		rec := do(t, handler, requester)
		require.Equal(t, http.StatusOK, rec.Code)
		require.JSONEq(t, "{}", rec.Body.String())
	})

	t.Run("missing identity is unauthorized", func(t *testing.T) {
		handler := NewHandler(&fakeProvider{actions: map[string]bool{}})
		rec := do(t, handler, nil)
		require.Equal(t, http.StatusUnauthorized, rec.Code)
	})
}
