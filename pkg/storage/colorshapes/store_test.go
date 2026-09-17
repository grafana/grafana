package colorshapes

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	colorshapesapp "github.com/grafana/grafana/apps/colorshapes/pkg/app"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationColorshapesStore(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlStore := db.InitTestDB(t)
	store := ProvideStore(sqlStore)
	ctx := context.Background()

	base := time.Now().Truncate(time.Second)
	require.NoError(t, store.Insert(ctx, "user:alice", "10.0.0.1", "red", "circle"))
	require.NoError(t, store.Insert(ctx, "user:bob", "10.0.0.2", "blue", "square"))

	t.Run("List returns hits from every user within range", func(t *testing.T) {
		hits, err := store.List(ctx, base.Add(-time.Hour), base.Add(time.Hour))
		require.NoError(t, err)
		require.Len(t, hits, 2)

		byColor := map[string]colorshapesapp.Hit{}
		for _, h := range hits {
			byColor[h.Color] = h
		}
		require.Equal(t, "circle", byColor["red"].Shape)
		require.Equal(t, "user:alice", byColor["red"].CreatedBy)
		require.Equal(t, "square", byColor["blue"].Shape)
		require.Equal(t, "user:bob", byColor["blue"].CreatedBy)
	})

	t.Run("List excludes hits outside the requested range", func(t *testing.T) {
		hits, err := store.List(ctx, base.Add(2*time.Hour), base.Add(3*time.Hour))
		require.NoError(t, err)
		require.Empty(t, hits)
	})
}
