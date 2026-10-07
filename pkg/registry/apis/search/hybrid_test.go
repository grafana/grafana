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
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type fakeHybridIndexClient struct {
	request  *resourcepb.HybridSearchRequest
	response *resourcepb.HybridSearchResponse
	err      error
}

func (f *fakeHybridIndexClient) HybridSearch(_ context.Context, in *resourcepb.HybridSearchRequest, _ ...grpc.CallOption) (*resourcepb.HybridSearchResponse, error) {
	f.request = in
	return f.response, f.err
}

func hybridQuery() *searchv0.HybridSearchQuery {
	return &searchv0.HybridSearchQuery{
		APIVersion: searchv0.APIVERSION, Kind: searchv0.KindHybridSearchQuery,
		Query: "cpu",
	}
}

func hybridBody(t *testing.T, q *searchv0.HybridSearchQuery) string {
	t.Helper()
	body, err := json.Marshal(q)
	require.NoError(t, err)
	return string(body)
}

func doHybridRequest(handler http.HandlerFunc, body, namespace, callerNamespace string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(http.MethodPost, "/search/hybrid", strings.NewReader(body))
	ctx := identity.WithRequester(r.Context(), &identity.StaticRequester{Namespace: callerNamespace})
	if namespace != "" {
		ctx = request.WithNamespace(ctx, namespace)
	}
	w := httptest.NewRecorder()
	handler(w, r.WithContext(ctx))
	return w
}

func TestHybridSearchHandler(t *testing.T) {
	client := &fakeHybridIndexClient{response: &resourcepb.HybridSearchResponse{Results: []*resourcepb.HybridSearchResult{
		{
			Key:   &resourcepb.ResourceKey{Namespace: "tenant-b", Group: testKind.group, Resource: testKind.resource, Name: "z"},
			Score: 0.9, Title: "CPU", Folder: "f1", FolderTitle: "Operations", ManagedByKind: "repo", ManagedById: "repository",
			Chunks: []*resourcepb.HybridSearchChunk{
				{Subresource: "panel/7", Content: "CPU by host", Metadata: []byte(`{"language":"promql"}`)},
				{Subresource: "panel/9", Content: "CPU total"},
			},
		},
		{Key: &resourcepb.ResourceKey{Namespace: "tenant-b", Group: testKind.group, Resource: testKind.resource, Name: "a"}},
	}}}
	h := NewHybridHandler(client, noop.NewTracerProvider().Tracer(""))
	q := hybridQuery()
	q.Query = "cpu*"
	q.SemanticQuery = "CPU usage for host *"
	q.Limit = 12
	q.MinRelevance = "low"
	q.Filters = []searchv0.HybridSearchFilter{
		{Field: "uid", Values: []string{"z", "a"}},
		{Field: "folder", Values: []string{"f1"}},
		{Field: "datasource_uid", Values: []string{"prometheus"}},
		{Field: "language", Values: []string{"promql", "sql"}},
	}

	w := doHybridRequest(h.HybridSearchFor(testKind), hybridBody(t, q), "tenant-b", "tenant-a")
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	require.NotNil(t, client.request)
	assert.Equal(t, &resourcepb.ResourceKey{Namespace: "tenant-b", Group: testKind.group, Resource: testKind.resource}, client.request.Key)
	assert.Equal(t, q.Query, client.request.Query)
	assert.Equal(t, q.SemanticQuery, client.request.SemanticQuery)
	assert.Equal(t, int64(12), client.request.Limit)
	assert.Equal(t, "low", client.request.MinRelevance)
	assert.False(t, client.request.SkipRerank)
	assert.Equal(t, []*resourcepb.Requirement{
		{Key: "uid", Operator: "in", Values: []string{"z", "a"}},
		{Key: "folder", Operator: "in", Values: []string{"f1"}},
		{Key: "datasource_uid", Operator: "in", Values: []string{"prometheus"}},
		{Key: "language", Operator: "in", Values: []string{"promql", "sql"}},
	}, client.request.Filters)
	assert.JSONEq(t, `{
		"apiVersion":"search.grafana.app/v0alpha1", "kind":"HybridSearchResults",
		"items":[
			{"resource":{"group":"dashboard.grafana.app","resource":"dashboards","kind":"Dashboard","name":"z"},
			 "score":0.9,"title":"CPU","folder":"f1","folderTitle":"Operations",
			 "managedBy":{"kind":"repo","id":"repository"},
			 "chunks":[{"subresource":"panel/7","content":"CPU by host"},{"subresource":"panel/9","content":"CPU total"}]},
			{"resource":{"group":"dashboard.grafana.app","resource":"dashboards","kind":"Dashboard","name":"a"},"score":0,"title":"","folder":"","chunks":[]}
		]
	}`, w.Body.String())
}

func TestHybridSearchNamespace(t *testing.T) {
	folderKind := kindRef{group: "folder.grafana.app", version: "v1", resource: "folders", kind: "Folder"}
	for _, tc := range []struct {
		name, namespace, caller string
		wantStatus              int
	}{
		{"concrete namespace", "tenant-b", "tenant-b", http.StatusOK},
		{"wildcard identity", "tenant-b", "*", http.StatusOK},
		{"missing namespace", "", "tenant-b", http.StatusBadRequest},
		{"wildcard path", "*", "*", http.StatusBadRequest},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client := &fakeHybridIndexClient{response: &resourcepb.HybridSearchResponse{}}
			h := NewHybridHandler(client, noop.NewTracerProvider().Tracer(""))
			w := doHybridRequest(h.HybridSearchFor(folderKind), hybridBody(t, hybridQuery()), tc.namespace, tc.caller)
			require.Equal(t, tc.wantStatus, w.Code, w.Body.String())
			if tc.wantStatus != http.StatusOK {
				assert.Nil(t, client.request)
				return
			}
			assert.Equal(t, &resourcepb.ResourceKey{Namespace: "tenant-b", Group: folderKind.group, Resource: folderKind.resource}, client.request.Key)
			assert.JSONEq(t, `{"apiVersion":"search.grafana.app/v0alpha1","kind":"HybridSearchResults","items":[]}`, w.Body.String())
		})
	}
}

func TestHybridSearchRejectsInvalidBody(t *testing.T) {
	valid := hybridBody(t, hybridQuery())
	with := func(fields string) string { return strings.TrimSuffix(valid, "}") + "," + fields + "}" }
	for name, body := range map[string]string{
		"empty":             "",
		"malformed":         "{",
		"array":             "[]",
		"trailing object":   valid + `{}`,
		"trailing garbage":  valid + `invalid`,
		"unknown field":     with(`"namespace":"other"`),
		"pagination":        with(`"continue":"next"`),
		"sorting":           with(`"sort":[]`),
		"facets":            with(`"facets":[]`),
		"filter operator":   with(`"filters":[{"field":"uid","values":["a"],"operator":"NotIn"}]`),
		"wrong value type":  with(`"limit":"50"`),
		"oversized request": with(`"semanticQuery":"` + strings.Repeat("a", maxRequestBody) + `"`),
	} {
		t.Run(name, func(t *testing.T) {
			client := &fakeHybridIndexClient{}
			h := NewHybridHandler(client, noop.NewTracerProvider().Tracer(""))
			w := doHybridRequest(h.HybridSearchFor(testKind), body, "default", "default")
			assert.Equal(t, http.StatusBadRequest, w.Code, w.Body.String())
			assert.Nil(t, client.request)
		})
	}
}

func TestHybridSearchValidation(t *testing.T) {
	for _, tc := range []struct {
		name  string
		edit  func(*searchv0.HybridSearchQuery)
		field string
	}{
		{"missing envelope", func(q *searchv0.HybridSearchQuery) { q.TypeMeta = metav1.TypeMeta{} }, "apiVersion"},
		{"wrong version", func(q *searchv0.HybridSearchQuery) { q.APIVersion = "search.grafana.app/v9" }, "apiVersion"},
		{"wrong kind", func(q *searchv0.HybridSearchQuery) { q.Kind = searchv0.KindSearchQuery }, "kind"},
		{"missing query", func(q *searchv0.HybridSearchQuery) { q.Query = "" }, "query"},
		{"blank query", func(q *searchv0.HybridSearchQuery) { q.Query = " \t" }, "query"},
		{"query byte limit", func(q *searchv0.HybridSearchQuery) { q.Query = strings.Repeat("é", 501) }, "query"},
		{"semantic byte limit", func(q *searchv0.HybridSearchQuery) { q.SemanticQuery = strings.Repeat("é", 501) }, "semanticQuery"},
		{"blank semantic query", func(q *searchv0.HybridSearchQuery) { q.SemanticQuery = " \t" }, "semanticQuery"},
		{"negative limit", func(q *searchv0.HybridSearchQuery) { q.Limit = -1 }, "limit"},
		{"unknown relevance", func(q *searchv0.HybridSearchQuery) { q.MinRelevance = "med" }, "minRelevance"},
		{"threshold without reranking", func(q *searchv0.HybridSearchQuery) { q.MinRelevance, q.SkipRerank = "low", true }, "minRelevance"},
		{"undeclared filter", func(q *searchv0.HybridSearchQuery) {
			q.Filters = []searchv0.HybridSearchFilter{{Field: "panel_type", Values: []string{"timeseries"}}}
		}, "filters[0].field"},
		{"empty filter values", func(q *searchv0.HybridSearchQuery) {
			q.Filters = []searchv0.HybridSearchFilter{{Field: "uid"}}
		}, "filters[0].values"},
		{"wildcard uid filter", func(q *searchv0.HybridSearchQuery) {
			q.Filters = []searchv0.HybridSearchFilter{{Field: "uid", Values: []string{"*"}}}
		}, "filters[0].values[0]"},
		{"wildcard folder prefix", func(q *searchv0.HybridSearchQuery) {
			q.Filters = []searchv0.HybridSearchFilter{{Field: "folder", Values: []string{"prod-*"}}}
		}, "filters[0].values[0]"},
		{"wildcard within datasource value", func(q *searchv0.HybridSearchQuery) {
			q.Filters = []searchv0.HybridSearchFilter{
				{Field: "folder", Values: []string{"prod"}},
				{Field: "datasource_uid", Values: []string{"prom", "prom*prod"}},
			}
		}, "filters[1].values[1]"},
		{"duplicate filter", func(q *searchv0.HybridSearchQuery) {
			q.Filters = []searchv0.HybridSearchFilter{{Field: "uid", Values: []string{"a"}}, {Field: "uid", Values: []string{"b"}}}
		}, "filters[1].field"},
		{"unknown language", func(q *searchv0.HybridSearchQuery) {
			q.Filters = []searchv0.HybridSearchFilter{{Field: "language", Values: []string{"cypher"}}}
		}, "filters[0].values[0]"},
		{"combined filter value limit", func(q *searchv0.HybridSearchQuery) {
			q.Filters = []searchv0.HybridSearchFilter{{Field: "uid", Values: make([]string, 600)}, {Field: "folder", Values: make([]string, 401)}}
		}, "filters"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			q := hybridQuery()
			tc.edit(q)
			client := &fakeHybridIndexClient{}
			h := NewHybridHandler(client, noop.NewTracerProvider().Tracer(""))
			w := doHybridRequest(h.HybridSearchFor(testKind), hybridBody(t, q), "default", "default")
			assert.Equal(t, http.StatusUnprocessableEntity, w.Code, w.Body.String())
			var apiStatus metav1.Status
			require.NoError(t, json.Unmarshal(w.Body.Bytes(), &apiStatus))
			require.NotNil(t, apiStatus.Details)
			require.NotEmpty(t, apiStatus.Details.Causes)
			assert.Equal(t, tc.field, apiStatus.Details.Causes[0].Field)
			assert.Nil(t, client.request)
		})
	}
}

func TestTranslateHybridSearchOptions(t *testing.T) {
	for _, tc := range []struct {
		name      string
		limit     int64
		wantLimit int64
		skip      bool
	}{
		{"defaults", 0, 50, false},
		{"one result without reranking", 1, 1, true},
		{"capped limit", 201, 200, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			q := hybridQuery()
			q.Query, q.SemanticQuery = strings.Repeat("é", 500), strings.Repeat("a", 1000)
			q.Limit, q.SkipRerank = tc.limit, tc.skip
			q.Filters = []searchv0.HybridSearchFilter{{Field: "folder", Values: []string{"", "general"}}}
			req, errs := TranslateHybridSearchQuery(q, dashboardsGVR, "default")
			require.Empty(t, errs)
			require.NotNil(t, req)
			assert.Equal(t, tc.wantLimit, req.Limit)
			assert.Equal(t, tc.skip, req.SkipRerank)
			assert.Equal(t, []string{"", "general"}, req.Filters[0].Values)
		})
	}
	for _, relevance := range []string{"lowest", "low", "medium", "high", "highest"} {
		q := hybridQuery()
		q.MinRelevance = relevance
		req, errs := TranslateHybridSearchQuery(q, dashboardsGVR, "default")
		require.Empty(t, errs, relevance)
		assert.Equal(t, relevance, req.MinRelevance)
	}
}

func TestHybridSearchDashboardFiltersAreResourceScoped(t *testing.T) {
	for _, gvr := range []schema.GroupVersionResource{
		{Group: "folder.grafana.app", Version: "v1", Resource: "folders"},
		{Group: "other.grafana.app", Version: "v1", Resource: "dashboards"},
	} {
		t.Run(gvr.String(), func(t *testing.T) {
			q := hybridQuery()
			q.Filters = []searchv0.HybridSearchFilter{{Field: "uid", Values: []string{"a"}}, {Field: "folder", Values: []string{"general"}}}
			_, errs := TranslateHybridSearchQuery(q, gvr, "default")
			require.Empty(t, errs)
			for _, extra := range []searchv0.HybridSearchFilter{
				{Field: "datasource_uid", Values: []string{"ds"}},
				{Field: "language", Values: []string{"promql"}},
			} {
				q.Filters = []searchv0.HybridSearchFilter{extra}
				_, errs = TranslateHybridSearchQuery(q, gvr, "default")
				assert.NotEmpty(t, errs, extra.Field)
			}
		})
	}
}

func TestHybridSearchBackendErrors(t *testing.T) {
	for _, tc := range []struct {
		code          codes.Code
		http          int
		err           error
		publicMessage string
	}{
		{codes.NotFound, http.StatusNotFound, nil, "hybrid search is not enabled for this resource"},
		{codes.Unavailable, http.StatusServiceUnavailable, nil, "hybrid search is temporarily unavailable"},
		{codes.Unimplemented, http.StatusNotImplemented, nil, "unsupported by the storage service"},
		{codes.InvalidArgument, http.StatusBadRequest, nil, ""},
		{codes.PermissionDenied, http.StatusForbidden, nil, ""},
		{codes.Unauthenticated, http.StatusUnauthorized, nil, ""},
		{codes.ResourceExhausted, http.StatusTooManyRequests, nil, ""},
		{codes.Internal, http.StatusInternalServerError, nil, ""},
		{codes.DeadlineExceeded, http.StatusGatewayTimeout, context.DeadlineExceeded, ""},
	} {
		t.Run(tc.code.String(), func(t *testing.T) {
			err := tc.err
			if err == nil {
				err = status.Error(tc.code, "backend rejected the request")
			}
			client := &fakeHybridIndexClient{err: err}
			h := NewHybridHandler(client, noop.NewTracerProvider().Tracer(""))
			w := doHybridRequest(h.HybridSearchFor(testKind), hybridBody(t, hybridQuery()), "default", "default")
			assert.Equal(t, tc.http, w.Code, w.Body.String())
			if tc.publicMessage != "" {
				assert.Contains(t, w.Body.String(), tc.publicMessage)
				assert.NotContains(t, w.Body.String(), "backend rejected the request")
			}
		})
	}
}

func TestHybridSearchRoute(t *testing.T) {
	client := &fakeHybridIndexClient{response: &resourcepb.HybridSearchResponse{}}
	h := NewHybridHandler(client, noop.NewTracerProvider().Tracer(""))
	r := h.HybridSearchRoute("folder.grafana.app", "v1", "folders", "Folder")
	assert.Equal(t, "folders/search/hybrid", r.Path)
	require.NotNil(t, r.Handler)
	require.NotNil(t, r.Spec.Post)
	assert.Nil(t, r.Spec.Get)
	assert.Equal(t, "listFolderHybridSearchV1", r.Spec.Post.OperationId)
	w := doHybridRequest(r.Handler, requestExample(t, r), "default", "default")
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	assert.Equal(t, "folders", client.request.Key.Resource)

	const pkg = "com.github.grafana.grafana.pkg.apis.search.v0alpha1."
	assert.Equal(t, "#/components/schemas/"+pkg+"HybridSearchQuery", r.Spec.Post.RequestBody.Content["application/json"].Schema.Ref.String())
	assert.Equal(t, "#/components/schemas/"+pkg+"HybridSearchResults", r.Spec.Post.Responses.StatusCodeResponses[200].Content["application/json"].Schema.Ref.String())
	for _, name := range []string{"HybridSearchQuery", "HybridSearchResults", "HybridSearchFilter", "HybridSearchChunk", "ResourceRef"} {
		assert.Contains(t, r.Schemas, pkg+name)
	}
	assert.NotContains(t, r.Schemas, pkg+"SearchQuery")
	assert.NotContains(t, r.Schemas, pkg+"ResultsMetadata")
	for name, schema := range r.Schemas {
		for _, ref := range collectRefs(&schema) {
			assert.Contains(t, r.Schemas, ref, "%s references unpublished schema %s", name, ref)
		}
	}
}
