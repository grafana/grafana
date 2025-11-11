package searchstore_test

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/stretchr/testify/assert"
)

func TestIntegrationFolderUIDFilter(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	testCases := []struct {
		description    string
		uids           []string
		expectedSql    string
		expectedParams []any
	}{
		{
			description:    "searching general folder",
			uids:           []string{"general"},
			expectedSql:    "dashboard.folder_uid IS NULL ",
			expectedParams: []any{},
		},
		{
			description:    "searching a specific folder",
			uids:           []string{"abc-123"},
			expectedSql:    "dashboard.org_id = ? AND dashboard.folder_uid = ?",
			expectedParams: []any{int64(1), "abc-123"},
		},
		{
			description:    "searching a specific folders",
			uids:           []string{"abc-123", "def-456"},
			expectedSql:    "dashboard.org_id = ? AND dashboard.folder_uid IN (?,?)",
			expectedParams: []any{int64(1), "abc-123", "def-456"},
		},
		{
			description:    "searching a specific folders or general",
			uids:           []string{"general", "abc-123", "def-456"},
			expectedSql:    "(dashboard.org_id = ? AND dashboard.folder_uid IN (?,?) OR dashboard.folder_uid IS NULL)",
			expectedParams: []any{int64(1), "abc-123", "def-456"},
		},
	}

	store := setupTestEnvironment(t)

	for _, tc := range testCases {
		t.Run(tc.description, func(t *testing.T) {
			f := searchstore.FolderUIDFilter{
				Dialect: store.GetDialect(),
				OrgID:   1,
				UIDs:    tc.uids,
			}

			sql, params := f.Where()

			assert.Equal(t, tc.expectedSql, sql)
			assert.Equal(t, tc.expectedParams, params)
		})
	}
}

func TestTitleFilter(t *testing.T) {
	testCases := []struct {
		description    string
		title          string
		exactMatch     bool
		expectedSql    string
		expectedParams []any
	}{
		{
			description:    "searching foo folder - partial match",
			title:          "foo",
			expectedSql:    "dashboard.title LIKE ?",
			expectedParams: []any{"%foo%"},
		},
		{
			description:    "searching foo folder - exact match",
			title:          "foo",
			exactMatch:     true,
			expectedSql:    "dashboard.title = ?",
			expectedParams: []any{"foo"},
		},
	}

	store := setupTestEnvironment(t)

	for _, tc := range testCases {
		t.Run(tc.description, func(t *testing.T) {
			f := searchstore.TitleFilter{
				Dialect:         store.GetDialect(),
				Title:           tc.title,
				TitleExactMatch: tc.exactMatch,
			}

			sql, params := f.Where()

			assert.Equal(t, tc.expectedSql, sql)
			assert.Equal(t, tc.expectedParams, params)
		})
	}
}
