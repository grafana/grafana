package resource

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/structpb"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/utils/ptr"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
	"github.com/grafana/grafana/pkg/storage/unified/search/rerank"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

type hybridResourcesTestIndex struct {
	MockResourceIndex
	mu        sync.Mutex
	responses map[schema.GroupResource]*resourcepb.ResourceSearchResponse
	errors    map[schema.GroupResource]error
	requests  map[schema.GroupResource]*resourcepb.ResourceSearchRequest
	lookups   []*resourcepb.ResourceSearchRequest
	managers  map[schema.GroupResource]*resourcepb.ResourceSearchResponse
	folders   *resourcepb.ResourceSearchResponse
	onSearch  func(context.Context) error
}

func (h *hybridResourcesTestIndex) Search(ctx context.Context, _ authlib.AccessClient, req *resourcepb.ResourceSearchRequest, _ *SearchIndexes, _ *SearchStats) (*resourcepb.ResourceSearchResponse, error) {
	key := schema.GroupResource{Group: req.Options.Key.Group, Resource: req.Options.Key.Resource}
	h.mu.Lock()
	response, err := h.responses[key], h.errors[key]
	if req.Query == "" {
		h.lookups = append(h.lookups, req)
		response, err = h.folders, nil
		if slices.Contains(req.Fields, SEARCH_FIELD_MANAGER_KIND) {
			response = h.managers[key]
		}
	} else {
		h.requests[key] = req
	}
	h.mu.Unlock()
	if req.Query != "" && h.onSearch != nil {
		if err := h.onSearch(ctx); err != nil {
			return nil, err
		}
	}
	if response == nil && err == nil {
		response = lexFieldValueResponse()
	}
	return response, err
}

func hybridResourcesTestRequest() *resourcepb.HybridSearchRequest {
	return &resourcepb.HybridSearchRequest{
		Namespace: "ns",
		Resources: []*resourcepb.HybridSearchRequest_Resource{
			{Group: "dashboard.grafana.app", Resource: "dashboards"},
			{Group: "folder.grafana.app", Resource: "folders"},
		},
		Query: "database",
	}
}

func newHybridResourcesTestServer(responses map[schema.GroupResource]*resourcepb.ResourceSearchResponse) (*searchServer, *hybridResourcesTestIndex) {
	index := &hybridResourcesTestIndex{
		responses: responses,
		errors:    make(map[schema.GroupResource]error),
		requests:  make(map[schema.GroupResource]*resourcepb.ResourceSearchRequest),
		managers:  make(map[schema.GroupResource]*resourcepb.ResourceSearchResponse),
	}
	s := newTestSearchServer(nil, nil)
	s.search = &fakeSearchBackend{idx: index}
	return s, index
}

func TestHybridSearch_ReportsRequestedManifestKindsWithNoResults(t *testing.T) {
	manifest := func(group, kind, plural string) *app.ManifestData {
		version := hybridConfigVersion("v1", ptr.To(true))
		version.Kinds[0].Kind = kind
		version.Kinds[0].Plural = plural
		m := hybridConfigManifest(version)
		m.Group = group
		return m
	}
	manifests := []*app.ManifestData{
		manifest("dashboard.grafana.app", "Dashboard", "dashboards"),
		manifest("folder.grafana.app", "Folder", "folders"),
	}
	for _, tt := range []struct {
		name string
		req  *resourcepb.HybridSearchRequest
		want map[string]string
	}{
		{
			name: "legacy key",
			req: &resourcepb.HybridSearchRequest{
				Key:   &resourcepb.ResourceKey{Namespace: "ns", Group: "dashboard.grafana.app", Resource: "dashboards"},
				Query: "missing",
			},
			want: map[string]string{"dashboard.grafana.app/dashboards": "Dashboard"},
		},
		{
			name: "resource list",
			req: &resourcepb.HybridSearchRequest{
				Namespace: "ns", Query: "missing",
				Resources: []*resourcepb.HybridSearchRequest_Resource{
					{Group: "dashboard.grafana.app", Resource: "dashboards"},
					{Group: "folder.grafana.app", Resource: "folders"},
					{Group: "unknown.grafana.app", Resource: "unknowns"},
				},
			},
			want: map[string]string{"dashboard.grafana.app/dashboards": "Dashboard", "folder.grafana.app/folders": "Folder"},
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			s, _ := newHybridResourcesTestServer(nil)
			s.hybridSearchConfig = NewHybridSearchConfigRegistry(manifests)
			resp, err := s.HybridSearch(authedCtx(), tt.req)
			require.NoError(t, err)
			assert.Empty(t, resp.Results)
			assert.Equal(t, tt.want, resp.GetKinds())
		})
	}
}

func TestHybridSearch_MultipleResources_ReranksCombinedResults(t *testing.T) {
	req := hybridResourcesTestRequest()
	req.Resources = append(req.Resources, &resourcepb.HybridSearchRequest_Resource{
		Group: "other.grafana.app", Resource: "dashboards",
	})
	req.SemanticQuery = "database monitoring"
	req.Limit = 2
	req.MinRelevance = "high"
	req.Filters = []*resourcepb.Requirement{{Key: "uid", Operator: "in", Values: []string{"same-name"}}}
	responses := make(map[schema.GroupResource]*resourcepb.ResourceSearchResponse)
	titles := []string{"Operations", "Production", "Infrastructure"}
	descriptions := []string{"Dashboard context", "Folder context", "Other app context"}
	for i, resource := range req.Resources {
		response := lexFieldValueResponse([3]string{"same-name", titles[i], ""})
		response.Fields = append(response.Fields, &resourcepb.ResourceSearchField{
			Name: SEARCH_FIELD_DESCRIPTION, Type: resourcepb.ResourceSearchField_STRING,
		})
		response.Rows[0].Values = append(response.Rows[0].Values, &resourcepb.ResourceSearchValue{
			FieldIndex: 2, StringValues: []string{descriptions[i]},
		})
		responses[schema.GroupResource{Group: resource.Group, Resource: resource.Resource}] = response
	}
	s, index := newHybridResourcesTestServer(responses)
	scorer := &fakeRerankScorer{scores: []float64{0.1, 0.9, 0.7}}
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{High: 0.6})

	response, err := s.HybridSearch(authedCtx(), req)
	require.NoError(t, err)
	require.Len(t, response.Results, 2)
	assert.Equal(t, 1, scorer.calls)
	assert.Equal(t, req.SemanticQuery, scorer.gotQ)
	assert.Equal(t, []string{
		"Operations\nDashboard context",
		"Production\nFolder context",
		"Infrastructure\nOther app context",
	}, scorer.gotTexts)
	assert.Equal(t, "folder.grafana.app", response.Results[0].Key.Group)
	assert.Equal(t, "other.grafana.app", response.Results[1].Key.Group)
	for i, result := range response.Results {
		assert.Equal(t, "ns", result.Key.Namespace)
		assert.Equal(t, "same-name", result.Key.Name)
		lexical, err := structpb.NewStruct(map[string]any{
			SEARCH_FIELD_TITLE:       titles[i+1],
			SEARCH_FIELD_DESCRIPTION: descriptions[i+1],
		})
		require.NoError(t, err)
		assert.Equal(t, lexical.Fields, result.Lexical)
		require.Len(t, result.Chunks, 1)
		assert.Equal(t, result.Title, result.Chunks[0].Content)
	}
	for _, request := range index.requests {
		assert.Contains(t, request.Fields, SEARCH_FIELD_DESCRIPTION)
		assert.Equal(t, []*resourcepb.Requirement{{Key: SEARCH_FIELD_NAME, Operator: "in", Values: []string{"same-name"}}}, request.Options.Fields)
	}
}

func TestHybridSearch_MultipleResources_WithoutReranking(t *testing.T) {
	for _, mode := range []string{"no reranker", "skip rerank", "reranker failure"} {
		t.Run(mode, func(t *testing.T) {
			req := hybridResourcesTestRequest()
			req.Limit = 3
			req.SkipRerank = mode == "skip rerank"
			s, index := newHybridResourcesTestServer(map[schema.GroupResource]*resourcepb.ResourceSearchResponse{
				{Group: "dashboard.grafana.app", Resource: "dashboards"}: lexFieldValueResponse(
					[3]string{"dashboard-1", "Dashboard one", ""}, [3]string{"dashboard-2", "Dashboard two", ""},
				),
				{Group: "folder.grafana.app", Resource: "folders"}: lexFieldValueResponse(
					[3]string{"folder-1", "Folder one", ""}, [3]string{"folder-2", "Folder two", ""},
				),
			})
			scorer := &fakeRerankScorer{err: errors.New("reranker unavailable")}
			if mode != "no reranker" {
				s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{})
			}

			response, err := s.HybridSearch(authedCtx(), req)
			require.NoError(t, err)
			require.Len(t, response.Results, 3)
			assert.Equal(t, "dashboard-1", response.Results[0].Key.Name)
			assert.Equal(t, "folder-1", response.Results[1].Key.Name)
			assert.Equal(t, "dashboard-2", response.Results[2].Key.Name)
			for i := 1; i < len(response.Results); i++ {
				assert.Greater(t, response.Results[i-1].Score, response.Results[i].Score)
			}
			if mode == "reranker failure" {
				assert.Equal(t, 1, scorer.calls)
			} else {
				assert.Zero(t, scorer.calls)
				for _, request := range index.requests {
					assert.NotContains(t, request.Fields, SEARCH_FIELD_DESCRIPTION)
				}
			}
		})
	}
}

func TestHybridSearch_MultipleResources_CandidateBudgetIncludesEveryResource(t *testing.T) {
	req := hybridResourcesTestRequest()
	req.Resources = append(req.Resources, &resourcepb.HybridSearchRequest_Resource{
		Group: "rules.alerting.grafana.app", Resource: "alertrules",
	})
	req.Limit = 100
	responses := make(map[schema.GroupResource]*resourcepb.ResourceSearchResponse)
	for _, resource := range req.Resources {
		rows := make([][3]string, 200)
		for i := range rows {
			rows[i] = [3]string{fmt.Sprintf("%s-%d", resource.Resource, i), fmt.Sprintf("%s %d", resource.Resource, i), ""}
		}
		responses[schema.GroupResource{Group: resource.Group, Resource: resource.Resource}] = lexFieldValueResponse(rows...)
	}
	s, _ := newHybridResourcesTestServer(responses)
	scorer := &fakeRerankScorer{}
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{})

	response, err := s.HybridSearch(authedCtx(), req)
	require.NoError(t, err)
	assert.Len(t, response.Results, 100)
	assert.Equal(t, 1, scorer.calls)
	require.Len(t, scorer.gotTexts, 500)
	for i, text := range scorer.gotTexts {
		resource := req.Resources[i%len(req.Resources)].Resource
		assert.Equal(t, fmt.Sprintf("%s %d", resource, i/len(req.Resources)), text)
	}
}

func TestHybridSearch_MultipleResources_Validation(t *testing.T) {
	for _, test := range []struct {
		name   string
		change func(*resourcepb.HybridSearchRequest)
	}{
		{name: "key with resource list", change: func(r *resourcepb.HybridSearchRequest) { r.Key = validKey() }},
		{name: "key with namespace", change: func(r *resourcepb.HybridSearchRequest) { r.Key, r.Resources = validKey(), nil }},
		{name: "missing namespace", change: func(r *resourcepb.HybridSearchRequest) { r.Namespace = "" }},
		{name: "missing resources", change: func(r *resourcepb.HybridSearchRequest) { r.Resources = nil }},
		{name: "nil resource", change: func(r *resourcepb.HybridSearchRequest) { r.Resources[0] = nil }},
		{name: "missing group", change: func(r *resourcepb.HybridSearchRequest) { r.Resources[0].Group = "" }},
		{name: "missing resource", change: func(r *resourcepb.HybridSearchRequest) { r.Resources[0].Resource = "" }},
		{name: "duplicate resource", change: func(r *resourcepb.HybridSearchRequest) { r.Resources = append(r.Resources, r.Resources[0]) }},
		{name: "nil filter", change: func(r *resourcepb.HybridSearchRequest) { r.Filters = []*resourcepb.Requirement{nil} }},
		{name: "resource specific filter", change: func(r *resourcepb.HybridSearchRequest) {
			r.Filters = []*resourcepb.Requirement{{Key: "language", Values: []string{"promql"}}}
		}},
	} {
		t.Run(test.name, func(t *testing.T) {
			s, index := newHybridResourcesTestServer(nil)
			req := hybridResourcesTestRequest()
			test.change(req)
			response, err := s.HybridSearch(authedCtx(), req)
			require.Error(t, err)
			assert.Equal(t, codes.InvalidArgument, status.Code(err))
			assert.Nil(t, response)
			assert.Empty(t, index.requests)
		})
	}
	t.Run("nil request", func(t *testing.T) {
		s, _ := newHybridResourcesTestServer(nil)
		_, err := s.HybridSearch(authedCtx(), nil)
		assert.Equal(t, codes.InvalidArgument, status.Code(err))
	})
	t.Run("more than ten resources", func(t *testing.T) {
		req := hybridResourcesTestRequest()
		req.Resources = make([]*resourcepb.HybridSearchRequest_Resource, 11)
		for i := range req.Resources {
			req.Resources[i] = &resourcepb.HybridSearchRequest_Resource{Group: "g", Resource: fmt.Sprintf("resource-%d", i)}
		}
		s, index := newHybridResourcesTestServer(nil)
		_, err := s.HybridSearch(authedCtx(), req)
		require.NoError(t, err)
		assert.Len(t, index.requests, len(req.Resources))
	})
}

func TestHybridSearch_MultipleResources_FailureDoesNotReturnPartialResults(t *testing.T) {
	s, index := newHybridResourcesTestServer(map[schema.GroupResource]*resourcepb.ResourceSearchResponse{
		{Group: "dashboard.grafana.app", Resource: "dashboards"}: lexFieldValueResponse([3]string{"d", "Dashboard", ""}),
	})
	index.errors[schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}] = status.Error(codes.Unavailable, "folder index unavailable")
	scorer := &fakeRerankScorer{}
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{})

	response, err := s.HybridSearch(authedCtx(), hybridResourcesTestRequest())
	require.Error(t, err)
	assert.Equal(t, codes.Unavailable, status.Code(err))
	assert.Nil(t, response)
	assert.Zero(t, scorer.calls)
}

func TestHybridSearch_RejectsUnauthenticatedAndCrossNamespaceRequests(t *testing.T) {
	for _, test := range []struct {
		name      string
		ctx       context.Context
		namespace string
		code      codes.Code
	}{
		{name: "unauthenticated", ctx: context.Background(), namespace: "ns", code: codes.Unauthenticated},
		{name: "different namespace", ctx: authedCtx(), namespace: "other-tenant", code: codes.PermissionDenied},
	} {
		for _, selector := range []string{"key", "resources"} {
			t.Run(test.name+"/"+selector, func(t *testing.T) {
				s, index := newHybridResourcesTestServer(nil)
				client, limiter := enableHybridResourcesSemantic(s, &hybridResourcesTestVectorBackend{})
				req := hybridResourcesTestRequest()
				req.Namespace = test.namespace
				if selector == "key" {
					req.Key = &resourcepb.ResourceKey{Namespace: req.Namespace, Group: req.Resources[0].Group, Resource: req.Resources[0].Resource}
					req.Namespace, req.Resources = "", nil
				}
				_, err := s.HybridSearch(test.ctx, req)
				require.Error(t, err)
				assert.Equal(t, test.code, status.Code(err))
				assert.Empty(t, index.requests)
				assert.Zero(t, client.calls)
				assert.Zero(t, limiter.calls)
			})
		}
	}
}

type hybridResourcesTestEmbedder struct {
	mu sync.Mutex
	fakeTextEmbedder
	calls   int
	onEmbed func(context.Context) error
}

func (e *hybridResourcesTestEmbedder) EmbedText(ctx context.Context, input embedder.EmbedTextInput) (embedder.EmbedTextOutput, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.calls++
	if e.onEmbed != nil {
		if err := e.onEmbed(ctx); err != nil {
			return embedder.EmbedTextOutput{}, err
		}
	}
	return e.fakeTextEmbedder.EmbedText(ctx, input)
}

type hybridResourcesTestVectorBackend struct {
	vector.VectorBackend
	mu         sync.Mutex
	results    map[string][]vector.VectorSearchResult
	embeddings map[string][]float32
	missing    string
	external   string
}

func (b *hybridResourcesTestVectorBackend) ResolveCollection(_ context.Context, group, resource string) (vector.Collection, bool, error) {
	return vector.Collection{Group: group, Resource: resource, PartitionKey: resource, IsExternal: resource == b.external, Scope: vector.ScopeTenant}, resource != b.missing, nil
}

func (b *hybridResourcesTestVectorBackend) Search(_ context.Context, _, _, resource string, dense []float32, _ int, _ ...vector.SearchFilter) ([]vector.VectorSearchResult, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.embeddings == nil {
		b.embeddings = make(map[string][]float32)
	}
	b.embeddings[resource] = dense
	if b.results != nil {
		return slices.Clone(b.results[resource]), nil
	}
	return []vector.VectorSearchResult{{UID: "same-name", Content: "Database details"}}, nil
}

func enableHybridResourcesSemantic(s *searchServer, backend *hybridResourcesTestVectorBackend) (*hybridResourcesTestEmbedder, *fakeRateLimiter) {
	client := &hybridResourcesTestEmbedder{fakeTextEmbedder: fakeTextEmbedder{dim: 4}}
	s.embedder = newTestEmbedder(&client.fakeTextEmbedder)
	s.embedder.TextEmbedder = client
	s.vectorBackend = backend
	s.collectionAllowlist = vector.NewCollectionAllowlist([]string{"dashboard.grafana.app/dashboards", "folder.grafana.app/folders"}, []string{"external.grafana.app/documents"})
	limiter := &fakeRateLimiter{allow: true}
	s.rateLimiter, s.rateLimitPerTenant, s.rateLimitWindow = limiter, 100, time.Minute
	return client, limiter
}

type hybridResourcesTestAccess struct {
	authlib.AccessClient
	mu     sync.Mutex
	checks []authlib.BatchCheckItem
}

func (a *hybridResourcesTestAccess) BatchCheck(_ context.Context, _ authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.checks = append(a.checks, req.Checks...)
	results := make(map[string]authlib.BatchCheckResult, len(req.Checks))
	for _, check := range req.Checks {
		results[check.CorrelationID] = authlib.BatchCheckResult{Allowed: check.Group == "folder.grafana.app" && check.Resource == "folders"}
	}
	return authlib.BatchCheckResponse{Results: results}, nil
}

func TestHybridSearch_MultipleResources_SemanticAuthorizationUsesEachResourceType(t *testing.T) {
	s, _ := newHybridResourcesTestServer(nil)
	enableHybridResourcesSemantic(s, &hybridResourcesTestVectorBackend{})
	access := &hybridResourcesTestAccess{AccessClient: authlib.FixedAccessClient(true)}
	s.access = access
	scorer := &fakeRerankScorer{}
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{})

	response, err := s.HybridSearch(authedCtx(), hybridResourcesTestRequest())
	require.NoError(t, err)
	require.Len(t, response.Results, 1)
	assert.Equal(t, "folder.grafana.app", response.Results[0].Key.Group)
	assert.Equal(t, "folders", response.Results[0].Key.Resource)
	assert.Equal(t, "same-name", response.Results[0].Key.Name)
	assert.Equal(t, []string{"Database details"}, scorer.gotTexts)
	require.Len(t, access.checks, 2)
	checked := make([]schema.GroupResource, 0, len(access.checks))
	for _, check := range access.checks {
		assert.Equal(t, "same-name", check.Name)
		checked = append(checked, schema.GroupResource{Group: check.Group, Resource: check.Resource})
	}
	assert.ElementsMatch(t, []schema.GroupResource{
		{Group: "dashboard.grafana.app", Resource: "dashboards"},
		{Group: "folder.grafana.app", Resource: "folders"},
	}, checked)
}

func TestHybridSearch_SingleResourceMatchesLegacyKey(t *testing.T) {
	for _, mode := range []string{"no reranker", "skip rerank", "reranker failure", "rerank"} {
		t.Run(mode, func(t *testing.T) {
			var legacy *resourcepb.HybridSearchResponse
			for _, useList := range []bool{false, true} {
				s, _, _ := newHybridTestServer(lexFieldValueResponse(
					[3]string{"both", "Both", ""}, [3]string{"lexical", "Lexical", ""},
				), &fakeVectorBackend{results: []vector.VectorSearchResult{
					{UID: "both", Content: "Both"}, {UID: "semantic", Content: "Semantic"},
				}})
				scorer := &fakeRerankScorer{scores: []float64{0.2, 0.9, 0.7}}
				if mode == "reranker failure" {
					scorer.err = errors.New("provider unavailable")
				}
				if mode != "no reranker" {
					s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{})
				}
				req := &resourcepb.HybridSearchRequest{Key: validKey(), Query: "database", Limit: 2, SkipRerank: mode == "skip rerank"}
				if useList {
					req.Namespace, req.Resources, req.Key = req.Key.Namespace, []*resourcepb.HybridSearchRequest_Resource{{Group: "g", Resource: "r"}}, nil
				}
				response, err := s.HybridSearch(authedCtx(), req)
				require.NoError(t, err)
				require.Len(t, response.Results, 2)
				if mode == "rerank" {
					assert.Equal(t, "lexical", response.Results[0].Key.Name)
					assert.Equal(t, 0.9, response.Results[0].Score)
				} else {
					assert.Equal(t, "both", response.Results[0].Key.Name)
					assert.InDelta(t, 2.0/61, response.Results[0].Score, 1e-12)
				}
				if useList {
					assert.True(t, proto.Equal(legacy, response), "single-target forms must preserve the same results and scores")
				} else {
					legacy = response
				}
			}
		})
	}
}

func TestHybridSearch_SingleResourcePreservesKindSpecificFilters(t *testing.T) {
	for _, external := range []bool{false, true} {
		name := "dashboard language"
		if external {
			name = "external metadata"
		}
		t.Run(name, func(t *testing.T) {
			backend := &fakeVectorBackend{}
			s, index, _ := newHybridTestServer(lexFieldValueResponse(), backend)
			req := &resourcepb.HybridSearchRequest{
				Namespace: "ns", Resources: []*resourcepb.HybridSearchRequest_Resource{{Group: "dashboard.grafana.app", Resource: "dashboards"}},
				Query: "database", Filters: []*resourcepb.Requirement{{Key: "language", Values: []string{"promql"}}},
			}
			s.collectionAllowlist = vector.NewCollectionAllowlist([]string{"dashboard.grafana.app/dashboards"}, []string{"g/r"})
			lexical := &fakeLexicalSearcher{}
			if external {
				backend.collection = externalBackend().collection
				s.externalLexical = lexical
				req.Resources[0] = &resourcepb.HybridSearchRequest_Resource{Group: "g", Resource: "r"}
				req.Filters = []*resourcepb.Requirement{{Key: "kind", Values: []string{"alert_rule"}}}
			}

			_, err := s.HybridSearch(authedCtx(), req)
			require.NoError(t, err)
			want := []vector.SearchFilter{{Field: req.Filters[0].Key, Values: req.Filters[0].Values}}
			assert.Equal(t, want, backend.gotFilters)
			if external {
				assert.Equal(t, want, lexical.gotQ.Filters)
				assert.Nil(t, index.gotReq)
			} else {
				require.NotNil(t, index.gotReq)
				assert.Equal(t, []*resourcepb.Requirement{{Key: SEARCH_FIELD_PREFIX + "ds_types", Operator: "in", Values: languageToDSTypes["promql"]}}, index.gotReq.Options.Fields)
			}
		})
	}
}

func TestHybridSearch_MultipleResources_SharesEmbeddingWhileLexicalRuns(t *testing.T) {
	for _, mode := range []string{"success", "caller cancellation", "lexical failure"} {
		t.Run(mode, func(t *testing.T) {
			s, index := newHybridResourcesTestServer(nil)
			backend := &hybridResourcesTestVectorBackend{}
			client, limiter := enableHybridResourcesSemantic(s, backend)
			cache := newFakeQueryCache()
			s.queryCache, s.queryCacheMaxPerTenant = cache, 100
			lexicalStarted, releaseLexical := make(chan struct{}, 2), make(chan struct{})
			index.onSearch = func(ctx context.Context) error {
				lexicalStarted <- struct{}{}
				select {
				case <-releaseLexical:
					if mode == "lexical failure" {
						return status.Error(codes.Unavailable, "index unavailable")
					}
					return nil
				case <-ctx.Done():
					return ctx.Err()
				}
			}
			embeddingStarted, releaseEmbedding := make(chan struct{}, 2), make(chan struct{})
			client.onEmbed = func(ctx context.Context) error {
				embeddingStarted <- struct{}{}
				select {
				case <-releaseEmbedding:
					return nil
				case <-ctx.Done():
					return ctx.Err()
				}
			}
			ctx, cancel := context.WithTimeout(authedCtx(), 5*time.Second)
			defer cancel()
			done := make(chan error, 1)
			req := hybridResourcesTestRequest()
			req.SemanticQuery = "database monitoring"
			go func() { _, err := s.HybridSearch(ctx, req); done <- err }()
			for _, started := range []<-chan struct{}{embeddingStarted, lexicalStarted, lexicalStarted} {
				select {
				case <-started:
				case <-ctx.Done():
					t.Fatal("lexical retrieval must overlap the shared embedding call")
				}
			}
			switch mode {
			case "caller cancellation":
				cancel()
			case "lexical failure":
				close(releaseLexical)
			default:
				close(releaseLexical)
				close(releaseEmbedding)
			}
			err := <-done
			if mode != "success" {
				want := codes.Canceled
				if mode == "lexical failure" {
					want = codes.Unavailable
				}
				assert.Equal(t, want, status.Code(err))
				assert.Empty(t, backend.embeddings)
			} else {
				require.NoError(t, err)
				require.Len(t, backend.embeddings, 2)
				assert.Equal(t, backend.embeddings["dashboards"], backend.embeddings["folders"])
				assert.Equal(t, []string{req.SemanticQuery}, client.gotIn.Texts)
				assert.Equal(t, 1, cache.putCalls)
			}
			assert.Equal(t, 1, client.calls)
			assert.Equal(t, 1, limiter.calls)
			assert.Equal(t, 1, cache.getCalls)
		})
	}
}

func TestHybridSearch_MultipleResources_ValidatesLaterCollectionBeforeProviderWork(t *testing.T) {
	for _, external := range []bool{false, true} {
		t.Run(fmt.Sprintf("external=%v", external), func(t *testing.T) {
			s, index := newHybridResourcesTestServer(nil)
			backend := &hybridResourcesTestVectorBackend{missing: "folders"}
			client, limiter := enableHybridResourcesSemantic(s, backend)
			want := codes.NotFound
			if external {
				backend.missing, backend.external = "", "folders"
				s.collectionAllowlist = vector.NewCollectionAllowlist([]string{"dashboard.grafana.app/dashboards"}, []string{"folder.grafana.app/folders"})
				want = codes.InvalidArgument
			}
			response, err := s.HybridSearch(authedCtx(), hybridResourcesTestRequest())
			assert.Equal(t, want, status.Code(err))
			assert.Nil(t, response)
			assert.Empty(t, index.requests)
			assert.Empty(t, backend.embeddings)
			assert.Zero(t, client.calls)
			assert.Zero(t, limiter.calls)
		})
	}
}

func TestHybridSearch_MultipleResources_EnrichesOnlyFinalResultsByKind(t *testing.T) {
	req := hybridResourcesTestRequest()
	req.Resources = append(req.Resources, &resourcepb.HybridSearchRequest_Resource{Group: "external.grafana.app", Resource: "documents"})
	req.Limit = 3
	backend := &hybridResourcesTestVectorBackend{external: "documents", results: make(map[string][]vector.VectorSearchResult)}
	for _, target := range req.Resources {
		backend.results[target.Resource] = []vector.VectorSearchResult{
			{UID: "same-name", Content: target.Resource, Folder: "shared-folder"},
			{UID: "excluded", Content: "Below limit", Folder: "excluded-folder"},
		}
	}
	s, index := newHybridResourcesTestServer(nil)
	enableHybridResourcesSemantic(s, backend)
	s.externalLexical = &fakeLexicalSearcher{}
	index.folders = lexFieldValueResponse([3]string{"shared-folder", "Shared folder", ""})
	for _, target := range req.Resources[:2] {
		index.managers[schema.GroupResource{Group: target.Group, Resource: target.Resource}] = managerFieldValueResponse([3]string{"same-name", "repo", target.Resource + "-manager"})
	}

	response, err := s.HybridSearch(authedCtx(), req)
	require.NoError(t, err)
	require.Len(t, response.Results, 3)
	for _, result := range response.Results {
		assert.Equal(t, "same-name", result.Key.Name)
		assert.Equal(t, "Shared folder", result.FolderTitle)
		if result.Key.Resource == "documents" {
			assert.Empty(t, result.ManagedByKind)
			assert.Empty(t, result.ManagedById)
		} else {
			assert.Equal(t, "repo", result.ManagedByKind)
			assert.Equal(t, result.Key.Resource+"-manager", result.ManagedById)
		}
	}
	require.Len(t, index.lookups, 3)
	for _, lookup := range index.lookups {
		assert.Equal(t, int64(1), lookup.Limit)
		assert.Equal(t, "ns", lookup.Options.Key.Namespace)
		require.Len(t, lookup.Options.Fields, 1)
		if slices.Contains(lookup.Fields, SEARCH_FIELD_MANAGER_KIND) {
			assert.NotEqual(t, "documents", lookup.Options.Key.Resource)
			assert.Equal(t, []string{"same-name"}, lookup.Options.Fields[0].Values)
		} else {
			assert.Equal(t, "folders", lookup.Options.Key.Resource)
			assert.Equal(t, []string{"shared-folder"}, lookup.Options.Fields[0].Values)
		}
	}
}
