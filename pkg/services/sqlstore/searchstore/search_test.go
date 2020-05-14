// package search_test contains integration tests for search
package searchstore_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/permissions"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var dialect migrator.Dialect

const (
	limit int64 = 15
	page  int64 = 1
)

func TestBuilder_EqualResults_Basic(t *testing.T) {
	user := &models.SignedInUser{
		UserId:  1,
		OrgId:   1,
		OrgRole: models.ROLE_EDITOR,
	}

	db := setupTestEnvironment(t)
	err := createDashboards(0, 1, user.OrgId)
	require.NoError(t, err)

	// create one dashboard in another organization that shouldn't
	// be listed in the results.
	err = createDashboards(1, 2, 2)
	require.NoError(t, err)

	builder := &searchstore.Builder{
		Filters: []interface{}{
			searchstore.OrgFilter{OrgId: user.OrgId},
			searchstore.TitleSorter{},
		},
		Dialect: dialect,
	}

	res := []sqlstore.DashboardSearchProjection{}
	err = db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		sql, params := builder.ToSql(limit, page)
		return sess.SQL(sql, params...).Find(&res)
	})
	require.NoError(t, err)

	assert.Len(t, res, 1)
	res[0].Uid = ""
	assert.EqualValues(t, []sqlstore.DashboardSearchProjection{
		{
			Id:    1,
			Title: "A",
			Slug:  "a",
			Term:  "templated",
		},
	}, res)
}

func TestBuilder_Pagination(t *testing.T) {
	user := &models.SignedInUser{
		UserId:  1,
		OrgId:   1,
		OrgRole: models.ROLE_VIEWER,
	}

	db := setupTestEnvironment(t)
	err := createDashboards(0, 25, user.OrgId)
	require.NoError(t, err)

	builder := &searchstore.Builder{
		Filters: []interface{}{
			searchstore.OrgFilter{OrgId: user.OrgId},
			searchstore.TitleSorter{},
		},
		Dialect: dialect,
	}

	resPg1 := []sqlstore.DashboardSearchProjection{}
	resPg2 := []sqlstore.DashboardSearchProjection{}
	resPg3 := []sqlstore.DashboardSearchProjection{}
	err = db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		sql, params := builder.ToSql(15, 1)
		err := sess.SQL(sql, params...).Find(&resPg1)
		if err != nil {
			return err
		}
		sql, params = builder.ToSql(15, 2)
		err = sess.SQL(sql, params...).Find(&resPg2)
		if err != nil {
			return err
		}

		sql, params = builder.ToSql(15, 3)
		return sess.SQL(sql, params...).Find(&resPg3)
	})
	require.NoError(t, err)

	assert.Len(t, resPg1, 15)
	assert.Len(t, resPg2, 10)
	assert.Len(t, resPg3, 0, "sanity check: pages after last should be empty")

	assert.Equal(t, "A", resPg1[0].Title, "page 1 should start with the first dashboard")
	assert.Equal(t, "P", resPg2[0].Title, "page 2 should start with the 16th dashboard")
}

func TestBuilder_Permissions(t *testing.T) {
	user := &models.SignedInUser{
		UserId:  1,
		OrgId:   1,
		OrgRole: models.ROLE_VIEWER,
	}

	db := setupTestEnvironment(t)
	err := createDashboards(0, 1, user.OrgId)
	require.NoError(t, err)

	level := models.PERMISSION_EDIT

	builder := &searchstore.Builder{
		Filters: []interface{}{
			searchstore.OrgFilter{OrgId: user.OrgId},
			searchstore.TitleSorter{},
			permissions.DashboardPermissionFilter{
				Dialect:         dialect,
				OrgRole:         user.OrgRole,
				OrgId:           user.OrgId,
				UserId:          user.UserId,
				PermissionLevel: level,
			},
		},
		Dialect: dialect,
	}

	res := []sqlstore.DashboardSearchProjection{}
	err = db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		sql, params := builder.ToSql(limit, page)
		return sess.SQL(sql, params...).Find(&res)
	})
	require.NoError(t, err)

	assert.Len(t, res, 0)
}

func setupTestEnvironment(t *testing.T) *sqlstore.SqlStore {
	t.Helper()
	store := sqlstore.InitTestDB(t)
	dialect = store.Dialect
	return store
}

func createDashboards(startID, endID int, orgID int64) error {
	if endID < startID {
		return fmt.Errorf("startID must be smaller than endID")
	}

	for i := startID; i < endID; i++ {
		dashboard, err := simplejson.NewJson([]byte(`{
			"id": null,
			"uid": null,
			"title": "` + lexiCounter(i) + `",
			"tags": [ "templated" ],
			"timezone": "browser",
			"schemaVersion": 16,
			"version": 0
		}`))
		if err != nil {
			return err
		}
		err = sqlstore.SaveDashboard(&models.SaveDashboardCommand{
			Dashboard: dashboard,
			UserId:    1,
			OrgId:     orgID,
			UpdatedAt: time.Now(),
		})
		if err != nil {
			return err
		}
	}
	return nil
}

// lexiCounter counts in a lexicographically sortable order.
func lexiCounter(n int) string {
	alphabet := "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	value := string(alphabet[n%26])

	if n >= 26 {
		value = lexiCounter(n/26-1) + value
	}

	return value
}
