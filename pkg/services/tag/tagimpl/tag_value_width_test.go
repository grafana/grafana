package tagimpl

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/tag"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationSavingLongTagValues guards against issue #124758: alerting
// state history tags store the rule folder's full path in tag.value, which
// has no upstream length limit and overflows VARCHAR(100).
func TestIntegrationSavingLongTagValues(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ss := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
	store := &sqlStore{db: ss}

	longValue := strings.Repeat("Business Units/Tecnología y digital/Productos y plataformas/", 4)
	require.Greater(t, len(longValue), 100, "test value must exceed the historical column width")

	tags, err := store.EnsureTagsExist(context.Background(), []*tag.Tag{
		{Key: "grafana_folder", Value: longValue},
	})
	require.NoError(t, err)
	require.Len(t, tags, 1)

	var stored tag.Tag
	err = ss.WithDbSession(context.Background(), func(sess *db.Session) error {
		has, err := sess.Table("tag").Where("`key`=? AND `value`=?", "grafana_folder", longValue).Get(&stored)
		if !has {
			return errors.New("tag with long value not found")
		}
		return err
	})
	require.NoError(t, err)
	require.Equal(t, longValue, stored.Value, "long tag value must round-trip untruncated")
}

// TestIntegrationTagValueColumnWidth pins the widened schema on databases
// that enforce VARCHAR widths; SQLite ignores them entirely.
func TestIntegrationTagValueColumnWidth(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	switch {
	case db.IsTestDbMySQL() || db.IsTestDbPostgres():
		ss := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup
		var width int64
		err := ss.WithDbSession(context.Background(), func(sess *db.Session) error {
			has, err := sess.SQL(
				`SELECT CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS WHERE table_name = 'tag' AND column_name = 'value'`,
			).Get(&width)
			if !has {
				return errors.New("tag.value column not found")
			}
			return err
		})
		require.NoError(t, err)
		require.Equal(t, int64(512), width)
	default:
		t.Skip("column widths are not enforced by SQLite")
	}
}
