// package search_test contains integration tests for search
package search_test

import (
	"context"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/search"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"testing"
	"time"
)

var dialect = &migrator.Sqlite3{}

func TestEqualResults(t *testing.T) {
	user := &models.SignedInUser{
		UserId:  1,
		OrgId:   1,
		OrgRole: models.ROLE_EDITOR,
	}
	limit := int64(15)
	page := int64(1)
	permission := models.PERMISSION_EDIT

	db := setupTestEnvironment(t)

	new := &search.Builder{
		Filters: []interface{}{
			search.OrgFilter{OrgId: user.OrgId},
			search.TitleSorter{},
		},
		Dialect: dialect,
	}

	old := sqlstore.NewSearchBuilder(user, limit, page, permission)
	old.WithDialect(dialect)

	dashboard, err := simplejson.NewJson([]byte(`{
    	"id": null,
    	"uid": null,
    	"title": "Production Overview",
    	"tags": [ "templated" ],
    	"timezone": "browser",
    	"schemaVersion": 16,
    	"version": 0
	}`))
	require.NoError(t, err)
	err = sqlstore.SaveDashboard(&models.SaveDashboardCommand{
		Dashboard: dashboard,
		UserId:    1,
		OrgId:     1,
		UpdatedAt: time.Now(),
	})
	require.NoError(t, err)

	newRes := []sqlstore.DashboardSearchProjection{}
	err = db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		sql, params := new.ToSql(limit, page)
		return sess.SQL(sql, params...).Find(&newRes)
	})
	require.NoError(t, err)

	oldRes := []sqlstore.DashboardSearchProjection{}
	err = db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		sql, params := old.ToSql()
		return sess.SQL(sql, params...).Find(&oldRes)
	})
	require.NoError(t, err)

	assert.Len(t, newRes, 1)
	assert.EqualValues(t, oldRes, newRes)
}

func setupTestEnvironment(t *testing.T) *sqlstore.SqlStore {
	t.Helper()

	return sqlstore.InitTestDB(t)
}
