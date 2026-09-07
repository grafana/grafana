package search

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func doTrashRequest(t *testing.T, h *Handler, body string) *httptest.ResponseRecorder {
	t.Helper()
	r := httptest.NewRequest(http.MethodPost, "/trash", strings.NewReader(body))
	ctx := identity.WithRequester(r.Context(), &identity.StaticRequester{Namespace: "default"})
	ctx = request.WithNamespace(ctx, "default")
	w := httptest.NewRecorder()
	h.TrashFor(testKind)(w, r.WithContext(ctx))
	return w
}

func trashBody(inner string) string {
	return `{
		"apiVersion": "` + searchv0.APIVERSION + `",
		"kind": "` + searchv0.KindTrashQuery + `"` + inner + `
	}`
}

func TestTrashHandler_RequestsDeletedResources(t *testing.T) {
	client := &fakeIndexClient{resp: emptyResponse()}
	h := NewHandler(client, testProvider(), noop.NewTracerProvider().Tracer(""))

	w := doTrashRequest(t, h, trashBody(`, "limit": 25`))

	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	require.NotNil(t, client.got)
	assert.True(t, client.got.IsDeleted, "the backend must be told to search trash")
	assert.Equal(t, "default", client.got.Options.Key.Namespace)
	assert.Equal(t, testKind.group, client.got.Options.Key.Group)
	assert.Equal(t, testKind.resource, client.got.Options.Key.Resource)
	assert.Equal(t, int64(25), client.got.Limit)

	// Federating trash is refused by the backend, so the endpoint must not ask.
	assert.Empty(t, client.got.Federated)

	var out searchv0.TrashResults
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &out))
	assert.Equal(t, searchv0.KindTrashResults, out.Kind)
	assert.Equal(t, searchv0.APIVERSION, out.APIVersion)
}

// So the default view reads as "most recently deleted first".
func TestTrashHandler_DefaultsToNewestDeletionFirst(t *testing.T) {
	client := &fakeIndexClient{resp: emptyResponse()}
	h := NewHandler(client, testProvider(), noop.NewTracerProvider().Tracer(""))

	w := doTrashRequest(t, h, trashBody(``))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	require.Len(t, client.got.SortBy, 1)
	assert.Equal(t, resource.SEARCH_FIELD_DELETION_TIME, client.got.SortBy[0].Field)
	assert.True(t, client.got.SortBy[0].Desc)
}

// deleted_rv identifies the version to restore, so a narrower field list must not
// drop it.
func TestTrashHandler_AlwaysReturnsTheDeletedResourceVersion(t *testing.T) {
	client := &fakeIndexClient{resp: emptyResponse()}
	h := NewHandler(client, testProvider(), noop.NewTracerProvider().Tracer(""))

	w := doTrashRequest(t, h, trashBody(`, "fields": ["title"]`))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	assert.Contains(t, client.got.Fields, resource.SEARCH_FIELD_DELETED_RV)
}

func TestTrashHandler_RejectsBadRequests(t *testing.T) {
	cases := []struct {
		name string
		body string
	}{
		{"wrong envelope kind", `{"apiVersion": "` + searchv0.APIVERSION + `", "kind": "` + searchv0.KindSearchQuery + `"}`},
		{"malformed json", `{"kind": `},
		{"empty body", ``},
		{"unknown top-level field", trashBody(`, "labelSelector": {}`)},
		{"field outside the trash set", trashBody(`, "fields": ["panel_type"]`)},
		{"sort on a field outside the trash set", trashBody(`, "sort": [{"field": "panel_type"}]`)},
		{"negative limit", trashBody(`, "limit": -1`)},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			client := &fakeIndexClient{resp: emptyResponse()}
			h := NewHandler(client, testProvider(), noop.NewTracerProvider().Tracer(""))

			w := doTrashRequest(t, h, tc.body)

			assert.GreaterOrEqual(t, w.Code, 400, w.Body.String())
			assert.Less(t, w.Code, 500, w.Body.String())
			assert.Nil(t, client.got, "a rejected request must not reach the backend")
		})
	}
}

// The backend reports failures in the payload, so a nil transport error is not enough.
func TestTrashHandler_PropagatesBackendErrorResult(t *testing.T) {
	client := &fakeIndexClient{resp: &resourcepb.ResourceSearchResponse{
		Error: &resourcepb.ErrorResult{Code: http.StatusBadRequest, Message: "nope"},
	}}
	h := NewHandler(client, testProvider(), noop.NewTracerProvider().Tracer(""))

	w := doTrashRequest(t, h, trashBody(``))

	assert.Equal(t, http.StatusBadRequest, w.Code, w.Body.String())
}

func TestTrashHandler_RequiresARealNamespace(t *testing.T) {
	for _, tc := range []struct {
		name      string
		namespace string
	}{
		{"missing", ""},
		{"wildcard", wildcardNamespace},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client := &fakeIndexClient{resp: emptyResponse()}
			h := NewHandler(client, testProvider(), noop.NewTracerProvider().Tracer(""))

			r := httptest.NewRequest(http.MethodPost, "/trash", strings.NewReader(trashBody(``)))
			ctx := identity.WithRequester(r.Context(), &identity.StaticRequester{Namespace: "default"})
			if tc.namespace != "" {
				ctx = request.WithNamespace(ctx, tc.namespace)
			}
			w := httptest.NewRecorder()
			h.TrashFor(testKind)(w, r.WithContext(ctx))

			assert.Equal(t, http.StatusBadRequest, w.Code, w.Body.String())
			assert.Nil(t, client.got)
		})
	}
}
