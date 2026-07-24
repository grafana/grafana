package display

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	iam "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
)

type fakeResolver struct {
	gotKeys []string
	result  *iam.DisplayList
	err     error
}

func (f *fakeResolver) GetDisplayList(_ context.Context, _ authlib.NamespaceInfo, keys []string) (*iam.DisplayList, error) {
	f.gotKeys = keys
	if f.err != nil {
		return nil, f.err
	}
	return f.result, nil
}

func selfRequest(t *testing.T, auth authlib.AuthInfo) *http.Request {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/apis/iam.grafana.app/v0alpha1/namespaces/default/users/~", nil)
	if auth != nil {
		req = req.WithContext(authlib.WithAuthInfo(req.Context(), auth))
	}
	return req
}

func TestDisplayHandler_handleSelf(t *testing.T) {
	caller := &identity.StaticRequester{
		Type:      authlib.TypeUser,
		UserUID:   "u1",
		UserID:    1,
		OrgID:     1,
		Namespace: "default",
	}

	t.Run("missing auth info returns 401", func(t *testing.T) {
		h := NewDisplayHandler(&fakeResolver{})
		rec := httptest.NewRecorder()

		h.handleSelf(rec, selfRequest(t, nil))

		require.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	t.Run("caller display is resolved from context and returned", func(t *testing.T) {
		want := iam.Display{
			Identity:    iam.IdentityRef{Type: authlib.TypeUser, Name: "u1"},
			DisplayName: "Alice",
			InternalID:  1,
		}
		resolver := &fakeResolver{result: &iam.DisplayList{Items: []iam.Display{want}}}
		h := NewDisplayHandler(resolver)
		rec := httptest.NewRecorder()

		h.handleSelf(rec, selfRequest(t, caller))

		require.Equal(t, http.StatusOK, rec.Code)
		// The caller identifies itself purely from context, no query input.
		require.Equal(t, []string{"user:u1"}, resolver.gotKeys)

		var got iam.Display
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
		require.Equal(t, want, got)
	})

	t.Run("unresolved caller returns 404", func(t *testing.T) {
		resolver := &fakeResolver{result: &iam.DisplayList{}}
		h := NewDisplayHandler(resolver)
		rec := httptest.NewRecorder()

		h.handleSelf(rec, selfRequest(t, caller))

		require.Equal(t, http.StatusNotFound, rec.Code)
	})

	t.Run("resolver error returns 500", func(t *testing.T) {
		resolver := &fakeResolver{err: errors.New("boom")}
		h := NewDisplayHandler(resolver)
		rec := httptest.NewRecorder()

		h.handleSelf(rec, selfRequest(t, caller))

		require.Equal(t, http.StatusInternalServerError, rec.Code)
	})
}
