package resource

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/structpb"
	"k8s.io/apimachinery/pkg/runtime/schema"

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
}

func (h *hybridResourcesTestIndex) Search(_ context.Context, _ authlib.AccessClient, req *resourcepb.ResourceSearchRequest, _ []ResourceIndex, _ *SearchStats) (*resourcepb.ResourceSearchResponse, error) {
	if req.Query == "" {
		return lexFieldValueResponse(), nil
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	key := schema.GroupResource{Group: req.Options.Key.Group, Resource: req.Options.Key.Resource}
	h.requests[key] = req
	if err := h.errors[key]; err != nil {
		return nil, err
	}
	if response := h.responses[key]; response != nil {
		return response, nil
	}
	return lexFieldValueResponse(), nil
}

func hybridResourcesTestRequest() *resourcepb.HybridSearchResourcesRequest {
	return &resourcepb.HybridSearchResourcesRequest{
		Namespace: "ns",
		Resources: []*resourcepb.HybridSearchResourcesRequest_Resource{
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
	}
	s := newTestSearchServer(nil, nil)
	s.search = &fakeSearchBackend{idx: index}
	return s, index
}

func TestHybridSearchResources_ReranksCombinedResults(t *testing.T) {
	req := hybridResourcesTestRequest()
	req.Resources = append(req.Resources, &resourcepb.HybridSearchResourcesRequest_Resource{
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

	response, err := s.HybridSearchResources(authedCtx(), req)
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
			SEARCH_FIELD_FOLDER:      "",
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

func TestHybridSearchResources_WithoutReranking(t *testing.T) {
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

			response, err := s.HybridSearchResources(authedCtx(), req)
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

func TestHybridSearchResources_CandidateBudgetIncludesEveryResource(t *testing.T) {
	req := hybridResourcesTestRequest()
	req.Limit = 100
	responses := make(map[schema.GroupResource]*resourcepb.ResourceSearchResponse)
	for _, resource := range req.Resources {
		rows := make([][3]string, 150)
		for i := range rows {
			rows[i] = [3]string{fmt.Sprintf("%s-%d", resource.Resource, i), fmt.Sprintf("%s %d", resource.Resource, i), ""}
		}
		responses[schema.GroupResource{Group: resource.Group, Resource: resource.Resource}] = lexFieldValueResponse(rows...)
	}
	s, _ := newHybridResourcesTestServer(responses)
	scorer := &fakeRerankScorer{}
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{})

	response, err := s.HybridSearchResources(authedCtx(), req)
	require.NoError(t, err)
	assert.Len(t, response.Results, 100)
	assert.Equal(t, 1, scorer.calls)
	require.Len(t, scorer.gotTexts, maxRerankCandidates)
	for i := 0; i < maxRerankCandidates/2; i++ {
		assert.Equal(t, fmt.Sprintf("dashboards %d", i), scorer.gotTexts[2*i])
		assert.Equal(t, fmt.Sprintf("folders %d", i), scorer.gotTexts[2*i+1])
	}
}

func TestHybridSearchResources_Validation(t *testing.T) {
	for _, test := range []struct {
		name   string
		change func(*resourcepb.HybridSearchResourcesRequest)
	}{
		{name: "missing namespace", change: func(r *resourcepb.HybridSearchResourcesRequest) { r.Namespace = "" }},
		{name: "missing resources", change: func(r *resourcepb.HybridSearchResourcesRequest) { r.Resources = nil }},
		{name: "nil resource", change: func(r *resourcepb.HybridSearchResourcesRequest) { r.Resources[0] = nil }},
		{name: "missing group", change: func(r *resourcepb.HybridSearchResourcesRequest) { r.Resources[0].Group = "" }},
		{name: "missing resource", change: func(r *resourcepb.HybridSearchResourcesRequest) { r.Resources[0].Resource = "" }},
		{name: "duplicate resource", change: func(r *resourcepb.HybridSearchResourcesRequest) { r.Resources = append(r.Resources, r.Resources[0]) }},
		{name: "too many resources", change: func(r *resourcepb.HybridSearchResourcesRequest) {
			r.Resources = make([]*resourcepb.HybridSearchResourcesRequest_Resource, 11)
			for i := range r.Resources {
				r.Resources[i] = &resourcepb.HybridSearchResourcesRequest_Resource{Group: "g", Resource: fmt.Sprintf("resource-%d", i)}
			}
		}},
		{name: "empty query", change: func(r *resourcepb.HybridSearchResourcesRequest) { r.Query = " " }},
		{name: "long query", change: func(r *resourcepb.HybridSearchResourcesRequest) { r.Query = strings.Repeat("q", 1001) }},
		{name: "empty semantic query", change: func(r *resourcepb.HybridSearchResourcesRequest) { r.SemanticQuery = " " }},
		{name: "invalid relevance", change: func(r *resourcepb.HybridSearchResourcesRequest) { r.MinRelevance = "invalid" }},
		{name: "threshold with skip", change: func(r *resourcepb.HybridSearchResourcesRequest) { r.MinRelevance, r.SkipRerank = "high", true }},
		{name: "nil filter", change: func(r *resourcepb.HybridSearchResourcesRequest) { r.Filters = []*resourcepb.Requirement{nil} }},
		{name: "resource specific filter", change: func(r *resourcepb.HybridSearchResourcesRequest) {
			r.Filters = []*resourcepb.Requirement{{Key: "language", Values: []string{"promql"}}}
		}},
		{name: "unsupported filter operator", change: func(r *resourcepb.HybridSearchResourcesRequest) {
			r.Filters = []*resourcepb.Requirement{{Key: "folder", Operator: "notin", Values: []string{"f"}}}
		}},
	} {
		t.Run(test.name, func(t *testing.T) {
			s, index := newHybridResourcesTestServer(nil)
			req := hybridResourcesTestRequest()
			test.change(req)
			response, err := s.HybridSearchResources(authedCtx(), req)
			require.Error(t, err)
			assert.Equal(t, codes.InvalidArgument, status.Code(err))
			assert.Nil(t, response)
			assert.Empty(t, index.requests)
		})
	}
	t.Run("nil request", func(t *testing.T) {
		s, _ := newHybridResourcesTestServer(nil)
		_, err := s.HybridSearchResources(authedCtx(), nil)
		assert.Equal(t, codes.InvalidArgument, status.Code(err))
	})
}

func TestHybridSearchResources_FailureDoesNotReturnPartialResults(t *testing.T) {
	s, index := newHybridResourcesTestServer(map[schema.GroupResource]*resourcepb.ResourceSearchResponse{
		{Group: "dashboard.grafana.app", Resource: "dashboards"}: lexFieldValueResponse([3]string{"d", "Dashboard", ""}),
	})
	index.errors[schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}] = status.Error(codes.Unavailable, "folder index unavailable")
	scorer := &fakeRerankScorer{}
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{})

	response, err := s.HybridSearchResources(authedCtx(), hybridResourcesTestRequest())
	require.Error(t, err)
	assert.Equal(t, codes.Unavailable, status.Code(err))
	assert.Nil(t, response)
	assert.Zero(t, scorer.calls)
}

func TestHybridSearchResources_RejectsUnauthenticatedAndCrossNamespaceRequests(t *testing.T) {
	for _, test := range []struct {
		name      string
		ctx       context.Context
		namespace string
		code      codes.Code
	}{
		{name: "unauthenticated", ctx: context.Background(), namespace: "ns", code: codes.Unauthenticated},
		{name: "different namespace", ctx: authedCtx(), namespace: "other-tenant", code: codes.PermissionDenied},
	} {
		t.Run(test.name, func(t *testing.T) {
			s, index := newHybridResourcesTestServer(nil)
			req := hybridResourcesTestRequest()
			req.Namespace = test.namespace
			_, err := s.HybridSearchResources(test.ctx, req)
			require.Error(t, err)
			assert.Equal(t, test.code, status.Code(err))
			assert.Empty(t, index.requests)
		})
	}
}

type hybridResourcesTestEmbedder struct {
	mu sync.Mutex
	fakeTextEmbedder
}

func (e *hybridResourcesTestEmbedder) EmbedText(ctx context.Context, input embedder.EmbedTextInput) (embedder.EmbedTextOutput, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.fakeTextEmbedder.EmbedText(ctx, input)
}

type hybridResourcesTestVectorBackend struct {
	vector.VectorBackend
}

func (hybridResourcesTestVectorBackend) ResolveCollection(_ context.Context, group, resource string) (vector.Collection, bool, error) {
	return vector.Collection{Group: group, Resource: resource, PartitionKey: resource}, true, nil
}

func (hybridResourcesTestVectorBackend) Search(_ context.Context, _, _, _ string, _ []float32, _ int, _ ...vector.SearchFilter) ([]vector.VectorSearchResult, error) {
	return []vector.VectorSearchResult{{UID: "same-name", Content: "Database details"}}, nil
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

func TestHybridSearchResources_SemanticAuthorizationUsesEachResourceType(t *testing.T) {
	s, _ := newHybridResourcesTestServer(nil)
	client := &hybridResourcesTestEmbedder{fakeTextEmbedder: fakeTextEmbedder{dim: 4}}
	s.embedder = newTestEmbedder(&client.fakeTextEmbedder)
	s.embedder.TextEmbedder = client
	s.vectorBackend = hybridResourcesTestVectorBackend{}
	s.collectionAllowlist = vector.NewCollectionAllowlist([]string{"dashboard.grafana.app/dashboards", "folder.grafana.app/folders"}, nil)
	access := &hybridResourcesTestAccess{AccessClient: authlib.FixedAccessClient(true)}
	s.access = access
	scorer := &fakeRerankScorer{}
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{})

	response, err := s.HybridSearchResources(authedCtx(), hybridResourcesTestRequest())
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
