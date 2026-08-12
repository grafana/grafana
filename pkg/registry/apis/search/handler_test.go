package search

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type fakeIndexClient struct {
	resourcepb.ResourceIndexClient
	got  *resourcepb.ResourceSearchRequest
	resp *resourcepb.ResourceSearchResponse
	err  error
}

func (f *fakeIndexClient) Search(_ context.Context, in *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	f.got = in
	return f.resp, f.err
}

func doRequest(t *testing.T, h *Handler, body string) *httptest.ResponseRecorder {
	t.Helper()
	r := httptest.NewRequest(http.MethodPost, "/search", strings.NewReader(body))
	ctx := identity.WithRequester(r.Context(), &identity.StaticRequester{Namespace: "default"})
	ctx = request.WithNamespace(ctx, "default")
	w := httptest.NewRecorder()
	h.SearchFor(testKind)(w, r.WithContext(ctx))
	return w
}

func emptyResponse() *resourcepb.ResourceSearchResponse {
	return &resourcepb.ResourceSearchResponse{
		Results:        &resourcepb.ResourceTable{},
		TotalHits:      0,
		TotalHitsExact: true,
	}
}

func TestHandler_TranslatesAndReturnsEnvelope(t *testing.T) {
	client := &fakeIndexClient{resp: emptyResponse()}
	h := NewHandler(client, testProvider(), noop.NewTracerProvider().Tracer(""))

	w := doRequest(t, h, `{
		"apiVersion": "`+searchv0.APIVERSION+`",
		"kind": "`+searchv0.KindSearchQuery+`",
		"where": {"filter": {"field": "panel_type", "operator": "In", "values": ["timeseries"]}},
		"limit": 25
	}`)

	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	// The backend request is scoped to the caller's namespace and kind.
	require.NotNil(t, client.got)
	assert.Equal(t, "default", client.got.Options.Key.Namespace)
	assert.Equal(t, testKind.group, client.got.Options.Key.Group)
	assert.Equal(t, testKind.resource, client.got.Options.Key.Resource)
	assert.Equal(t, int64(25), client.got.Limit)

	var out searchv0.SearchResults
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &out))
	assert.Equal(t, searchv0.KindSearchResults, out.Kind)
	assert.Equal(t, searchv0.TotalHitsEqual, out.Metadata.TotalHitsRelation)
}

func TestHandler_RejectsInvalidBody(t *testing.T) {
	h := NewHandler(&fakeIndexClient{resp: emptyResponse()}, testProvider(), noop.NewTracerProvider().Tracer(""))

	valid := `{"apiVersion":"` + searchv0.APIVERSION + `","kind":"` + searchv0.KindSearchQuery + `"}`
	for name, body := range map[string]string{
		"malformed json": `{`,
		"empty body":     ``,
		"unknown field":  `{"apiVersion":"` + searchv0.APIVERSION + `","kind":"` + searchv0.KindSearchQuery + `","nope":1}`,
		// Only the first value would be acted on, so a body carrying more than
		// one is not the request the caller thinks they sent.
		"trailing object":  valid + `{"kind":"other"}`,
		"trailing garbage": valid + ` nonsense`,
	} {
		t.Run(name, func(t *testing.T) {
			w := doRequest(t, h, body)
			assert.Equal(t, http.StatusBadRequest, w.Code, w.Body.String())
		})
	}
}

func TestHandler_RejectsUndeclaredField(t *testing.T) {
	client := &fakeIndexClient{resp: emptyResponse()}
	h := NewHandler(client, testProvider(), noop.NewTracerProvider().Tracer(""))

	w := doRequest(t, h, `{
		"apiVersion": "`+searchv0.APIVERSION+`",
		"kind": "`+searchv0.KindSearchQuery+`",
		"where": {"filter": {"field": "not_declared", "operator": "In", "values": ["x"]}}
	}`)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code, w.Body.String())
	// A rejected request must never reach the backend.
	assert.Nil(t, client.got)

	var status metav1.Status
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &status))
	assert.Contains(t, w.Body.String(), "not_declared")
}

func TestHandler_RejectsWrongEnvelopeKind(t *testing.T) {
	client := &fakeIndexClient{resp: emptyResponse()}
	h := NewHandler(client, testProvider(), noop.NewTracerProvider().Tracer(""))

	w := doRequest(t, h, `{
		"apiVersion": "`+searchv0.APIVERSION+`",
		"kind": "`+searchv0.KindTrashQuery+`"
	}`)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code, w.Body.String())
	assert.Nil(t, client.got)
}

func TestHandler_PropagatesBackendErrorResult(t *testing.T) {
	client := &fakeIndexClient{resp: &resourcepb.ResourceSearchResponse{
		Error: &resourcepb.ErrorResult{Code: http.StatusServiceUnavailable, Message: "index is not ready"},
	}}
	h := NewHandler(client, testProvider(), noop.NewTracerProvider().Tracer(""))

	w := doRequest(t, h, `{
		"apiVersion": "`+searchv0.APIVERSION+`",
		"kind": "`+searchv0.KindSearchQuery+`"
	}`)

	assert.Equal(t, http.StatusServiceUnavailable, w.Code, w.Body.String())
}

// searchAs runs a search whose caller is scoped to callerNS against the
// namespace in the path.
func searchAs(t *testing.T, h *Handler, callerNS, pathNS string) *httptest.ResponseRecorder {
	t.Helper()
	r := httptest.NewRequest(http.MethodPost, "/search", strings.NewReader(`{
		"apiVersion": "`+searchv0.APIVERSION+`",
		"kind": "`+searchv0.KindSearchQuery+`"
	}`))
	ctx := identity.WithRequester(r.Context(), &identity.StaticRequester{Namespace: callerNS})
	if pathNS != "" {
		ctx = request.WithNamespace(ctx, pathNS)
	}
	w := httptest.NewRecorder()
	h.SearchFor(testKind)(w, r.WithContext(ctx))
	return w
}

func TestHandler_SearchesTheNamespaceFromThePath(t *testing.T) {
	// Whether the caller may reach the namespace is settled by the apiserver
	// authorization chain before the handler runs, so the handler searches what
	// the path asks for. A caller scoped to "*", such as a service identity,
	// reaches a concrete namespace the same way.
	for name, callerNS := range map[string]string{
		"caller scoped to the namespace":   "tenant-b",
		"caller scoped to every namespace": "*",
	} {
		t.Run(name, func(t *testing.T) {
			client := &fakeIndexClient{resp: emptyResponse()}
			h := NewHandler(client, testProvider(), noop.NewTracerProvider().Tracer(""))

			w := searchAs(t, h, callerNS, "tenant-b")

			require.Equal(t, http.StatusOK, w.Code, w.Body.String())
			require.NotNil(t, client.got)
			assert.Equal(t, "tenant-b", client.got.Options.Key.Namespace)
		})
	}
}

func TestHandler_RejectsWildcardNamespace(t *testing.T) {
	client := &fakeIndexClient{resp: emptyResponse()}
	h := NewHandler(client, testProvider(), noop.NewTracerProvider().Tracer(""))

	// Searching every namespace at once is not supported, so "*" must be turned
	// away rather than reaching the backend as a namespace of that name. A caller
	// scoped to "*" is allowed to exist; it just has to name a namespace.
	w := searchAs(t, h, "*", "*")

	assert.Equal(t, http.StatusBadRequest, w.Code, w.Body.String())
	assert.Nil(t, client.got)
}

func TestHandler_RequiresNamespace(t *testing.T) {
	client := &fakeIndexClient{resp: emptyResponse()}
	h := NewHandler(client, testProvider(), noop.NewTracerProvider().Tracer(""))

	// Without a namespace there is nothing to scope the search to, and for a
	// caller scoped to "*" falling back to its own namespace would mean
	// searching the literal namespace "*".
	w := searchAs(t, h, "*", "")

	assert.Equal(t, http.StatusBadRequest, w.Code, w.Body.String())
	assert.Nil(t, client.got)
}
