package tagimpl

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/tag"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
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
		{Key: "server", Value: "server-1"}, // duplicates will generate a new ID.
		{Key: "error"},
		{Key: "error"}, // duplicates will generate a new ID.
	}
	tags, err := store.EnsureTagsExist(context.Background(), tagPairs)

	require.Nil(t, err)
	require.Equal(t, len(tagPairs), len(tags))
}
