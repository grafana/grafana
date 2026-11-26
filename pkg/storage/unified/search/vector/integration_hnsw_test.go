package vector

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	pgvector "github.com/pgvector/pgvector-go"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
)

func TestIntegrationHNSWSearchUsesRequestedCandidateDepth(t *testing.T) {
	backend, engine, ctx := setupIntegrationTest(t)
	const namespace = "integration-test-hnsw-budget"
	const rowCount = 200

	vectors := make([]Vector, 0, rowCount)
	for i := 1; i <= rowCount; i++ {
		metadata := json.RawMessage(`{}`)
		switch i {
		case 20:
			metadata = json.RawMessage(`{"floor":"yes"}`)
		case 120:
			metadata = json.RawMessage(`{"target":"yes"}`)
		}
		vectors = append(vectors, Vector{
			Namespace: namespace, Resource: testResource, Model: testModel,
			UID: "dash", Title: "Dash", Subresource: fmt.Sprintf("panel/%d", i),
			ResourceVersion: int64(i), Content: fmt.Sprintf("panel %d", i),
			Metadata: metadata, Embedding: makeEmbedding(1, float32(i)/1024),
		})
	}
	require.NoError(t, backend.Upsert(ctx, vectors))

	database := dbimpl.NewDB(engine.DB().DB, engine.Dialect().DriverName())
	require.NoError(t, NewPromoter(database, 1, 0).promote(ctx, testResource, namespace))

	// A single pooled session makes the forced plan and setting restoration observable.
	pool := engine.DB().DB
	pool.SetMaxOpenConns(1)
	pool.SetMaxIdleConns(1)
	_, err := pool.ExecContext(ctx, `SET enable_seqscan = off`)
	require.NoError(t, err)
	_, err = pool.ExecContext(ctx, `SET enable_bitmapscan = off`)
	require.NoError(t, err)
	_, err = pool.ExecContext(ctx, `SET enable_sort = off`)
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = pool.ExecContext(ctx, `RESET enable_seqscan`)
		_, _ = pool.ExecContext(ctx, `RESET enable_bitmapscan`)
		_, _ = pool.ExecContext(ctx, `RESET enable_sort`)
		_, _ = pool.ExecContext(ctx, `RESET hnsw.ef_search`)
	})
	_, err = pool.ExecContext(ctx, `SET hnsw.ef_search = 40`)
	require.NoError(t, err)

	planRows, err := pool.QueryContext(ctx, `EXPLAIN SELECT uid FROM embeddings
		WHERE resource = $1 AND namespace = $2 AND model = $3
		ORDER BY embedding <=> $4 LIMIT 100`,
		testResource, namespace, testModel, pgvector.NewHalfVector(makeEmbedding(1, 0)))
	require.NoError(t, err)
	var plan []string
	for planRows.Next() {
		var line string
		require.NoError(t, planRows.Scan(&line))
		plan = append(plan, line)
	}
	require.NoError(t, planRows.Err())
	require.NoError(t, planRows.Close())
	require.Contains(t, strings.Join(plan, "\n"), partialHNSWName(testResource, namespace))
	filteredPlanRows, err := pool.QueryContext(ctx, `EXPLAIN SELECT uid FROM embeddings
		WHERE resource = $1 AND namespace = $2 AND model = $3
		AND metadata @> '{"target":"yes"}'::jsonb
		ORDER BY embedding <=> $4 LIMIT 60`,
		testResource, namespace, testModel, pgvector.NewHalfVector(makeEmbedding(1, 0)))
	require.NoError(t, err)
	plan = plan[:0]
	for filteredPlanRows.Next() {
		var line string
		require.NoError(t, filteredPlanRows.Scan(&line))
		plan = append(plan, line)
	}
	require.NoError(t, filteredPlanRows.Err())
	require.NoError(t, filteredPlanRows.Close())
	require.Contains(t, strings.Join(plan, "\n"), partialHNSWName(testResource, namespace))
	floorPlanRows, err := pool.QueryContext(ctx, `EXPLAIN SELECT uid FROM embeddings
		WHERE resource = $1 AND namespace = $2 AND model = $3
		AND metadata @> '{"floor":"yes"}'::jsonb
		ORDER BY embedding <=> $4 LIMIT 1`,
		testResource, namespace, testModel, pgvector.NewHalfVector(makeEmbedding(1, 0)))
	require.NoError(t, err)
	plan = plan[:0]
	for floorPlanRows.Next() {
		var line string
		require.NoError(t, floorPlanRows.Scan(&line))
		plan = append(plan, line)
	}
	require.NoError(t, floorPlanRows.Err())
	require.NoError(t, floorPlanRows.Close())
	require.Contains(t, strings.Join(plan, "\n"), partialHNSWName(testResource, namespace))

	results, err := backend.Search(ctx, namespace, testModel, testResource, makeEmbedding(1, 0), 100)
	require.NoError(t, err)
	require.Len(t, results, 100)
	subresources := make([]string, 0, len(results))
	for _, result := range results {
		subresources = append(subresources, result.Subresource)
	}
	require.Contains(t, subresources, "panel/80")

	var budget string
	require.NoError(t, pool.QueryRowContext(ctx, `SHOW hnsw.ef_search`).Scan(&budget))
	require.Equal(t, "40", budget)

	_, err = pool.ExecContext(ctx, `SET hnsw.ef_search = 150`)
	require.NoError(t, err)
	results, err = backend.Search(ctx, namespace, testModel, testResource, makeEmbedding(1, 0), 60,
		SearchFilter{Field: "target", Values: []string{"yes"}})
	require.NoError(t, err)
	require.Len(t, results, 1)
	require.Equal(t, "panel/120", results[0].Subresource)
	require.NoError(t, pool.QueryRowContext(ctx, `SHOW hnsw.ef_search`).Scan(&budget))
	require.Equal(t, "150", budget)

	_, err = pool.ExecContext(ctx, `SET hnsw.ef_search = 1`)
	require.NoError(t, err)
	floorRows, err := pool.QueryContext(ctx, `SELECT uid FROM embeddings
		WHERE resource = $1 AND namespace = $2 AND model = $3
		AND metadata @> '{"floor":"yes"}'::jsonb
		ORDER BY embedding <=> $4 LIMIT 1`,
		testResource, namespace, testModel, pgvector.NewHalfVector(makeEmbedding(1, 0)))
	require.NoError(t, err)
	require.False(t, floorRows.Next(), "the HNSW search at ef_search=1 should miss panel/20")
	require.NoError(t, floorRows.Err())
	require.NoError(t, floorRows.Close())
	results, err = backend.Search(ctx, namespace, testModel, testResource, makeEmbedding(1, 0), 1,
		SearchFilter{Field: "floor", Values: []string{"yes"}})
	require.NoError(t, err)
	require.Len(t, results, 1)
	require.Equal(t, "panel/20", results[0].Subresource)
	require.NoError(t, pool.QueryRowContext(ctx, `SHOW hnsw.ef_search`).Scan(&budget))
	require.Equal(t, "1", budget)

	_, err = pool.ExecContext(ctx, `SET hnsw.ef_search = 40`)
	require.NoError(t, err)
	_, err = pool.ExecContext(ctx, `SET hnsw.ef_search = 1001`)
	require.Error(t, err, "pgvector should reject a budget above its supported maximum")
	results, err = backend.Search(ctx, namespace, testModel, testResource, makeEmbedding(1, 0), 1001)
	require.NoError(t, err)
	require.Len(t, results, rowCount)
	require.NoError(t, pool.QueryRowContext(ctx, `SHOW hnsw.ef_search`).Scan(&budget))
	require.Equal(t, "40", budget)

	_, err = pool.ExecContext(ctx, `SET hnsw.ef_search = 20`)
	require.NoError(t, err)
	_, err = backend.Search(ctx, namespace, testModel, testResource, makeEmbedding(1, 0), -1)
	require.ErrorContains(t, err, "limit must be positive")
	require.NoError(t, pool.QueryRowContext(ctx, `SHOW hnsw.ef_search`).Scan(&budget))
	require.Equal(t, "20", budget)
}
