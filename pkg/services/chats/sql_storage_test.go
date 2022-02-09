package chats

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/chats/chatmodel"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"

	"github.com/stretchr/testify/require"
)

func createSqlStorage(t *testing.T) Storage {
	t.Helper()
	sqlStore := sqlstore.InitTestDB(t, sqlstore.InitTestDBOpt{Features: []string{featuremgmt.FlagLiveDashboardDiscussions}})
	return &sqlStorage{
		sql: sqlStore,
	}
}

func TestSqlStorage(t *testing.T) {
	s := createSqlStorage(t)
	ctx := context.Background()
	messages, err := s.GetMessages(ctx, 1, chatmodel.ContentTypeOrg, "2", GetMessagesFilter{})
	require.NoError(t, err)
	require.Len(t, messages, 0)

	message, err := s.CreateMessage(ctx, 1, chatmodel.ContentTypeOrg, "2", 1, "test")
	require.NoError(t, err)
	require.NotNil(t, message)
	require.True(t, message.Id > 0)

	messages, err = s.GetMessages(ctx, 1, chatmodel.ContentTypeOrg, "2", GetMessagesFilter{})
	require.NoError(t, err)
	require.Len(t, messages, 1)
	require.Equal(t, messages[0].Content, "test")
	require.Equal(t, int64(1), messages[0].UserId)
	require.NotZero(t, messages[0].Created)
	require.NotZero(t, messages[0].Updated)

	// Same object, but another content type.
	messages, err = s.GetMessages(ctx, 1, chatmodel.ContentTypeDashboard, "2", GetMessagesFilter{})
	require.NoError(t, err)
	require.Len(t, messages, 0)
}
