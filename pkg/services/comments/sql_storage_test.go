package comments

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/comments/commentmodel"
	"github.com/grafana/grafana/pkg/services/sqlstore"

	"github.com/stretchr/testify/require"
)

func createSqlStorage(t *testing.T) Storage {
	t.Helper()
	sqlStore := sqlstore.InitTestDB(t)
	return &sqlStorage{
		sql: sqlStore,
	}
}

func TestSqlStorage(t *testing.T) {
	s := createSqlStorage(t)
	ctx := context.Background()
	items, err := s.Get(ctx, 1, commentmodel.ContentTypeOrg, "2", GetFilter{})
	require.NoError(t, err)
	require.Len(t, items, 0)

	comment, err := s.Create(ctx, 1, commentmodel.ContentTypeOrg, "2", 1, "test")
	require.NoError(t, err)
	require.NotNil(t, comment)
	require.True(t, comment.Id > 0)

	items, err = s.Get(ctx, 1, commentmodel.ContentTypeOrg, "2", GetFilter{})
	require.NoError(t, err)
	require.Len(t, items, 1)
	require.Equal(t, items[0].Content, "test")
	require.Equal(t, int64(1), items[0].UserId)
	require.NotZero(t, items[0].Created)
	require.NotZero(t, items[0].Updated)

	// Same object, but another content type.
	items, err = s.Get(ctx, 1, commentmodel.ContentTypeDashboard, "2", GetFilter{})
	require.NoError(t, err)
	require.Len(t, items, 0)
}
