package resource

import (
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

type embeddingBuilderProvider func() ([]embed.Builder, error)

func (p embeddingBuilderProvider) Builders() ([]embed.Builder, error) { return p() }

func (p embeddingBuilderProvider) Has(group, resource string) bool {
	builders, _ := p()
	for _, builder := range builders {
		if builder.Group() == group && builder.Resource() == resource {
			return true
		}
	}
	return false
}

type enrolledBuilder struct {
	embed.Builder
	group, resource string
}

func (b enrolledBuilder) Group() string    { return b.group }
func (b enrolledBuilder) Resource() string { return b.resource }

func TestEmbeddingEnrollmentGatesQueries(t *testing.T) {
	for _, tc := range []struct {
		name     string
		builders []embed.Builder
		external bool
		excluded bool
		allowed  bool
	}{
		{name: "internal without builder"},
		{name: "different group", builders: []embed.Builder{enrolledBuilder{group: "other", resource: "r"}}},
		{name: "enrolled internal", builders: []embed.Builder{enrolledBuilder{group: "g", resource: "r"}}, allowed: true},
		{name: "allowlist still required", builders: []embed.Builder{enrolledBuilder{group: "g", resource: "r"}}, excluded: true},
		{name: "external needs no builder", external: true, allowed: true},
	} {
		for _, hybrid := range []bool{false, true} {
			name := "vector/" + tc.name
			if hybrid {
				name = "hybrid/" + tc.name
			}
			t.Run(name, func(t *testing.T) {
				backend := &fakeVectorBackend{collection: &vector.Collection{Group: "g", Resource: "r", PartitionKey: "r", IsExternal: tc.external}}
				s, _, provider := newHybridTestServer(lexTableResponse(), backend)
				calls := 0
				s.embeddingBuilders = embeddingBuilderProvider(func() ([]embed.Builder, error) {
					calls++
					return tc.builders, nil
				})
				if tc.external {
					s.externalLexical = &fakeLexicalSearcher{}
				}
				if tc.excluded {
					s.collectionAllowlist = vector.NewCollectionAllowlist(nil, nil)
				}
				if hybrid {
					_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{Key: validKey(), Query: "text"})
					if tc.allowed {
						require.NoError(t, err)
					} else {
						require.Equal(t, codes.NotFound, status.Code(err))
					}
				} else {
					resp, err := s.VectorSearch(authedCtx(), &resourcepb.VectorSearchRequest{Key: validKey(), Query: "text"})
					require.NoError(t, err)
					if tc.allowed {
						require.Nil(t, resp.Error)
					} else {
						require.EqualValues(t, http.StatusNotFound, resp.Error.Code)
					}
				}
				if tc.allowed {
					require.NotEmpty(t, provider.gotIn.Texts)
				} else {
					require.Empty(t, provider.gotIn.Texts, "rejected collections must not spend query embeddings")
				}
				if tc.external || tc.excluded {
					require.Zero(t, calls)
				}
			})
		}
	}
}

func TestEmbeddingEnrollmentRefreshesForQueries(t *testing.T) {
	s := newTestSearchServer(nil, &fakeVectorBackend{})
	builders := []embed.Builder{enrolledBuilder{group: "g", resource: "r"}}
	s.embeddingBuilders = embeddingBuilderProvider(func() ([]embed.Builder, error) { return builders, nil })
	_, allowed, err := s.resolveAllowedCollection(t.Context(), "g", "r")
	require.NoError(t, err)
	require.True(t, allowed)
	builders = nil
	_, allowed, err = s.resolveAllowedCollection(t.Context(), "g", "r")
	require.NoError(t, err)
	require.False(t, allowed)
}

func TestEmbeddingEnrollmentValidatesBeforeSearchStartup(t *testing.T) {
	want := errors.New("unsupported collection")
	s := &searchServer{embeddingBuilders: embeddingBuilderProvider(func() ([]embed.Builder, error) { return nil, want })}
	require.ErrorIs(t, s.init(t.Context()), want)
}

func TestEmbeddingEnrollmentValidatesBeforeStorageStartup(t *testing.T) {
	want := errors.New("unsupported collection")
	s := &server{
		log:               log.New("test"),
		embeddingBuilders: embeddingBuilderProvider(func() ([]embed.Builder, error) { return nil, want }),
	}
	require.ErrorIs(t, s.Init(t.Context()), want)
}
