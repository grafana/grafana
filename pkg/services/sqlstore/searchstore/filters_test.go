package searchstore_test

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/stretchr/testify/assert"
)

func TestFolderUIDFilter(t *testing.T) {
	testCases := []struct {
		description    string
		uids           []string
		expectedSql    string
		expectedParams []interface{}
	}{
		{
			description:    "searching general folder",
			uids:           []string{"general"},
			expectedSql:    "dashboard.folder_id = ? ",
			expectedParams: []interface{}{0},
		},
		{
			description:    "searching a specific folder",
			uids:           []string{"abc-123"},
			expectedSql:    "dashboard.folder_id IN (SELECT id FROM dashboard WHERE org_id = ? AND uid = ?)",
			expectedParams: []interface{}{int64(1), "abc-123"},
		},
		{
			description:    "searching a specific folders",
			uids:           []string{"abc-123", "def-456"},
			expectedSql:    "dashboard.folder_id IN (SELECT id FROM dashboard WHERE org_id = ? AND uid IN (?,?))",
			expectedParams: []interface{}{int64(1), "abc-123", "def-456"},
		},
		{
			description:    "searching a specific folders or general",
			uids:           []string{"general", "abc-123", "def-456"},
			expectedSql:    "(dashboard.folder_id IN (SELECT id FROM dashboard WHERE org_id = ? AND uid IN (?,?)) OR dashboard.folder_id = ?)",
			expectedParams: []interface{}{int64(1), "abc-123", "def-456", 0},
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
