package tagimpl

import (
	"context"
	"os"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/tag"
)

func TestMain(m *testing.M) {
	code := m.Run()
	db.CleanupTestDB()
	os.Exit(code)
}

type getStore func(db.DB) store

func testIntegrationSavingTags(t *testing.T, fn getStore) {
	t.Helper()

	ss := db.InitTestDB(t)
	store := fn(ss)
	tagPairs := []*tag.Tag{
		{Key: "outage"},
		{Key: "type", Value: "outage"},
		{Key: "server", Value: "server-1"},
		{Key: "error"},
	}
	tags, err := store.EnsureTagsExist(context.Background(), tagPairs)

	require.Nil(t, err)
	require.Equal(t, 4, len(tags))
}
