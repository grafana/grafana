package resource

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

// fakeTextEmbedder returns a deterministic fixed-length vector for any
// input, plus an optional injected error. Matches embedder.TextEmbedder.
type fakeTextEmbedder struct {
	dim     int
	wantErr error
	gotIn   embedder.EmbedTextInput
}

func (f *fakeTextEmbedder) EmbedText(_ context.Context, in embedder.EmbedTextInput) (embedder.EmbedTextOutput, error) {
	f.gotIn = in
	if f.wantErr != nil {
		return embedder.EmbedTextOutput{}, f.wantErr
	}
	out := make([]embedder.Embedding, len(in.Texts))
	for i := range in.Texts {
		v := make([]float32, f.dim)
		v[0] = 1
		out[i] = embedder.Embedding{Dense: v}
	}
	return embedder.EmbedTextOutput{Embeddings: out}, nil
}

func newTestEmbedder(client *fakeTextEmbedder) *embedder.Embedder {
	return &embedder.Embedder{
		TextEmbedder: client,
		Model:        "test/model-1",
		VectorType:   embedder.VectorTypeDense,
		Metric:       embedder.CosineDistance,
		Dimensions:   uint32(client.dim),
		Normalized:   true,
	}
}

// fakeVectorBackend records the Search call and returns canned results.
// Other VectorBackend methods are stubbed to keep the test focused on
// the search path.
type fakeVectorBackend struct {
	gotNamespace, gotModel, gotResource string
	gotEmbedding                        []float32
	gotLimit                            int
	gotFilters                          []vector.SearchFilter
	results                             []vector.VectorSearchResult
	err                                 error
}

func (f *fakeVectorBackend) Search(_ context.Context, namespace, model, resource string,
	embedding []float32, limit int, filters ...vector.SearchFilter,
) ([]vector.VectorSearchResult, error) {
	f.gotNamespace = namespace
	f.gotModel = model
	f.gotResource = resource
	f.gotEmbedding = embedding
	f.gotLimit = limit
	f.gotFilters = filters
	return f.results, f.err
}

// stub the rest of VectorBackend; not exercised by these tests.
func (f *fakeVectorBackend) Upsert(context.Context, []vector.Vector) error { return nil }
func (f *fakeVectorBackend) Delete(context.Context, string, string, string, string) error {
	return nil
}
func (f *fakeVectorBackend) DeleteSubresources(context.Context, string, string, string, string, []string) error {
	return nil
}
func (f *fakeVectorBackend) GetSubresourceContent(context.Context, string, string, string, string) (map[string]string, error) {
	return nil, nil
}
func (f *fakeVectorBackend) GetLatestRV(context.Context) (int64, error) { return 0, nil }
func (f *fakeVectorBackend) Run(context.Context) error                  { return nil }

// newTestSearchServer builds a searchServer with just the fields the
// VectorSearch handler needs, skipping all of newSearchServer's larger
// initialization (which requires a SearchBackend, blob storage, etc.).
// access defaults to FixedAccessClient(true) — pass a custom AccessClient
// to exercise authz filtering.
func newTestSearchServer(emb *embedder.Embedder, backend vector.VectorBackend, access ...authlib.AccessClient) *searchServer {
	ac := authlib.AccessClient(authlib.FixedAccessClient(true))
	if len(access) > 0 && access[0] != nil {
		ac = access[0]
	}
	return &searchServer{
		log:           log.New("test"),
		vectorBackend: backend,
		embedder:      emb,
		access:        ac,
	}
}

// authedCtx returns a context with a static user — required by the
// VectorSearch handler's AuthInfoFrom check.
func authedCtx() context.Context {
	return authlib.WithAuthInfo(context.Background(),
		&identity.StaticRequester{UserID: 1, UserUID: "u", Type: authlib.TypeUser},
	)
}

func validKey() *resourcepb.ResourceKey {
	return &resourcepb.ResourceKey{Namespace: "ns", Group: "g", Resource: "r"}
}

func TestVectorSearch_HappyPath(t *testing.T) {
	emb := newTestEmbedder(&fakeTextEmbedder{dim: 4})
	backend := &fakeVectorBackend{
		results: []vector.VectorSearchResult{
			{UID: "u1", Title: "T1", Subresource: "panel/1", Content: "c1", Score: 0.05, Folder: "f1", Metadata: []byte(`{"k":"v"}`)},
			{UID: "u2", Title: "T2", Subresource: "panel/2", Content: "c2", Score: 0.20, Folder: "f1"},
		},
	}
	s := newTestSearchServer(emb, backend)

	resp, err := s.VectorSearch(authedCtx(), &resourcepb.VectorSearchRequest{
		Key:   validKey(),
		Query: "api latency",
		Limit: 10,
	})
	require.NoError(t, err)
	require.NotNil(t, resp)
	assert.Nil(t, resp.Error)
	require.Len(t, resp.Results, 2)

	// Results map fields one-for-one and pass Score through unchanged.
	assert.Equal(t, "u1", resp.Results[0].Name)
	assert.Equal(t, "T1", resp.Results[0].Title)
	assert.Equal(t, "panel/1", resp.Results[0].Subresource)
	assert.Equal(t, "c1", resp.Results[0].Content)
	assert.Equal(t, 0.05, resp.Results[0].Score)
	assert.Equal(t, "f1", resp.Results[0].Folder)
	assert.JSONEq(t, `{"k":"v"}`, string(resp.Results[0].Metadata))

	// Order preserved (ascending distance — backend already returned in order).
	assert.Equal(t, "u2", resp.Results[1].Name)
	assert.Equal(t, 0.20, resp.Results[1].Score)

	// Backend was called with the right context fields.
	assert.Equal(t, "ns", backend.gotNamespace)
	assert.Equal(t, "test/model-1", backend.gotModel)
	assert.Equal(t, "r", backend.gotResource)
	assert.Equal(t, 10, backend.gotLimit)
}

func TestVectorSearch_ScoreUnchanged_NoConversion(t *testing.T) {
	// Prove that Score on the wire is the raw cosine distance from the
	// backend, NOT 1 - distance. grafana-assistant-app's RAG pipeline
	// depends on this.
	backend := &fakeVectorBackend{
		results: []vector.VectorSearchResult{{UID: "u", Title: "t", Score: 0.42}},
	}
	s := newTestSearchServer(newTestEmbedder(&fakeTextEmbedder{dim: 4}), backend)
	resp, err := s.VectorSearch(authedCtx(), &resourcepb.VectorSearchRequest{
		Key: validKey(), Query: "q", Limit: 1,
	})
	require.NoError(t, err)
	assert.Equal(t, 0.42, resp.Results[0].Score)
}

func TestVectorSearch_QueryTaskIsRetrievalQuery(t *testing.T) {
	// Indexing uses TaskRetrievalDocument; query side must use
	// TaskRetrievalQuery so model task projections line up.
	fake := &fakeTextEmbedder{dim: 4}
	s := newTestSearchServer(newTestEmbedder(fake), &fakeVectorBackend{})
	_, err := s.VectorSearch(authedCtx(), &resourcepb.VectorSearchRequest{
		Key: validKey(), Query: "q", Limit: 1,
	})
	require.NoError(t, err)
	assert.Equal(t, embedder.TaskRetrievalQuery, fake.gotIn.Task)
}

func TestVectorSearch_LimitDefaultAndCeiling(t *testing.T) {
	t.Run("zero limit defaults to 50", func(t *testing.T) {
		backend := &fakeVectorBackend{}
		s := newTestSearchServer(newTestEmbedder(&fakeTextEmbedder{dim: 4}), backend)
		_, err := s.VectorSearch(authedCtx(), &resourcepb.VectorSearchRequest{
			Key: validKey(), Query: "q", Limit: 0,
		})
		require.NoError(t, err)
		assert.Equal(t, defaultVectorSearchLimit, backend.gotLimit)
	})
	t.Run("over-ceiling clamps to max", func(t *testing.T) {
		backend := &fakeVectorBackend{}
		s := newTestSearchServer(newTestEmbedder(&fakeTextEmbedder{dim: 4}), backend)
		_, err := s.VectorSearch(authedCtx(), &resourcepb.VectorSearchRequest{
			Key: validKey(), Query: "q", Limit: 9999,
		})
		require.NoError(t, err)
		assert.Equal(t, maxVectorSearchLimit, backend.gotLimit)
	})
}

func TestVectorSearch_FilterTranslation(t *testing.T) {
	backend := &fakeVectorBackend{}
	s := newTestSearchServer(newTestEmbedder(&fakeTextEmbedder{dim: 4}), backend)
	_, err := s.VectorSearch(authedCtx(), &resourcepb.VectorSearchRequest{
		Key:   validKey(),
		Query: "q",
		Limit: 1,
		Filters: []*resourcepb.Requirement{
			{Key: "uid", Values: []string{"u1", "u2"}},
			{Key: "folder", Values: []string{"f1"}},
			{Key: "datasource_uid", Values: []string{"prom-1"}},
			{Key: "", Values: []string{"ignored"}}, // dropped: empty key
			nil,                                    // dropped: nil
		},
	})
	require.NoError(t, err)

	require.Len(t, backend.gotFilters, 3)
	assert.Equal(t, "uid", backend.gotFilters[0].Field)
	assert.ElementsMatch(t, []string{"u1", "u2"}, backend.gotFilters[0].Values)
	assert.Equal(t, "folder", backend.gotFilters[1].Field)
	assert.Equal(t, "datasource_uid", backend.gotFilters[2].Field)
}

func TestVectorSearch_NoEmbedderReturnsUnimplemented(t *testing.T) {
	s := newTestSearchServer(nil, &fakeVectorBackend{})
	_, err := s.VectorSearch(authedCtx(), &resourcepb.VectorSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.Error(t, err)
	assert.Equal(t, codes.Unimplemented, status.Code(err))
}

func TestVectorSearch_NoVectorBackendReturnsUnimplemented(t *testing.T) {
	s := newTestSearchServer(newTestEmbedder(&fakeTextEmbedder{dim: 4}), nil)
	_, err := s.VectorSearch(authedCtx(), &resourcepb.VectorSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.Error(t, err)
	assert.Equal(t, codes.Unimplemented, status.Code(err))
}

func TestVectorSearch_EmptyQueryReturnsBadRequestError(t *testing.T) {
	s := newTestSearchServer(newTestEmbedder(&fakeTextEmbedder{dim: 4}), &fakeVectorBackend{})
	resp, err := s.VectorSearch(authedCtx(), &resourcepb.VectorSearchRequest{
		Key: validKey(), Query: "   ",
	})
	require.NoError(t, err)
	require.NotNil(t, resp.Error)
}

func TestVectorSearch_MissingKeyReturnsBadRequestError(t *testing.T) {
	s := newTestSearchServer(newTestEmbedder(&fakeTextEmbedder{dim: 4}), &fakeVectorBackend{})
	resp, err := s.VectorSearch(authedCtx(), &resourcepb.VectorSearchRequest{
		Key: &resourcepb.ResourceKey{Namespace: "ns"}, // missing group/resource
		Query: "q",
	})
	require.NoError(t, err)
	require.NotNil(t, resp.Error)
}

func TestVectorSearch_EmbedderErrorReturnsInternal(t *testing.T) {
	wantErr := errors.New("upstream blew up")
	emb := newTestEmbedder(&fakeTextEmbedder{dim: 4, wantErr: wantErr})
	s := newTestSearchServer(emb, &fakeVectorBackend{})
	_, err := s.VectorSearch(authedCtx(), &resourcepb.VectorSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.Error(t, err)
	assert.Equal(t, codes.Internal, status.Code(err))
}

func TestVectorSearch_BackendErrorReturnsInternal(t *testing.T) {
	backend := &fakeVectorBackend{err: errors.New("db is on fire")}
	s := newTestSearchServer(newTestEmbedder(&fakeTextEmbedder{dim: 4}), backend)
	_, err := s.VectorSearch(authedCtx(), &resourcepb.VectorSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.Error(t, err)
	assert.Equal(t, codes.Internal, status.Code(err))
}

// fakeAccessClient implements authlib.AccessClient with a per-row decision
// function. Used to exercise the post-filter authz path.
type fakeAccessClient struct {
	allow func(name, folder string) bool
}

func (f *fakeAccessClient) Check(_ context.Context, _ authlib.AuthInfo, _ authlib.CheckRequest, _ string) (authlib.CheckResponse, error) {
	return authlib.CheckResponse{Allowed: true}, nil
}

func (f *fakeAccessClient) BatchCheck(_ context.Context, _ authlib.AuthInfo, _ authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	return authlib.BatchCheckResponse{}, nil
}

func (f *fakeAccessClient) Compile(_ context.Context, _ authlib.AuthInfo, _ authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	if f.allow == nil {
		return func(string, string) bool { return true }, nil, nil
	}
	return authlib.ItemChecker(f.allow), nil, nil
}

func TestVectorSearch_AuthzFiltersUnauthorizedRows(t *testing.T) {
	// Backend returns three rows; AccessClient denies the middle one.
	// Result should be the other two, in original order.
	backend := &fakeVectorBackend{
		results: []vector.VectorSearchResult{
			{UID: "u1", Title: "T1", Score: 0.05, Folder: "f-public"},
			{UID: "u2", Title: "T2", Score: 0.10, Folder: "f-private"},
			{UID: "u3", Title: "T3", Score: 0.15, Folder: "f-public"},
		},
	}
	access := &fakeAccessClient{
		allow: func(_ /*name*/, folder string) bool {
			return folder != "f-private"
		},
	}
	s := newTestSearchServer(newTestEmbedder(&fakeTextEmbedder{dim: 4}), backend, access)

	resp, err := s.VectorSearch(authedCtx(), &resourcepb.VectorSearchRequest{
		Key: validKey(), Query: "q", Limit: 10,
	})
	require.NoError(t, err)
	require.Len(t, resp.Results, 2)
	assert.Equal(t, "u1", resp.Results[0].Name)
	assert.Equal(t, "u3", resp.Results[1].Name)
}

func TestVectorSearch_AuthzNilCheckerReturnsEmpty(t *testing.T) {
	// A nil checker from Compile means "no access to anything" — handler
	// should return an empty result set (not an error).
	type denyAll struct{ *fakeAccessClient }
	denyAccess := &denyAll{
		fakeAccessClient: &fakeAccessClient{
			allow: func(string, string) bool { return false },
		},
	}
	// Override Compile to return nil checker to exercise that branch.
	access := &nilCheckerClient{}
	_ = denyAccess

	backend := &fakeVectorBackend{
		results: []vector.VectorSearchResult{{UID: "u1", Title: "T1", Score: 0.1}},
	}
	s := newTestSearchServer(newTestEmbedder(&fakeTextEmbedder{dim: 4}), backend, access)

	resp, err := s.VectorSearch(authedCtx(), &resourcepb.VectorSearchRequest{
		Key: validKey(), Query: "q", Limit: 10,
	})
	require.NoError(t, err)
	assert.Empty(t, resp.Results)
}

// nilCheckerClient.Compile returns (nil, nil, nil) to exercise the
// "no access to anything" branch in VectorSearch.
type nilCheckerClient struct{ fakeAccessClient }

func (n *nilCheckerClient) Compile(_ context.Context, _ authlib.AuthInfo, _ authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return nil, nil, nil
}

func TestVectorSearch_NoUserInContextReturnsUnauthenticated(t *testing.T) {
	backend := &fakeVectorBackend{
		results: []vector.VectorSearchResult{{UID: "u1", Score: 0.1}},
	}
	s := newTestSearchServer(newTestEmbedder(&fakeTextEmbedder{dim: 4}), backend)

	// context.Background() has no auth info — handler should reject.
	_, err := s.VectorSearch(context.Background(), &resourcepb.VectorSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.Error(t, err)
	assert.Equal(t, codes.Unauthenticated, status.Code(err))
}

func TestVectorSearch_AuthzCompileErrorReturnsInternal(t *testing.T) {
	access := &erroringAccessClient{err: errors.New("authz service is down")}
	backend := &fakeVectorBackend{
		results: []vector.VectorSearchResult{{UID: "u1", Score: 0.1}},
	}
	s := newTestSearchServer(newTestEmbedder(&fakeTextEmbedder{dim: 4}), backend, access)
	_, err := s.VectorSearch(authedCtx(), &resourcepb.VectorSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.Error(t, err)
	assert.Equal(t, codes.Internal, status.Code(err))
}

type erroringAccessClient struct {
	fakeAccessClient
	err error
}

func (e *erroringAccessClient) Compile(_ context.Context, _ authlib.AuthInfo, _ authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return nil, nil, e.err
}

// countingAccessClient wraps an allow function and counts how many times
// the checker is invoked. Used to verify the per-UID memoization actually
// reduces calls for sub-resource workloads (panels of the same dashboard).
type countingAccessClient struct {
	calls int
	allow func(name, folder string) bool
}

func (c *countingAccessClient) Check(_ context.Context, _ authlib.AuthInfo, _ authlib.CheckRequest, _ string) (authlib.CheckResponse, error) {
	return authlib.CheckResponse{Allowed: true}, nil
}
func (c *countingAccessClient) BatchCheck(_ context.Context, _ authlib.AuthInfo, _ authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	return authlib.BatchCheckResponse{}, nil
}
func (c *countingAccessClient) Compile(_ context.Context, _ authlib.AuthInfo, _ authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return func(name, folder string) bool {
		c.calls++
		if c.allow == nil {
			return true
		}
		return c.allow(name, folder)
	}, nil, nil
}

func TestVectorSearch_AuthzMemoizationForSubresources(t *testing.T) {
	// 5 panels across 2 dashboards. With sub-resource memoization the
	// checker should be called once per unique (UID, Folder) — i.e. twice,
	// not five times.
	backend := &fakeVectorBackend{
		results: []vector.VectorSearchResult{
			{UID: "dash-1", Title: "T1", Subresource: "panel/1", Folder: "f1", Score: 0.05},
			{UID: "dash-1", Title: "T1", Subresource: "panel/2", Folder: "f1", Score: 0.06},
			{UID: "dash-1", Title: "T1", Subresource: "panel/3", Folder: "f1", Score: 0.07},
			{UID: "dash-2", Title: "T2", Subresource: "panel/1", Folder: "f1", Score: 0.10},
			{UID: "dash-2", Title: "T2", Subresource: "panel/2", Folder: "f1", Score: 0.11},
		},
	}
	access := &countingAccessClient{}
	s := newTestSearchServer(newTestEmbedder(&fakeTextEmbedder{dim: 4}), backend, access)

	resp, err := s.VectorSearch(authedCtx(), &resourcepb.VectorSearchRequest{
		Key: validKey(), Query: "q", Limit: 10,
	})
	require.NoError(t, err)
	assert.Len(t, resp.Results, 5, "all 5 panels should pass authz")
	assert.Equal(t, 2, access.calls, "checker should be called once per unique (UID, Folder)")
}

func TestVectorSearch_AuthzWholeResourcesOneCheckerCallEach(t *testing.T) {
	// Each result is a whole resource with a distinct UID. The cache
	// degenerates to "one miss per row" — same number of checker calls
	// as if the cache weren't there at all. The invariant holds:
	// checker calls = unique (UID, Folder) tuples.
	backend := &fakeVectorBackend{
		results: []vector.VectorSearchResult{
			{UID: "u1", Title: "T1", Folder: "f1", Score: 0.05},
			{UID: "u2", Title: "T2", Folder: "f1", Score: 0.10},
			{UID: "u3", Title: "T3", Folder: "f1", Score: 0.15},
		},
	}
	access := &countingAccessClient{}
	s := newTestSearchServer(newTestEmbedder(&fakeTextEmbedder{dim: 4}), backend, access)

	resp, err := s.VectorSearch(authedCtx(), &resourcepb.VectorSearchRequest{
		Key: validKey(), Query: "q", Limit: 10,
	})
	require.NoError(t, err)
	assert.Len(t, resp.Results, 3)
	assert.Equal(t, 3, access.calls, "checker should be called once per row when no subresource")
}
