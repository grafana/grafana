package search

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type fakeIndexClient struct {
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
	assert.Equal(t, resourcepb.ResourceSearchRequest_FIELD_VALUES, client.got.ResultFormat)

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
	result := &resourcepb.ErrorResult{
		Code: http.StatusUnprocessableEntity, Reason: string(metav1.StatusReasonInvalid), Message: "invalid search field",
		Details: &resourcepb.ErrorDetails{
			Group: searchv0.GROUP, Kind: searchv0.KindSearchQuery, Name: "query", Uid: "query-uid",
			Causes: []*resourcepb.ErrorCause{{Reason: "FieldValueInvalid", Field: "where", Message: "invalid filter"}},
		},
	}
	grpcStatus, err := status.New(codes.Unknown, "transport message").WithDetails(result)
	require.NoError(t, err)
	want := resource.StatusError(result).(*apierrors.StatusError).Status()
	for name, client := range map[string]*fakeIndexClient{
		"payload":      {resp: &resourcepb.ResourceSearchResponse{Error: result}},
		"grpc details": {err: grpcStatus.Err()},
	} {
		t.Run(name, func(t *testing.T) {
			h := NewHandler(client, testProvider(), noop.NewTracerProvider().Tracer(""))
			for route, call := range map[string]func() *httptest.ResponseRecorder{
				"search": func() *httptest.ResponseRecorder { return doRequest(t, h, globalQuery("")) },
				"global": func() *httptest.ResponseRecorder { return doGlobalRequest(t, h, globalQuery("")) },
				"trash":  func() *httptest.ResponseRecorder { return doTrashRequest(t, h, trashBody("")) },
			} {
				t.Run(route, func(t *testing.T) {
					w := call()
					require.NotNil(t, client.got)
					require.Equal(t, int(result.Code), w.Code, w.Body.String())
					var got metav1.Status
					require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
					assert.Equal(t, want, got)
				})
			}
		})
	}
}

func TestHandler_TransportErrors(t *testing.T) {
	for _, tc := range []struct {
		name string
		err  error
		code int
	}{
		{name: "ordinary error", err: errors.New("private connection failure"), code: http.StatusInternalServerError},
		{name: "grpc unavailable", err: status.Error(codes.Unavailable, "private connection failure"), code: http.StatusServiceUnavailable},
	} {
		t.Run(tc.name, func(t *testing.T) {
			h := NewHandler(&fakeIndexClient{err: tc.err}, testProvider(), noop.NewTracerProvider().Tracer(""))
			w := doRequest(t, h, globalQuery(""))
			assert.Equal(t, tc.code, w.Code, w.Body.String())
			assert.NotContains(t, w.Body.String(), "private connection failure")
		})
	}
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

var globalKinds = map[schema.GroupResource]string{
	{Group: "dashboard.grafana.app", Resource: "dashboards"}: "Dashboard",
	{Group: "folder.grafana.app", Resource: "folders"}:       "Folder",
}

func doGlobalRequest(t *testing.T, h *Handler, body string) *httptest.ResponseRecorder {
	t.Helper()
	r := httptest.NewRequest(http.MethodPost, "/global/search", strings.NewReader(body))
	ctx := identity.WithRequester(r.Context(), &identity.StaticRequester{Namespace: "default"})
	ctx = request.WithNamespace(ctx, "default")
	w := httptest.NewRecorder()
	h.GlobalSearchFor(globalKinds)(w, r.WithContext(ctx))
	return w
}

func globalQuery(where string) string {
	body := `{"apiVersion": "` + searchv0.APIVERSION + `", "kind": "` + searchv0.KindSearchQuery + `", "limit": 10`
	if where != "" {
		body += `, "where": ` + where
	}
	return body + `}`
}

func TestGlobalHandler_ReadsTheNamespaceWideIndex(t *testing.T) {
	client := &fakeIndexClient{resp: emptyResponse()}
	h := NewHandler(client, testProvider(), noop.NewTracerProvider().Tracer(""))

	w := doGlobalRequest(t, h, globalQuery(""))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	require.NotNil(t, client.got)
	assert.Equal(t, "default", client.got.Options.Key.Namespace)
	// The reserved pair names the index to read, not a stored resource.
	assert.Equal(t, resource.GlobalSearchGroup, client.got.Options.Key.Group)
	assert.Equal(t, resource.GlobalSearchResource, client.got.Options.Key.Resource)
}

func TestGlobalHandler_FiltersByResourceType(t *testing.T) {
	client := &fakeIndexClient{resp: emptyResponse()}
	h := NewHandler(client, testProvider(), noop.NewTracerProvider().Tracer(""))

	w := doGlobalRequest(t, h, globalQuery(
		`{"filter": {"field": "`+resource.SEARCH_FIELD_GROUP_RESOURCE+`", "operator": "In", "values": ["folder.grafana.app/folders"]}}`))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	require.Len(t, client.got.Options.Fields, 1)
	assert.Equal(t, resource.SEARCH_FIELD_GROUP_RESOURCE, client.got.Options.Fields[0].Key)
	assert.Equal(t, []string{"folder.grafana.app/folders"}, client.got.Options.Fields[0].Values)
}

// Sorting by time is offered on this index and nowhere else, so a request that
// only makes sense here is accepted here.
func TestGlobalHandler_SortsByTime(t *testing.T) {
	client := &fakeIndexClient{resp: emptyResponse()}
	h := NewHandler(client, testProvider(), noop.NewTracerProvider().Tracer(""))

	w := doGlobalRequest(t, h, `{
		"apiVersion": "`+searchv0.APIVERSION+`",
		"kind": "`+searchv0.KindSearchQuery+`",
		"sort": [{"field": "`+resource.SEARCH_FIELD_UPDATED+`", "direction": "desc"}],
		"limit": 10
	}`)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	require.Len(t, client.got.SortBy, 1)
	assert.Equal(t, resource.SEARCH_FIELD_UPDATED, client.got.SortBy[0].Field)
	assert.True(t, client.got.SortBy[0].Desc)
}

func TestGlobalHandler_RejectsAKindsOwnField(t *testing.T) {
	client := &fakeIndexClient{resp: emptyResponse()}
	h := NewHandler(client, testProvider(), noop.NewTracerProvider().Tracer(""))

	// panel_type belongs to dashboards. This index holds only the fields every
	// resource has, so naming it is a bad request rather than an empty result.
	w := doGlobalRequest(t, h, globalQuery(
		`{"filter": {"field": "panel_type", "operator": "In", "values": ["timeseries"]}}`))
	assert.Equal(t, http.StatusUnprocessableEntity, w.Code, w.Body.String())
	assert.Contains(t, w.Body.String(), "unknown field")
	assert.Nil(t, client.got)
}

func TestGlobalHandler_EachResultNamesItsOwnType(t *testing.T) {
	client := &fakeIndexClient{resp: &resourcepb.ResourceSearchResponse{
		Results: &resourcepb.ResourceTable{
			Columns: []*resourcepb.ResourceTableColumnDefinition{
				{Name: resource.SEARCH_FIELD_TITLE, Type: resourcepb.ResourceTableColumnDefinition_STRING},
			},
			Rows: []*resourcepb.ResourceTableRow{
				{
					Key:   &resourcepb.ResourceKey{Namespace: "default", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dash-a"},
					Cells: [][]byte{[]byte("A dashboard")},
				},
				{
					Key:   &resourcepb.ResourceKey{Namespace: "default", Group: "folder.grafana.app", Resource: "folders", Name: "folder-a"},
					Cells: [][]byte{[]byte("A folder")},
				},
				{
					Key:   &resourcepb.ResourceKey{Namespace: "default", Group: "other.grafana.app", Resource: "others", Name: "other-a"},
					Cells: [][]byte{[]byte("Something else")},
				},
			},
		},
		TotalHits:      3,
		TotalHitsExact: true,
	}}
	h := NewHandler(client, testProvider(), noop.NewTracerProvider().Tracer(""))

	w := doGlobalRequest(t, h, globalQuery(""))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	var out searchv0.SearchResults
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &out))
	require.Len(t, out.Items, 3)

	assert.Equal(t, searchv0.ResourceRef{Group: "dashboard.grafana.app", Resource: "dashboards", Kind: "Dashboard", Name: "dash-a"}, out.Items[0].Resource)
	assert.Equal(t, searchv0.ResourceRef{Group: "folder.grafana.app", Resource: "folders", Kind: "Folder", Name: "folder-a"}, out.Items[1].Resource)
	// A type the route was not told about keeps its group and resource, which
	// already identify it, and reports no kind rather than another type's.
	assert.Equal(t, searchv0.ResourceRef{Group: "other.grafana.app", Resource: "others", Kind: "", Name: "other-a"}, out.Items[2].Resource)
}
