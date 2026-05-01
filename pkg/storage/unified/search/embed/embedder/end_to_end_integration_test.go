//go:build integration

package embedder_test

import (
	"context"
	"math"
	"os"
	"sort"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/dashboard"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder/bedrock"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder/vertex"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

// Run with one of:
//
//	EMBED_PROVIDER=vertex VERTEX_PROJECT_ID=$(gcloud config get-value project) \
//	  go test -tags=integration -run TestIntegration_EndToEndDashboardSearch -v \
//	    ./pkg/storage/unified/search/embed/embedder/
//
//	EMBED_PROVIDER=bedrock AWS_PROFILE=sandbox AWS_REGION=us-east-1 \
//	  go test -tags=integration -run TestIntegration_EndToEndDashboardSearch -v \
//	    ./pkg/storage/unified/search/embed/embedder/
//
// What it does: loads the two real dashboard fixtures from
// ../dashboard/testdata/, runs them through the extractor, embeds every
// panel via the chosen provider, then issues query-side embeddings and
// ranks panels by cosine distance in-process. Asserts the topical query
// surfaces the expected panel as top-1 and that an unrelated query
// produces strictly larger distances than a topical one (i.e. the
// embedding model is doing real semantic work, not returning constants).
//
// Skips when EMBED_PROVIDER is unset. Skips per-provider when the
// matching cloud creds are missing. Costs ~5–10 provider API calls per
// run (well under a cent).
func TestIntegration_EndToEndDashboardSearch(t *testing.T) {
	providerName := os.Getenv("EMBED_PROVIDER")
	if providerName == "" {
		t.Skip("EMBED_PROVIDER not set (expected: vertex | bedrock)")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	emb := buildEmbedder(ctx, t, providerName)
	be := embedder.NewBatchEmbedder(*emb)
	extractor := dashboard.New()

	// 1. Index both fixture dashboards.
	type fixture struct {
		path, namespace, name string
		rv                    int64
	}
	fixtures := []fixture{
		{"../dashboard/testdata/v1dash.json", "default", "p_YnyR34k", 1},
		{"../dashboard/testdata/v2dash.json", "default", "ow8csz6", 2},
	}

	var allVectors []vector.Vector
	for _, f := range fixtures {
		data, err := os.ReadFile(f.path)
		require.NoError(t, err, "read %s", f.path)

		items, err := extractor.Extract(ctx,
			&resourcepb.ResourceKey{Resource: "dashboards", Name: f.name}, data, "")
		require.NoError(t, err)
		require.NotEmpty(t, items, "%s produced no items", f.path)

		vecs, err := be.Embed(ctx, f.namespace, "dashboards", f.rv, items)
		require.NoError(t, err)
		require.Len(t, vecs, len(items), "%s vector count != item count", f.path)
		allVectors = append(allVectors, vecs...)
	}
	t.Logf("indexed %d panels across %d dashboards using model=%s",
		len(allVectors), len(fixtures), emb.Model)

	// 2. Topical queries: assert the right panel ranks first.
	topicalQueries := []struct {
		query, expectInTitle string
	}{
		{"home power consumption metrics", "Power Consumption Details"},
		{"how many dashboards does each grafana cloud stack have", "Dashboards per Grafana Cloud Stack"},
		{"how many active grafana cloud stacks are running", "Active Grafana Cloud Stack Instances"},
	}

	for _, tc := range topicalQueries {
		t.Run(tc.query, func(t *testing.T) {
			ranked := rankByCosineDistance(allVectors, embedQuery(ctx, t, emb, tc.query))
			require.NotEmpty(t, ranked)

			t.Logf("top-3 for %q:", tc.query)
			for i := 0; i < 3 && i < len(ranked); i++ {
				t.Logf("  #%d  d=%.4f  %s [%s]",
					i+1, ranked[i].dist, ranked[i].vec.Title, ranked[i].vec.Subresource)
			}

			// If this assertion ever fails on a new provider, the embedding
			// model may rank semantically-close panels in a different order.
			// Loosen to "top-2 contains" before changing the query.
			assert.Contains(t, ranked[0].vec.Title, tc.expectInTitle,
				"top-1 title should contain %q", tc.expectInTitle)
		})
	}

	// 3. Unrelated query: distances should be strictly larger than any
	// topical query, otherwise the model is returning roughly the same
	// vector for any input and our search is a coin flip.
	t.Run("unrelated query has larger top-1 distance than topical", func(t *testing.T) {
		topical := rankByCosineDistance(allVectors,
			embedQuery(ctx, t, emb, topicalQueries[0].query))
		unrelated := rankByCosineDistance(allVectors,
			embedQuery(ctx, t, emb, "the migration patterns of arctic terns"))

		t.Logf("topical   top-1 distance: %.4f", topical[0].dist)
		t.Logf("unrelated top-1 distance: %.4f", unrelated[0].dist)

		assert.Greater(t, unrelated[0].dist, topical[0].dist,
			"unrelated query (%.4f) should rank further than topical (%.4f) — "+
				"if it doesn't, the embedding model isn't producing useful direction",
			unrelated[0].dist, topical[0].dist)
	})
}

// rankedVec pairs a stored vector with its distance to a query.
type rankedVec struct {
	vec  vector.Vector
	dist float64
}

// rankByCosineDistance returns vectors sorted by ascending cosine
// distance to the query. Mirrors what the pgvector backend returns,
// computed in-process so this test doesn't need a database.
func rankByCosineDistance(vecs []vector.Vector, query []float32) []rankedVec {
	out := make([]rankedVec, len(vecs))
	for i, v := range vecs {
		out[i] = rankedVec{vec: v, dist: cosineDistance(v.Embedding, query)}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].dist < out[j].dist })
	return out
}

func cosineDistance(a, b []float32) float64 {
	// Tolerate width mismatch by comparing only the overlap. The storage
	// layer zero-pads shorter vectors to the column width; doing the
	// same at the cosine math level (or comparing only the prefix) gives
	// the same answer because the padded zeros contribute nothing.
	n := len(a)
	if len(b) < n {
		n = len(b)
	}
	if n == 0 {
		return 2.0
	}
	var dot, normA, normB float64
	for i := 0; i < n; i++ {
		x, y := float64(a[i]), float64(b[i])
		dot += x * y
		normA += x * x
		normB += y * y
	}
	if normA == 0 || normB == 0 {
		return 2.0
	}
	return 1.0 - dot/(math.Sqrt(normA)*math.Sqrt(normB))
}

func embedQuery(ctx context.Context, t *testing.T, emb *embedder.Embedder, query string) []float32 {
	t.Helper()
	out, err := emb.EmbedText(ctx, embedder.EmbedTextInput{
		Texts:     []string{query},
		Normalize: emb.ShouldNormalize(),
		Task:      embedder.TaskRetrievalQuery,
	})
	require.NoError(t, err)
	require.Len(t, out.Embeddings, 1)
	require.NotEmpty(t, out.Embeddings[0].Dense)
	return out.Embeddings[0].Dense
}

func buildEmbedder(ctx context.Context, t *testing.T, name string) *embedder.Embedder {
	t.Helper()
	switch name {
	case "vertex":
		projectID := os.Getenv("VERTEX_PROJECT_ID")
		if projectID == "" {
			t.Skip("VERTEX_PROJECT_ID not set")
		}
		location := envOr("VERTEX_LOCATION", "us-central1")
		model := envOr("VERTEX_MODEL", "gemini-embedding-001")
		client, err := vertex.NewClient(ctx, projectID, location)
		require.NoError(t, err)
		return &embedder.Embedder{
			TextEmbedder: vertex.NewDenseEmbedder(client, model, 768),
			Model:        "vertex/" + model,
			VectorType:   embedder.VectorTypeDense,
			Metric:       embedder.CosineDistance,
			Dimensions:   768,
			Normalized:   false,
		}
	case "bedrock":
		region := os.Getenv("AWS_REGION")
		if region == "" {
			t.Skip("AWS_REGION not set")
		}
		model := envOr("BEDROCK_MODEL", "cohere.embed-v4:0")
		cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(region))
		require.NoError(t, err)
		rt := bedrockruntime.NewFromConfig(cfg)
		client := bedrock.NewClient(rt)
		return &embedder.Embedder{
			TextEmbedder: bedrock.NewDenseEmbedder(client, model, 1024),
			Model:        "bedrock/" + model,
			VectorType:   embedder.VectorTypeDense,
			Metric:       embedder.CosineDistance,
			Dimensions:   1024,
			Normalized:   false,
		}
	default:
		t.Fatalf("unknown EMBED_PROVIDER %q (expected: vertex | bedrock)", name)
		return nil
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
