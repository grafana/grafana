package display

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	iam "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
)

type stubResolver struct {
	result *iam.DisplayList
}

func (s stubResolver) GetDisplayList(_ context.Context, _ authlib.NamespaceInfo, _ []string) (*iam.DisplayList, error) {
	return s.result, nil
}

func TestHandleDisplay_emptyResultSerializesAsArray(t *testing.T) {
	// Regression test for #128232: when no identity resolves, the "display"
	// field must serialize as an empty array ([]) rather than null, so clients
	// can always iterate over it.
	handler := NewDisplayHandler(stubResolver{
		result: &iam.DisplayList{Keys: []string{"access-policy:provisioning"}},
	})

	req := httptest.NewRequest(http.MethodGet, "/display?key=access-policy:provisioning", nil)
	req = req.WithContext(identity.WithRequester(req.Context(), &identity.StaticRequester{
		Type:      authlib.TypeUser,
		UserUID:   "u1",
		Namespace: "default",
	}))
	rec := httptest.NewRecorder()

	handler.handleDisplay(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	var raw map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &raw))
	require.JSONEq(t, "[]", string(raw["display"]))
}
