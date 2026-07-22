package resource

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/rerank"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

func hybridKey() *resourcepb.ResourceKey {
	return &resourcepb.ResourceKey{Namespace: "ns", Group: "g", Resource: "r"}
}

func TestFuseRRF_OverlapRanksHighest(t *testing.T) {
	lex := []lexicalHit{
		{uid: "a", title: "A", folder: "f1"},
		{uid: "b", title: "B", folder: "f2"},
	}
	sem := []vector.VectorSearchResult{
		{UID: "c", Title: "C", Subresource: "panel/1", Content: "c1", Score: 0.1, Folder: "f3"},
		{UID: "a", Title: "A-stale", Subresource: "panel/2", Content: "a2", Score: 0.2, Metadata: []byte(`{"k":"v"}`)},
	}

	out := fuseRRF(hybridKey(), lex, sem)
	require.Len(t, out, 3)

	// dual-leg: lexical rank 1 + semantic rank 2
	assert.Equal(t, "a", out[0].Key.Name)
	assert.Equal(t, "ns", out[0].Key.Namespace)
	assert.Equal(t, "g", out[0].Key.Group)
	assert.Equal(t, "r", out[0].Key.Resource)
	assert.InDelta(t, 1.0/61+1.0/62, out[0].Score, 1e-12)
	// lexical title wins over the embeddings row's stale title
	assert.Equal(t, "A", out[0].Title)
	assert.Equal(t, "f1", out[0].Folder)
	require.Len(t, out[0].Chunks, 1)
	assert.Equal(t, "panel/2", out[0].Chunks[0].Subresource)
	assert.Equal(t, "a2", out[0].Chunks[0].Content)
	assert.Equal(t, []byte(`{"k":"v"}`), out[0].Chunks[0].Metadata)

	// single-leg rank-1: "c" (1/61) beats "b" (1/62)
	assert.Equal(t, "c", out[1].Key.Name)
	assert.Equal(t, "C", out[1].Title)
	assert.Equal(t, "f3", out[1].Folder)
	assert.Equal(t, "b", out[2].Key.Name)
}

func TestFuseRRF_GroupsChunksPerUID(t *testing.T) {
	sem := []vector.VectorSearchResult{
		{UID: "a", Subresource: "panel/1", Content: "best", Score: 0.1},
		{UID: "b", Subresource: "panel/2", Content: "b", Score: 0.3},
		{UID: "a", Subresource: "panel/9", Content: "second", Score: 0.5},
	}

	out := fuseRRF(hybridKey(), nil, sem)
	require.Len(t, out, 2)

	// "a" groups both chunks best-first; rank comes from the best chunk
	assert.Equal(t, "a", out[0].Key.Name)
	require.Len(t, out[0].Chunks, 2)
	assert.Equal(t, "panel/1", out[0].Chunks[0].Subresource)
	assert.Equal(t, "panel/9", out[0].Chunks[1].Subresource)
	assert.InDelta(t, 1.0/61, out[0].Score, 1e-12)

	// duplicate-uid chunks don't consume semantic ranks: "b" is rank 2
	assert.Equal(t, "b", out[1].Key.Name)
	assert.InDelta(t, 1.0/62, out[1].Score, 1e-12)
}

func TestFuseRRF_ChunkCap(t *testing.T) {
	sem := make([]vector.VectorSearchResult, 0, maxChunksPerHybridResult+5)
	for i := 0; i < maxChunksPerHybridResult+5; i++ {
		sem = append(sem, vector.VectorSearchResult{
			UID: "a", Subresource: fmt.Sprintf("panel/%d", i), Content: "c", Score: float64(i),
		})
	}
	out := fuseRRF(hybridKey(), nil, sem)
	require.Len(t, out, 1)
	assert.Len(t, out[0].Chunks, maxChunksPerHybridResult)
	assert.Equal(t, "panel/0", out[0].Chunks[0].Subresource)
}

func TestFuseRRF_LexicalOnlySynthesizesTitleChunk(t *testing.T) {
	lex := []lexicalHit{{uid: "a", title: "My Dashboard", folder: "f"}}
	out := fuseRRF(hybridKey(), lex, nil)
	require.Len(t, out, 1)
	require.Len(t, out[0].Chunks, 1)
	assert.Equal(t, "", out[0].Chunks[0].Subresource)
	assert.Equal(t, "My Dashboard", out[0].Chunks[0].Content)
	assert.Nil(t, out[0].Chunks[0].Metadata)
}

func TestFuseRRF_LexicalRootFolderNotOverwrittenByStaleSemanticFolder(t *testing.T) {
	// "" is the legacy root-folder value, not "unset": a dual-leg hit in
	// the root folder must keep it even when the embeddings row carries a
	// stale non-empty folder.
	lex := []lexicalHit{{uid: "a", title: "A", folder: ""}}
	sem := []vector.VectorSearchResult{
		{UID: "a", Title: "A-stale", Folder: "old-folder", Subresource: "panel/1", Content: "c", Score: 0.1},
	}

	out := fuseRRF(hybridKey(), lex, sem)
	require.Len(t, out, 1)
	assert.Equal(t, "", out[0].Folder)
	assert.Equal(t, "A", out[0].Title)

	// semantic-only hits still get their display fields from the
	// embeddings row
	out = fuseRRF(hybridKey(), nil, sem)
	require.Len(t, out, 1)
	assert.Equal(t, "old-folder", out[0].Folder)
	assert.Equal(t, "A-stale", out[0].Title)
}

func TestFuseRRF_SemanticOnlyTitlePrefersDashboardTitleMetadata(t *testing.T) {
	// Embeddings row titles are chunk-qualified ("Dashboard — Panel");
	// semantic-only hits should surface the resource-level title from
	// metadata when present.
	sem := []vector.VectorSearchResult{
		{UID: "a", Title: "Clean — Panel 5", Metadata: []byte(`{"dashboardTitle":"Clean"}`), Score: 0.1},
		{UID: "b", Title: "Fallback — Panel", Metadata: []byte(`{"other":"x"}`), Score: 0.2},
		{UID: "c", Title: "NoMeta — Panel", Score: 0.3},
	}

	out := fuseRRF(hybridKey(), nil, sem)
	require.Len(t, out, 3)
	assert.Equal(t, "Clean", out[0].Title)
	assert.Equal(t, "Fallback — Panel", out[1].Title)
	assert.Equal(t, "NoMeta — Panel", out[2].Title)
}

func TestFuseRRF_TieBreaksByName(t *testing.T) {
	lex := []lexicalHit{{uid: "z", title: "Z"}}
	sem := []vector.VectorSearchResult{{UID: "m", Title: "M", Score: 0.1}}
	out := fuseRRF(hybridKey(), lex, sem)
	require.Len(t, out, 2)
	assert.Equal(t, "m", out[0].Key.Name)
	assert.Equal(t, "z", out[1].Key.Name)
}

func TestFuseRRF_Empty(t *testing.T) {
	assert.Empty(t, fuseRRF(hybridKey(), nil, nil))
}

func lexTableResponse(rows ...[3]string) *resourcepb.ResourceSearchResponse {
	table := &resourcepb.ResourceTable{
		Columns: []*resourcepb.ResourceTableColumnDefinition{
			{Name: SEARCH_FIELD_TITLE, Type: resourcepb.ResourceTableColumnDefinition_STRING},
			{Name: SEARCH_FIELD_FOLDER, Type: resourcepb.ResourceTableColumnDefinition_STRING},
		},
	}
	for _, r := range rows {
		table.Rows = append(table.Rows, &resourcepb.ResourceTableRow{
			Key:   &resourcepb.ResourceKey{Name: r[0]},
			Cells: [][]byte{[]byte(r[1]), []byte(r[2])},
		})
	}
	return &resourcepb.ResourceSearchResponse{Results: table}
}

func TestLexicalHitsFromResponse(t *testing.T) {
	hits := lexicalHitsFromResponse(lexTableResponse(
		[3]string{"u1", "Title One", "f1"},
		[3]string{"u2", "Title Two", "f2"},
	))
	require.Len(t, hits, 2)
	assert.Equal(t, lexicalHit{uid: "u1", title: "Title One", folder: "f1"}, hits[0])
	assert.Equal(t, lexicalHit{uid: "u2", title: "Title Two", folder: "f2"}, hits[1])
}

func TestLexicalHitsFromResponse_MissingColumnsAndNil(t *testing.T) {
	assert.Empty(t, lexicalHitsFromResponse(nil))
	assert.Empty(t, lexicalHitsFromResponse(&resourcepb.ResourceSearchResponse{}))

	resp := &resourcepb.ResourceSearchResponse{Results: &resourcepb.ResourceTable{
		Rows: []*resourcepb.ResourceTableRow{{Key: &resourcepb.ResourceKey{Name: "u1"}}},
	}}
	hits := lexicalHitsFromResponse(resp)
	require.Len(t, hits, 1)
	assert.Equal(t, lexicalHit{uid: "u1"}, hits[0])
}

func TestValidateHybridSearchRequest(t *testing.T) {
	valid := func() *resourcepb.HybridSearchRequest {
		return &resourcepb.HybridSearchRequest{Key: hybridKey(), Query: "q"}
	}

	assert.Nil(t, validateHybridSearchRequest(valid()))

	r := valid()
	r.Key = nil
	require.NotNil(t, validateHybridSearchRequest(r))

	r = valid()
	r.Query = "  "
	require.NotNil(t, validateHybridSearchRequest(r))

	r = valid()
	r.Query = strings.Repeat("x", 1001)
	require.NotNil(t, validateHybridSearchRequest(r))

	r = valid()
	r.SemanticQuery = strings.Repeat("x", 1001)
	require.NotNil(t, validateHybridSearchRequest(r))

	// All validation failures are InvalidArgument status errors, never
	// response-embedded.
	wantInvalid := func(err error, contains string) {
		t.Helper()
		require.Error(t, err)
		assert.Equal(t, codes.InvalidArgument, status.Code(err))
		assert.Contains(t, err.Error(), contains)
	}

	r = valid()
	r.Filters = []*resourcepb.Requirement{{Key: "tags", Operator: "in", Values: []string{"prod"}}}
	wantInvalid(validateHybridSearchRequest(r), "tags")

	r = valid()
	r.Filters = []*resourcepb.Requirement{{Key: "uid", Operator: "in"}}
	wantInvalid(validateHybridSearchRequest(r), "no values")

	r = valid()
	r.Filters = []*resourcepb.Requirement{{Key: "uid", Operator: "notin", Values: []string{"u1"}}}
	wantInvalid(validateHybridSearchRequest(r), "operator")

	r = valid()
	r.SemanticQuery = "   "
	wantInvalid(validateHybridSearchRequest(r), "whitespace")

	r = valid()
	r.Filters = []*resourcepb.Requirement{
		{Key: "uid", Operator: "in", Values: []string{"u1"}},
		{Key: "uid", Operator: "in", Values: []string{"u2"}},
	}
	wantInvalid(validateHybridSearchRequest(r), "duplicate")

	r = valid()
	r.Key.Resource = "dashboards"
	r.Filters = []*resourcepb.Requirement{{Key: "language", Operator: "in", Values: []string{"promql", "cypher"}}}
	wantInvalid(validateHybridSearchRequest(r), "cypher")

	r = valid()
	r.Filters = []*resourcepb.Requirement{{Key: "datasource_uid", Operator: "in", Values: []string{"d"}}}
	wantInvalid(validateHybridSearchRequest(r), "dashboards")

	r = valid()
	r.Key.Resource = "dashboards"
	r.Filters = []*resourcepb.Requirement{
		{Key: "uid", Operator: "in", Values: []string{"u"}},
		{Key: "folder", Operator: "in", Values: []string{"f"}},
		{Key: "datasource_uid", Operator: "in", Values: []string{"d"}},
		{Key: "language", Operator: "in", Values: []string{"promql"}},
	}
	assert.Nil(t, validateHybridSearchRequest(r))

	r = valid()
	r.MinRelevance = "low"
	assert.Nil(t, validateHybridSearchRequest(r))

	r = valid()
	r.MinRelevance = ""
	assert.Nil(t, validateHybridSearchRequest(r))

	r = valid()
	r.MinRelevance = "med"
	wantInvalid(validateHybridSearchRequest(r), "unsupported min_relevance")

	r = valid()
	r.MinRelevance = "0.5"
	wantInvalid(validateHybridSearchRequest(r), "unsupported min_relevance")

	r = valid()
	r.SkipRerank = true
	assert.Nil(t, validateHybridSearchRequest(r))

	r = valid()
	r.SkipRerank = true
	r.MinRelevance = "low"
	wantInvalid(validateHybridSearchRequest(r), "min_relevance cannot be combined with skip_rerank")
}

func TestHybridLexicalRequest(t *testing.T) {
	req := &resourcepb.HybridSearchRequest{
		Key:   hybridKey(),
		Query: "cpu",
		Filters: []*resourcepb.Requirement{
			{Key: "uid", Operator: "in", Values: []string{"u1"}},
			{Key: "folder", Operator: "in", Values: []string{"f1"}},
			{Key: "datasource_uid", Operator: "in", Values: []string{"ds1"}},
			{Key: "language", Operator: "in", Values: []string{"promql", "logql"}},
		},
	}
	out := hybridLexicalRequest(req, 40)

	assert.Equal(t, "cpu", out.Query)
	assert.Equal(t, int64(40), out.Limit)
	assert.Same(t, req.Key, out.Options.Key)
	assert.Equal(t, []string{SEARCH_FIELD_TITLE, SEARCH_FIELD_FOLDER}, out.Fields)

	require.Len(t, out.Options.Fields, 4)
	assert.Equal(t, SEARCH_FIELD_NAME, out.Options.Fields[0].Key)
	assert.Equal(t, []string{"u1"}, out.Options.Fields[0].Values)
	assert.Equal(t, SEARCH_FIELD_FOLDER, out.Options.Fields[1].Key)
	assert.Equal(t, "reference.DataSource", out.Options.Fields[2].Key)
	assert.Equal(t, []string{"ds1"}, out.Options.Fields[2].Values)
	assert.Equal(t, SEARCH_FIELD_PREFIX+"ds_types", out.Options.Fields[3].Key)
	want := append(append([]string{}, languageToDSTypes["promql"]...), languageToDSTypes["logql"]...)
	assert.ElementsMatch(t, want, out.Options.Fields[3].Values)
}

func TestHybridVectorFilters(t *testing.T) {
	filters := hybridVectorFilters([]*resourcepb.Requirement{
		{Key: "uid", Operator: "in", Values: []string{"u1"}},
		{Key: "folder", Operator: "in", Values: []string{"f1"}},
		{Key: "datasource_uid", Operator: "in", Values: []string{"ds1", "ds2"}},
		{Key: "language", Operator: "in", Values: []string{"promql"}},
	})
	require.Len(t, filters, 4)
	assert.Equal(t, vector.SearchFilter{Field: "uid", Values: []string{"u1"}}, filters[0])
	assert.Equal(t, vector.SearchFilter{Field: "folder", Values: []string{"f1"}}, filters[1])
	assert.Equal(t, vector.SearchFilter{Field: "datasourceUid", Values: []string{"ds1", "ds2"}}, filters[2])
	assert.Equal(t, vector.SearchFilter{Field: "language", Values: []string{"promql"}}, filters[3])
}

func TestHybridVectorFilters_RootFolderSentinels(t *testing.T) {
	// filtering by either root sentinel must match rows stored with the other
	f := hybridVectorFilters([]*resourcepb.Requirement{
		{Key: "folder", Operator: "in", Values: []string{"general"}},
	})
	require.Len(t, f, 1)
	assert.ElementsMatch(t, []string{"general", ""}, f[0].Values)

	f = hybridVectorFilters([]*resourcepb.Requirement{
		{Key: "folder", Operator: "in", Values: []string{"", "f1"}},
	})
	require.Len(t, f, 1)
	assert.ElementsMatch(t, []string{"", "f1", "general"}, f[0].Values)

	f = hybridVectorFilters([]*resourcepb.Requirement{
		{Key: "folder", Operator: "in", Values: []string{"f1"}},
	})
	require.Len(t, f, 1)
	assert.Equal(t, []string{"f1"}, f[0].Values)
}

func TestHybridFetchDepth(t *testing.T) {
	assert.Equal(t, 20, hybridFetchDepth(10))
	assert.Equal(t, 200, hybridFetchDepth(150))
}

type fakeSearchBackend struct {
	idx ResourceIndex
}

func (f *fakeSearchBackend) LoadOpenIndexStats(time.Time, time.Duration) ([]ResourceStats, error) {
	return nil, nil
}
func (f *fakeSearchBackend) WriteOpenIndexStats(time.Time) error       { return nil }
func (f *fakeSearchBackend) GetIndex(NamespacedResource) ResourceIndex { return f.idx }
func (f *fakeSearchBackend) TotalDocs() int64                          { return 0 }
func (f *fakeSearchBackend) GetOpenIndexes() []NamespacedResource      { return nil }
func (f *fakeSearchBackend) Stop()                                     {}
func (f *fakeSearchBackend) BuildIndex(context.Context, NamespacedResource, int64, string, BuildFn, UpdateFn, bool, time.Time, time.Duration) (ResourceIndex, error) {
	return f.idx, nil
}

type hybridFakeIndex struct {
	MockResourceIndex
	mu     sync.Mutex
	resp   *resourcepb.ResourceSearchResponse
	err    error
	gotReq *resourcepb.ResourceSearchRequest
}

func (h *hybridFakeIndex) Search(_ context.Context, _ authlib.AccessClient, req *resourcepb.ResourceSearchRequest, _ []ResourceIndex, _ *SearchStats) (*resourcepb.ResourceSearchResponse, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.gotReq = req
	return h.resp, h.err
}

func newHybridTestServer(lexResp *resourcepb.ResourceSearchResponse, backend *fakeVectorBackend, access ...authlib.AccessClient) (*searchServer, *hybridFakeIndex, *fakeTextEmbedder) {
	idx := &hybridFakeIndex{resp: lexResp}
	emb := &fakeTextEmbedder{dim: 4}
	s := newTestSearchServer(newTestEmbedder(emb), backend, access...)
	s.search = &fakeSearchBackend{idx: idx}
	if s.vectorMetrics == nil {
		s.vectorMetrics = ProvideVectorMetrics(prometheus.NewRegistry())
	}
	return s, idx, emb
}

func TestHybridSearch_FusesBothLegs(t *testing.T) {
	lexResp := lexTableResponse(
		[3]string{"both", "Both Legs", "f1"},
		[3]string{"lexonly", "Lex Only", "f2"},
	)
	backend := &fakeVectorBackend{
		results: []vector.VectorSearchResult{
			{UID: "semonly", Title: "Sem Only", Subresource: "panel/1", Content: "s1", Score: 0.1, Folder: "f3"},
			{UID: "both", Title: "Both Legs", Subresource: "panel/2", Content: "b2", Score: 0.2, Folder: "f1"},
		},
	}
	s, idx, _ := newHybridTestServer(lexResp, backend)

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "api latency", Limit: 10,
	})
	require.NoError(t, err)
	require.Len(t, resp.Results, 3)

	assert.Equal(t, "both", resp.Results[0].Key.Name)
	assert.InDelta(t, 1.0/61+1.0/62, resp.Results[0].Score, 1e-12)
	require.Len(t, resp.Results[0].Chunks, 1)
	assert.Equal(t, "panel/2", resp.Results[0].Chunks[0].Subresource)

	// lexical-only hit carries a synthesized title chunk
	for _, r := range resp.Results {
		if r.Key.Name == "lexonly" {
			require.Len(t, r.Chunks, 1)
			assert.Equal(t, "Lex Only", r.Chunks[0].Content)
		}
	}

	idx.mu.Lock()
	assert.Equal(t, "api latency", idx.gotReq.Query)
	assert.Equal(t, int64(20), idx.gotReq.Limit)
	idx.mu.Unlock()
	assert.Equal(t, 20, backend.gotLimit)
}

func TestHybridSearch_SemanticQueryOverridesEmbedText(t *testing.T) {
	s, _, emb := newHybridTestServer(lexTableResponse(), &fakeVectorBackend{})

	_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "cpu", SemanticQuery: "cpu utilization by host",
	})
	require.NoError(t, err)
	require.Len(t, emb.gotIn.Texts, 1)
	assert.Equal(t, "cpu utilization by host", emb.gotIn.Texts[0])
}

func TestHybridSearch_FiltersReachBothLegs(t *testing.T) {
	backend := &fakeVectorBackend{}
	s, idx, _ := newHybridTestServer(lexTableResponse(), backend)

	key := validKey()
	key.Resource = "dashboards"
	_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: key, Query: "q",
		Filters: []*resourcepb.Requirement{
			{Key: "uid", Operator: "in", Values: []string{"u1"}},
			{Key: "folder", Operator: "in", Values: []string{"f1"}},
			{Key: "datasource_uid", Operator: "in", Values: []string{"ds1"}},
			{Key: "language", Operator: "in", Values: []string{"promql"}},
		},
	})
	require.NoError(t, err)

	idx.mu.Lock()
	require.Len(t, idx.gotReq.Options.Fields, 4)
	assert.Equal(t, SEARCH_FIELD_NAME, idx.gotReq.Options.Fields[0].Key)
	assert.Equal(t, SEARCH_FIELD_FOLDER, idx.gotReq.Options.Fields[1].Key)
	assert.Equal(t, "reference.DataSource", idx.gotReq.Options.Fields[2].Key)
	assert.Equal(t, SEARCH_FIELD_PREFIX+"ds_types", idx.gotReq.Options.Fields[3].Key)
	assert.Equal(t, languageToDSTypes["promql"], idx.gotReq.Options.Fields[3].Values)
	assert.Contains(t, idx.gotReq.Options.Fields[3].Values, "prometheus")
	idx.mu.Unlock()

	require.Len(t, backend.gotFilters, 4)
	assert.Equal(t, "uid", backend.gotFilters[0].Field)
	assert.Equal(t, "folder", backend.gotFilters[1].Field)
	assert.Equal(t, "datasourceUid", backend.gotFilters[2].Field)
	assert.Equal(t, vector.SearchFilter{Field: "language", Values: []string{"promql"}}, backend.gotFilters[3])
}

func TestHybridSearch_SemanticAuthzDenied(t *testing.T) {
	backend := &fakeVectorBackend{
		results: []vector.VectorSearchResult{
			{UID: "denied", Title: "Denied", Score: 0.1, Folder: "f1"},
		},
	}
	s, _, _ := newHybridTestServer(lexTableResponse(), backend, authlib.FixedAccessClient(false))

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.NoError(t, err)
	assert.Empty(t, resp.Results)
}

func TestHybridSearch_LimitTruncates(t *testing.T) {
	lexResp := lexTableResponse(
		[3]string{"a", "A", "f"}, [3]string{"b", "B", "f"}, [3]string{"c", "C", "f"},
	)
	s, _, _ := newHybridTestServer(lexResp, &fakeVectorBackend{})

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q", Limit: 2,
	})
	require.NoError(t, err)
	require.Len(t, resp.Results, 2)
	assert.Equal(t, "a", resp.Results[0].Key.Name)
}

func TestHybridSearch_NotConfigured(t *testing.T) {
	s := newTestSearchServer(nil, nil)
	_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{Key: validKey(), Query: "q"})
	require.Error(t, err)
	assert.Equal(t, codes.Unimplemented, status.Code(err))
}

func TestHybridSearch_ValidationErrorsAreInvalidArgument(t *testing.T) {
	s, _, _ := newHybridTestServer(lexTableResponse(), &fakeVectorBackend{})

	_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{Query: "q"})
	require.Error(t, err)
	assert.Equal(t, codes.InvalidArgument, status.Code(err))

	_, err = s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
		Filters: []*resourcepb.Requirement{{Key: "tags", Operator: "in", Values: []string{"x"}}},
	})
	require.Error(t, err)
	assert.Equal(t, codes.InvalidArgument, status.Code(err))
}

func TestHybridSearch_LexicalLegFailureFailsRequest(t *testing.T) {
	backend := &fakeVectorBackend{}
	s, idx, _ := newHybridTestServer(lexTableResponse(), backend)
	idx.err = fmt.Errorf("index exploded")

	_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.Error(t, err)
	assert.Equal(t, codes.Internal, status.Code(err))
}

// recordingRateLimiter satisfies vector.RateLimiter and records whether it
// was consulted.
type recordingRateLimiter struct {
	called bool
}

func (r *recordingRateLimiter) Allow(context.Context, string, time.Duration, int) (bool, int64, error) {
	r.called = true
	return true, 1, nil
}

func (r *recordingRateLimiter) SweepOlderThan(context.Context, time.Time) (int64, error) {
	return 0, nil
}

func TestHybridSearch_UnauthenticatedDoesNotConsumeRateBudget(t *testing.T) {
	limiter := &recordingRateLimiter{}
	s, _, _ := newHybridTestServer(lexTableResponse(), &fakeVectorBackend{})
	s.rateLimiter = limiter
	s.rateLimitPerTenant = 100
	s.rateLimitWindow = time.Minute

	_, err := s.HybridSearch(context.Background(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.Error(t, err)
	assert.Equal(t, codes.Unauthenticated, status.Code(err))
	assert.False(t, limiter.called, "unauthenticated request must not consume rate budget")
}

func TestHybridSearch_CallerCancellationReturnsCanceled(t *testing.T) {
	// A canceled caller context maps to Canceled regardless of which leg
	// failed or how it wrapped the error.
	backend := &fakeVectorBackend{err: fmt.Errorf("pgvector: %w", context.Canceled)}
	s, idx, _ := newHybridTestServer(lexTableResponse(), backend)
	idx.err = fmt.Errorf("bleve: %w", context.Canceled)

	_, err := s.HybridSearch(canceledAuthedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.Error(t, err)
	assert.Equal(t, codes.Canceled, status.Code(err))
}

func TestHybridSearch_DownstreamCanceledWithLiveContextReturnsInternal(t *testing.T) {
	// A downstream cancellation while the caller is still live is a
	// server-side fault, not a client disconnect.
	backend := &fakeVectorBackend{err: fmt.Errorf("pgvector: %w", context.Canceled)}
	s, _, _ := newHybridTestServer(lexTableResponse(), backend)

	_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.Error(t, err)
	assert.Equal(t, codes.Internal, status.Code(err))
}

func TestHybridSearch_DownstreamCanceledStatusWithLiveContextReturnsInternal(t *testing.T) {
	// gRPC-backed calls inside a leg surface cancellation as a status
	// error whose code survives %w wrapping — with a live caller it must
	// still classify as Internal, not leak Canceled into the response.
	backend := &fakeVectorBackend{}
	s, idx, _ := newHybridTestServer(lexTableResponse(), backend)
	idx.err = fmt.Errorf("storage list: %w", status.Error(codes.Canceled, "context canceled"))

	_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.Error(t, err)
	assert.Equal(t, codes.Internal, status.Code(err))
}

func TestHybridSearch_VectorLegFailureFailsRequest(t *testing.T) {
	backend := &fakeVectorBackend{err: fmt.Errorf("pgvector exploded")}
	s, _, _ := newHybridTestServer(lexTableResponse(), backend)

	_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.Error(t, err)
	assert.Equal(t, codes.Internal, status.Code(err))
}

type fakeRerankScorer struct {
	mu       sync.Mutex
	scores   []float64
	err      error
	gotQ     string
	gotTexts []string
	calls    int
}

func (f *fakeRerankScorer) Score(_ context.Context, query string, texts []string) ([]float64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls++
	f.gotQ, f.gotTexts = query, texts
	if f.err != nil {
		return nil, f.err
	}
	if f.scores != nil {
		return f.scores, nil
	}
	out := make([]float64, len(texts))
	return out, nil
}

func rerankTestReranker(s rerank.Scorer, thresholds rerank.RelevanceThresholds) *rerank.Reranker {
	return &rerank.Reranker{Scorer: s, Model: "test/model", Thresholds: thresholds}
}

type cancelingScorer struct{ cancel context.CancelFunc }

func (c *cancelingScorer) Score(ctx context.Context, _ string, _ []string) ([]float64, error) {
	c.cancel()
	return nil, ctx.Err()
}

func TestHybridSearch_RerankReordersAndOverwritesScores(t *testing.T) {
	lexResp := lexTableResponse(
		[3]string{"first", "First", "f"},
		[3]string{"second", "Second", "f"},
	)
	s, _, _ := newHybridTestServer(lexResp, &fakeVectorBackend{})
	// RRF order: first, second. Rerank flips it.
	scorer := &fakeRerankScorer{scores: []float64{0.1, 0.9}}
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{})

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.NoError(t, err)
	require.Len(t, resp.Results, 2)
	assert.Equal(t, "second", resp.Results[0].Key.Name)
	assert.Equal(t, 0.9, resp.Results[0].Score)
	assert.Equal(t, "first", resp.Results[1].Key.Name)
	assert.Equal(t, 0.1, resp.Results[1].Score)
	// scorer got the synthesized title chunks as documents, in RRF order
	assert.Equal(t, []string{"First", "Second"}, scorer.gotTexts)
}

func TestHybridSearch_RerankUsesSemanticQueryForScoring(t *testing.T) {
	s, _, _ := newHybridTestServer(lexTableResponse([3]string{"a", "A", "f"}), &fakeVectorBackend{})
	scorer := &fakeRerankScorer{}
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{})

	_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "short", SemanticQuery: "rich semantic phrasing",
	})
	require.NoError(t, err)
	assert.Equal(t, "rich semantic phrasing", scorer.gotQ)
}

func TestHybridSearch_MinRelevanceDropsBelowThreshold(t *testing.T) {
	lexResp := lexTableResponse(
		[3]string{"keep", "Keep", "f"},
		[3]string{"drop", "Drop", "f"},
	)
	s, _, _ := newHybridTestServer(lexResp, &fakeVectorBackend{})
	scorer := &fakeRerankScorer{scores: []float64{0.5, 0.05}}
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{Low: 0.1, High: 0.6})

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q", MinRelevance: "low",
	})
	require.NoError(t, err)
	require.Len(t, resp.Results, 1)
	assert.Equal(t, "keep", resp.Results[0].Key.Name)

	// "high" (0.6) drops both
	resp, err = s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q", MinRelevance: "high",
	})
	require.NoError(t, err)
	assert.Empty(t, resp.Results)
}

func TestHybridSearch_MinRelevanceNoopWhenUncalibrated(t *testing.T) {
	s, _, _ := newHybridTestServer(lexTableResponse([3]string{"a", "A", "f"}), &fakeVectorBackend{})
	scorer := &fakeRerankScorer{scores: []float64{0.0001}}
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{}) // uncalibrated

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q", MinRelevance: "highest",
	})
	require.NoError(t, err)
	assert.Len(t, resp.Results, 1)
}

func TestHybridSearch_MinRelevanceNoopWithoutReranker(t *testing.T) {
	s, _, _ := newHybridTestServer(lexTableResponse([3]string{"a", "A", "f"}), &fakeVectorBackend{})
	// s.reranker stays nil
	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q", MinRelevance: "high",
	})
	require.NoError(t, err)
	assert.Len(t, resp.Results, 1)
	// RRF score preserved
	assert.InDelta(t, 1.0/61, resp.Results[0].Score, 1e-12)
}

func TestHybridSearch_SkipRerankBypassesConfiguredReranker(t *testing.T) {
	s, _, _ := newHybridTestServer(lexTableResponse([3]string{"a", "A", "f"}), &fakeVectorBackend{})
	scorer := &fakeRerankScorer{scores: []float64{0.9}}
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{Low: 0.1})

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q", SkipRerank: true,
	})
	require.NoError(t, err)
	require.Len(t, resp.Results, 1)
	assert.Equal(t, 0, scorer.calls, "scorer must not be called when skip_rerank is set")
	// RRF score preserved, not the scorer's 0.9
	assert.InDelta(t, 1.0/61, resp.Results[0].Score, 1e-12)
}

func TestHybridSearch_RerankFailureFallsBackToRRFOrder(t *testing.T) {
	lexResp := lexTableResponse(
		[3]string{"first", "First", "f"},
		[3]string{"second", "Second", "f"},
	)
	s, _, _ := newHybridTestServer(lexResp, &fakeVectorBackend{})
	scorer := &fakeRerankScorer{err: errors.New("provider exploded")}
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{Low: 0.1})

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q", MinRelevance: "low",
	})
	require.NoError(t, err)
	// fail-open: RRF ordering, nothing dropped
	require.Len(t, resp.Results, 2)
	assert.Equal(t, "first", resp.Results[0].Key.Name)
	assert.InDelta(t, 1.0/61, resp.Results[0].Score, 1e-12)
}

func TestHybridSearch_RerankTimeoutFallsBack(t *testing.T) {
	s, _, _ := newHybridTestServer(lexTableResponse([3]string{"a", "A", "f"}), &fakeVectorBackend{})
	scorer := &fakeRerankScorer{err: rerank.ErrCallTimeout}
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{})

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.NoError(t, err)
	assert.Len(t, resp.Results, 1)
	assert.InDelta(t, 1.0/61, resp.Results[0].Score, 1e-12)
}

func TestHybridSearch_RerankScoreLengthMismatchFallsBack(t *testing.T) {
	lexResp := lexTableResponse(
		[3]string{"first", "First", "f"},
		[3]string{"second", "Second", "f"},
	)
	s, _, _ := newHybridTestServer(lexResp, &fakeVectorBackend{})
	scorer := &fakeRerankScorer{scores: []float64{0.9}} // 1 score for 2 results
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{})

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.NoError(t, err)
	require.Len(t, resp.Results, 2)
	assert.Equal(t, "first", resp.Results[0].Key.Name)
	assert.InDelta(t, 1.0/61, resp.Results[0].Score, 1e-12)
}

func TestHybridSearch_RerankRunsBeforeLimitTruncation(t *testing.T) {
	// 3 candidates, limit 2. RRF rank 3 gets the best rerank score and
	// must appear in the final top-2 — proving rerank happens pre-truncation.
	lexResp := lexTableResponse(
		[3]string{"r1", "R1", "f"},
		[3]string{"r2", "R2", "f"},
		[3]string{"r3", "R3", "f"},
	)
	s, _, _ := newHybridTestServer(lexResp, &fakeVectorBackend{})
	scorer := &fakeRerankScorer{scores: []float64{0.1, 0.2, 0.9}}
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{})

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q", Limit: 2,
	})
	require.NoError(t, err)
	require.Len(t, resp.Results, 2)
	assert.Equal(t, "r3", resp.Results[0].Key.Name)
	assert.Equal(t, "r2", resp.Results[1].Key.Name)
}

func TestHybridSearch_RerankCallerCancellationPropagates(t *testing.T) {
	s, _, _ := newHybridTestServer(lexTableResponse([3]string{"a", "A", "f"}), &fakeVectorBackend{})
	ctx, cancel := context.WithCancel(authedCtx())
	scorer := &cancelingScorer{cancel: cancel}
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{})

	_, err := s.HybridSearch(ctx, &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.Error(t, err)
	assert.Equal(t, codes.Canceled, status.Code(err))
}

func TestHybridSearch_RerankPoolTruncatedToMaxCandidates(t *testing.T) {
	// 200 lexical + 150 disjoint semantic hits fuse into 350 candidates —
	// past the Vertex 200-record cap — so the scorer must only ever see
	// maxRerankCandidates texts.
	rows := make([][3]string, 200)
	for i := 0; i < 200; i++ {
		rows[i] = [3]string{fmt.Sprintf("lex-%03d", i), fmt.Sprintf("Lex %03d", i), "f"}
	}
	lexResp := lexTableResponse(rows...)

	sem := make([]vector.VectorSearchResult, 150)
	for i := 0; i < 150; i++ {
		sem[i] = vector.VectorSearchResult{
			UID: fmt.Sprintf("sem-%03d", i), Title: fmt.Sprintf("Sem %03d", i),
			Content: "c", Score: float64(i), Folder: "f",
		}
	}
	backend := &fakeVectorBackend{results: sem}

	s, _, _ := newHybridTestServer(lexResp, backend)
	scorer := &fakeRerankScorer{}
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{})

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q", Limit: 200,
	})
	require.NoError(t, err)
	assert.Len(t, scorer.gotTexts, maxRerankCandidates)
	assert.Len(t, resp.Results, maxRerankCandidates)
}

func TestHybridSearch_RerankFallbackThenLimitTruncates(t *testing.T) {
	lexResp := lexTableResponse(
		[3]string{"first", "First", "f"},
		[3]string{"second", "Second", "f"},
	)
	s, _, _ := newHybridTestServer(lexResp, &fakeVectorBackend{})
	scorer := &fakeRerankScorer{err: errors.New("provider exploded")}
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{})

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q", Limit: 1,
	})
	require.NoError(t, err)
	require.Len(t, resp.Results, 1)
	// fail-open RRF order, then limit truncation keeps rank-1
	assert.Equal(t, "first", resp.Results[0].Key.Name)
	assert.InDelta(t, 1.0/61, resp.Results[0].Score, 1e-12)
}

func TestHybridSearch_RerankSubstitutesNameForEmptyTitle(t *testing.T) {
	lexResp := lexTableResponse([3]string{"noname", "", "f"})
	s, _, _ := newHybridTestServer(lexResp, &fakeVectorBackend{})
	scorer := &fakeRerankScorer{}
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{})

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.NoError(t, err)
	require.Len(t, resp.Results, 1)
	require.Len(t, scorer.gotTexts, 1)
	// an empty title synthesizes an empty chunk; the resource name is the
	// only text left to score with, instead of a 400-inducing empty doc.
	assert.Equal(t, "noname", scorer.gotTexts[0])
}
