package search

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"k8s.io/apimachinery/pkg/selection"
	apirequest "k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type hybridIndex struct {
	resourcepb.ResourceIndexClient
	request  *resourcepb.HybridSearchRequest
	response *resourcepb.HybridSearchResponse
	err      error
	calls    int
}

func (c *hybridIndex) HybridSearch(_ context.Context, req *resourcepb.HybridSearchRequest, _ ...grpc.CallOption) (*resourcepb.HybridSearchResponse, error) {
	c.request = req
	c.calls++
	return c.response, c.err
}

func hybridContext() context.Context {
	return identity.WithRequester(context.Background(), &user.SignedInUser{Namespace: "stacks-123"})
}

func hybridRequest(t *testing.T, handler *HybridHandler, ctx context.Context, namespace, query string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/search/hybrid?"+query, nil)
	handler.Search(rec, req.WithContext(apirequest.WithNamespace(ctx, namespace)))
	return rec
}

func TestHybridSearch(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagAlertingHybridSearch)
	client := &hybridIndex{response: &resourcepb.HybridSearchResponse{
		Results: []*resourcepb.HybridSearchResult{{
			Key: &resourcepb.ResourceKey{Name: "cpu-alert"}, Title: "CPU alert", Folder: "f1", FolderTitle: "Production", Score: 0.9,
			Chunks: []*resourcepb.HybridSearchChunk{{Subresource: "chunk/0", Content: "CPU usage high"}},
		}},
	}}
	rec := hybridRequest(t, NewHybridHandler(client), hybridContext(), "stacks-123", "query=cpu&semanticQuery=cpu+usage+high&limit=10&folder=f1&minRelevance=low")
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, "application/json", rec.Header().Get("Content-Type"))
	require.Equal(t, 1, client.calls)
	assert.Equal(t, &resourcepb.HybridSearchRequest{
		Key:           &resourcepb.ResourceKey{Namespace: "stacks-123", Group: "rules.alerting.grafana.app", Resource: "alertrules"},
		Query:         "cpu",
		SemanticQuery: "cpu usage high",
		Limit:         10,
		MinRelevance:  "low",
		Filters:       []*resourcepb.Requirement{{Key: "folder", Operator: string(selection.In), Values: []string{"f1"}}},
	}, client.request)
	assert.JSONEq(t, `{"results":[{"key":{"name":"cpu-alert"},"title":"CPU alert","folder":"f1","folder_title":"Production","score":0.9,
        "chunks":[{"subresource":"chunk/0","content":"CPU usage high"}]}]}`, rec.Body.String())
}

func TestHybridSearchFlag(t *testing.T) {
	evaluate := func(_ memprovider.InMemoryFlag, ctx openfeature.FlattenedContext) (any, openfeature.ProviderResolutionDetail) {
		return ctx["hybridEnabled"] == true, openfeature.ProviderResolutionDetail{}
	}
	provider := memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagAlertingHybridSearch: {
			Key: featuremgmt.FlagAlertingHybridSearch, State: memprovider.Enabled,
			Variants: map[string]any{"off": false}, DefaultVariant: "off", ContextEvaluator: &evaluate,
		},
	})
	require.NoError(t, openfeature.SetProviderAndWait(provider))
	t.Cleanup(func() { _ = openfeature.SetProviderAndWait(openfeature.NoopProvider{}) })
	client := &hybridIndex{response: &resourcepb.HybridSearchResponse{}}
	handler := NewHybridHandler(client)
	enabledCtx := openfeature.WithTransactionContext(hybridContext(), openfeature.NewEvaluationContext("stacks-123", map[string]any{"hybridEnabled": true}))
	for _, tc := range []struct {
		name  string
		ctx   context.Context
		code  int
		calls int
	}{
		{name: "default off", ctx: hybridContext(), code: http.StatusNotFound},
		{name: "enabled for request", ctx: enabledCtx, code: http.StatusOK, calls: 1},
		{name: "disabled for next request", ctx: hybridContext(), code: http.StatusNotFound},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client.calls = 0
			rec := hybridRequest(t, handler, tc.ctx, "stacks-123", "query=cpu")
			assert.Equal(t, tc.code, rec.Code, rec.Body.String())
			assert.Equal(t, tc.calls, client.calls)
		})
	}
}

func TestHybridSearchRejectsRequest(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagAlertingHybridSearch)
	for _, tc := range []struct {
		name      string
		ctx       context.Context
		namespace string
		query     string
		code      int
	}{
		{name: "unauthenticated", ctx: context.Background(), namespace: "stacks-123", code: http.StatusUnauthorized},
		{name: "missing namespace", ctx: hybridContext(), code: http.StatusBadRequest},
		{name: "all namespaces", ctx: hybridContext(), namespace: "*", code: http.StatusBadRequest},
		{name: "other tenant", ctx: hybridContext(), namespace: "stacks-456", code: http.StatusForbidden},
		{name: "malformed query", ctx: hybridContext(), namespace: "stacks-123", query: "query=%zz", code: http.StatusBadRequest},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client := &hybridIndex{}
			rec := hybridRequest(t, NewHybridHandler(client), tc.ctx, tc.namespace, tc.query)
			assert.Equal(t, tc.code, rec.Code, rec.Body.String())
			assert.Zero(t, client.calls)
		})
	}
}

func TestHybridSearchQueryOptions(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagAlertingHybridSearch)
	for _, tc := range []struct {
		name       string
		query      string
		limit      int64
		skipRerank bool
		filters    []*resourcepb.Requirement
	}{
		{name: "default", query: "query=cpu", limit: 50},
		{name: "invalid limit", query: "query=cpu&limit=bad", limit: 50},
		{name: "zero limit", query: "query=cpu&limit=0", limit: 50},
		{name: "negative limit", query: "query=cpu&limit=-1", limit: 50},
		{name: "root folder without reranking", query: "query=cpu&folder=general&skipRerank=true", limit: 50, skipRerank: true,
			filters: []*resourcepb.Requirement{{Key: "folder", Operator: string(selection.In), Values: []string{""}}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client := &hybridIndex{response: &resourcepb.HybridSearchResponse{}}
			rec := hybridRequest(t, NewHybridHandler(client), hybridContext(), "stacks-123", tc.query)
			require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
			require.NotNil(t, client.request)
			assert.Equal(t, tc.limit, client.request.Limit)
			assert.Empty(t, client.request.MinRelevance)
			assert.Equal(t, tc.skipRerank, client.request.SkipRerank)
			assert.Equal(t, tc.filters, client.request.Filters)
		})
	}
}

func TestHybridSearchBackendErrors(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagAlertingHybridSearch)
	for _, tc := range []struct {
		name string
		err  error
		code int
	}{
		{name: "older or unconfigured server", err: status.Error(codes.Unimplemented, "unsupported"), code: http.StatusNotImplemented},
		{name: "empty query", err: status.Error(codes.InvalidArgument, "query must not be empty"), code: http.StatusBadRequest},
		{name: "unexpected", err: errors.New("backend failure"), code: http.StatusInternalServerError},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client := &hybridIndex{err: tc.err}
			rec := hybridRequest(t, NewHybridHandler(client), hybridContext(), "stacks-123", "query=cpu")
			assert.Equal(t, tc.code, rec.Code, rec.Body.String())
			assert.Equal(t, 1, client.calls)
		})
	}
}
