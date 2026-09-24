package search

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
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
	ctx      context.Context
	response *resourcepb.HybridSearchResponse
	err      error
	calls    int
}

func (c *hybridIndex) HybridSearch(ctx context.Context, req *resourcepb.HybridSearchRequest, _ ...grpc.CallOption) (*resourcepb.HybridSearchResponse, error) {
	c.ctx, c.request = ctx, req
	c.calls++
	return c.response, c.err
}

func hybridContext() context.Context {
	return identity.WithRequester(context.Background(), &user.SignedInUser{Namespace: "stacks-123"})
}

func hybridRequest(t *testing.T, handler *HybridHandler, ctx context.Context, namespace, query string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/search/hybrid", nil)
	req.URL = &url.URL{RawQuery: query}
	handler.Search(rec, req.WithContext(apirequest.WithNamespace(ctx, namespace)))
	return rec
}

func TestHybridSearch(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagAlertingHybridSearch)
	client := &hybridIndex{response: &resourcepb.HybridSearchResponse{
		Results: []*resourcepb.HybridSearchResult{
			{
				Key: &resourcepb.ResourceKey{Name: "cpu-alert"}, Title: "CPU alert", Folder: "f1", FolderTitle: "Production", Score: 0.9,
				Chunks: []*resourcepb.HybridSearchChunk{
					{Subresource: "chunk/0", Content: "CPU usage high"},
					{Subresource: "chunk/1", Content: "CPU usage over 90%"},
				},
			},
			{Key: &resourcepb.ResourceKey{Name: "cpu-warning"}, Title: "CPU warning", Score: 0.5},
		},
	}}
	ctx := hybridContext()
	rec := hybridRequest(t, NewHybridHandler(client), ctx, "stacks-123", "query=cpu&semanticQuery=cpu+usage+high&limit=10&folder=f1&minRelevance=low")
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, "application/json", rec.Header().Get("Content-Type"))
	require.Equal(t, 1, client.calls)
	assert.Equal(t, "stacks-123", apirequest.NamespaceValue(client.ctx))
	require.NotNil(t, client.request)
	assert.Equal(t, &resourcepb.ResourceKey{Namespace: "stacks-123", Group: "rules.alerting.grafana.app", Resource: "alertrules"}, client.request.Key)
	assert.Equal(t, "cpu", client.request.Query)
	assert.Equal(t, "cpu usage high", client.request.SemanticQuery)
	assert.Equal(t, int64(10), client.request.Limit)
	assert.Equal(t, "low", client.request.MinRelevance)
	assert.False(t, client.request.SkipRerank)
	assert.Equal(t, []*resourcepb.Requirement{{Key: "folder", Operator: string(selection.In), Values: []string{"f1"}}}, client.request.Filters)
	assert.JSONEq(t, `{"results":[
        {"key":{"name":"cpu-alert"},"title":"CPU alert","folder":"f1","folder_title":"Production","score":0.9,
         "chunks":[{"subresource":"chunk/0","content":"CPU usage high"},{"subresource":"chunk/1","content":"CPU usage over 90%"}]},
        {"key":{"name":"cpu-warning"},"title":"CPU warning","score":0.5}
    ]}`, rec.Body.String())
}

func TestHybridSearchFlag(t *testing.T) {
	client := &hybridIndex{response: &resourcepb.HybridSearchResponse{}}
	handler := NewHybridHandler(client)
	for _, tc := range []struct {
		name    string
		enabled []string
		code    int
	}{
		{name: "default off", code: http.StatusNotFound},
		{name: "enabled", enabled: []string{featuremgmt.FlagAlertingHybridSearch}, code: http.StatusOK},
		{name: "disabled again", code: http.StatusNotFound},
	} {
		t.Run(tc.name, func(t *testing.T) {
			featuremgmt.WithEnabledFlags(t, tc.enabled...)
			client.calls = 0
			rec := hybridRequest(t, handler, hybridContext(), "stacks-123", "query=cpu")
			assert.Equal(t, tc.code, rec.Code, rec.Body.String())
			if tc.code == http.StatusNotFound {
				assert.Zero(t, client.calls)
			} else {
				assert.Equal(t, 1, client.calls)
			}
		})
	}
}

func TestHybridSearchFlagUsesRequestContext(t *testing.T) {
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
	for _, enabled := range []bool{true, false} {
		ctx := openfeature.WithTransactionContext(hybridContext(), openfeature.NewEvaluationContext("stacks-123", map[string]any{"hybridEnabled": enabled}))
		rec := hybridRequest(t, handler, ctx, "stacks-123", "query=cpu")
		if enabled {
			assert.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		} else {
			assert.Equal(t, http.StatusNotFound, rec.Code, rec.Body.String())
		}
	}
	assert.Equal(t, 1, client.calls)
}

func TestHybridSearchNamespace(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagAlertingHybridSearch)
	for _, tc := range []struct {
		name      string
		ctx       context.Context
		namespace string
		code      int
	}{
		{name: "unauthenticated", ctx: context.Background(), namespace: "stacks-123", code: http.StatusUnauthorized},
		{name: "missing namespace", ctx: hybridContext(), code: http.StatusBadRequest},
		{name: "all namespaces", ctx: hybridContext(), namespace: "*", code: http.StatusBadRequest},
		{name: "other tenant", ctx: hybridContext(), namespace: "stacks-456", code: http.StatusForbidden},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client := &hybridIndex{}
			rec := hybridRequest(t, NewHybridHandler(client), tc.ctx, tc.namespace, "query=cpu")
			assert.Equal(t, tc.code, rec.Code, rec.Body.String())
			assert.Zero(t, client.calls)
		})
	}
}

func TestHybridSearchQueryOptions(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagAlertingHybridSearch)
	for _, tc := range []struct {
		name  string
		query string
		limit int64
	}{
		{name: "default", query: "query=cpu", limit: 50},
		{name: "invalid limit", query: "query=cpu&limit=bad", limit: 50},
		{name: "zero limit", query: "query=cpu&limit=0", limit: 50},
		{name: "negative limit", query: "query=cpu&limit=-1", limit: 50},
		{name: "backend caps limit", query: "query=cpu&limit=201", limit: 201},
		{name: "skip rerank", query: "query=cpu&skipRerank=true", limit: 50},
		{name: "root folder", query: "query=cpu&folder=general", limit: 50},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client := &hybridIndex{response: &resourcepb.HybridSearchResponse{}}
			rec := hybridRequest(t, NewHybridHandler(client), hybridContext(), "stacks-123", tc.query)
			require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
			assert.JSONEq(t, `{}`, rec.Body.String())
			require.NotNil(t, client.request)
			assert.Equal(t, tc.limit, client.request.Limit)
			assert.Empty(t, client.request.MinRelevance)
			assert.Equal(t, tc.name == "skip rerank", client.request.SkipRerank)
			if tc.name == "root folder" {
				assert.Equal(t, []*resourcepb.Requirement{{Key: "folder", Operator: string(selection.In), Values: []string{""}}}, client.request.Filters)
			} else {
				assert.Empty(t, client.request.Filters)
			}
		})
	}

	t.Run("malformed query", func(t *testing.T) {
		client := &hybridIndex{}
		rec := hybridRequest(t, NewHybridHandler(client), hybridContext(), "stacks-123", "query=%zz")
		assert.Equal(t, http.StatusBadRequest, rec.Code)
		assert.Zero(t, client.calls)
	})
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
		{name: "invalid relevance", err: status.Error(codes.InvalidArgument, "unsupported min_relevance"), code: http.StatusBadRequest},
		{name: "rerank conflict", err: status.Error(codes.InvalidArgument, "min_relevance cannot be combined with skip_rerank"), code: http.StatusBadRequest},
		{name: "permission denied", err: status.Error(codes.PermissionDenied, "denied"), code: http.StatusForbidden},
		{name: "unauthenticated", err: status.Error(codes.Unauthenticated, "unauthenticated"), code: http.StatusUnauthorized},
		{name: "collection missing", err: status.Error(codes.NotFound, "collection not found"), code: http.StatusNotFound},
		{name: "rate limited", err: status.Error(codes.ResourceExhausted, "rate limited"), code: http.StatusTooManyRequests},
		{name: "unavailable", err: status.Error(codes.Unavailable, "unavailable"), code: http.StatusServiceUnavailable},
		{name: "unexpected", err: errors.New("backend failure"), code: http.StatusInternalServerError},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client := &hybridIndex{err: tc.err}
			rec := hybridRequest(t, NewHybridHandler(client), hybridContext(), "stacks-123", "query=cpu")
			assert.Equal(t, tc.code, rec.Code, rec.Body.String())
			assert.Equal(t, 1, client.calls)
			assert.True(t, json.Valid(rec.Body.Bytes()))
		})
	}
}
