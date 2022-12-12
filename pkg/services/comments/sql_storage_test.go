package comments

import (
	"context"
	"strconv"
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/comments/commentmodel"

	"github.com/stretchr/testify/require"
)

func createSqlStorage(t *testing.T) Storage {
	t.Helper()
	sqlStore := db.InitTestDB(t)
	return &sqlStorage{
		sql: sqlStore,
	}
}

func TestSqlStorage(t *testing.T) {
	s := createSqlStorage(t)
	ctx := context.Background()
	items, err := s.Get(ctx, 1, commentmodel.ObjectTypeOrg, "2", GetFilter{})
	require.NoError(t, err)
	require.Len(t, items, 0)

	numComments := 10

	for i := 0; i < numComments; i++ {
		comment, err := s.Create(ctx, 1, commentmodel.ObjectTypeOrg, "2", 1, "test"+strconv.Itoa(i))
		require.NoError(t, err)
		require.NotNil(t, comment)
		require.True(t, comment.Id > 0)
	}

	items, err = s.Get(ctx, 1, commentmodel.ObjectTypeOrg, "2", GetFilter{})
	require.NoError(t, err)
	require.Len(t, items, 10)
	require.Equal(t, "test9", items[0].Content)
	require.Equal(t, "test0", items[9].Content)
	require.Equal(t, int64(1), items[0].UserId)
	require.NotZero(t, items[0].Created)
	require.NotZero(t, items[0].Updated)

	// Same object, but another content type.
	items, err = s.Get(ctx, 1, commentmodel.ObjectTypeDashboard, "2", GetFilter{})
	require.NoError(t, err)
	require.Len(t, items, 0)

	// Now test filtering.
	items, err = s.Get(ctx, 1, commentmodel.ObjectTypeOrg, "2", GetFilter{
		Limit: 5,
	})
	require.NoError(t, err)
	require.Len(t, items, 5)
	require.Equal(t, "test9", items[0].Content)
	require.Equal(t, "test5", items[4].Content)

	items, err = s.Get(ctx, 1, commentmodel.ObjectTypeOrg, "2", GetFilter{
		Limit:    5,
		BeforeID: items[4].Id,
	})
	require.NoError(t, err)
	require.Len(t, items, 5)
	require.Equal(t, "test4", items[0].Content)
	require.Equal(t, "test0", items[4].Content)

	items, err = s.Get(ctx, 1, commentmodel.ObjectTypeOrg, "2", GetFilter{
		Limit:    5,
		BeforeID: items[4].Id,
	})
	require.NoError(t, err)
	require.Len(t, items, 0)
}
