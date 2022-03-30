// package search_test contains integration tests for search
package searchstore_test

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/permissions"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

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
	dashIds := createDashboards(t, db, 0, 1, user.OrgId)
	require.Len(t, dashIds, 1)

	// create one dashboard in another organization that shouldn't
	// be listed in the results.
	createDashboards(t, db, 1, 2, 2)

	builder := &searchstore.Builder{
		Filters: []interface{}{
			searchstore.OrgFilter{OrgId: user.OrgId},
			searchstore.TitleSorter{},
		},
		Dialect: db.Dialect,
	}

	res := []sqlstore.DashboardSearchProjection{}
	err := db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		sql, params := builder.ToSQL(limit, page)
		return sess.SQL(sql, params...).Find(&res)
	})
	require.NoError(t, err)

	assert.Len(t, res, 1)
	res[0].UID = ""
	assert.EqualValues(t, []sqlstore.DashboardSearchProjection{
		{
			ID:    dashIds[0],
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
	createDashboards(t, db, 0, 25, user.OrgId)

	builder := &searchstore.Builder{
		Filters: []interface{}{
			searchstore.OrgFilter{OrgId: user.OrgId},
			searchstore.TitleSorter{},
		},
		Dialect: db.Dialect,
	}

	resPg1 := []sqlstore.DashboardSearchProjection{}
	resPg2 := []sqlstore.DashboardSearchProjection{}
	resPg3 := []sqlstore.DashboardSearchProjection{}
	err := db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		sql, params := builder.ToSQL(15, 1)
		err := sess.SQL(sql, params...).Find(&resPg1)
		if err != nil {
			return err
		}
		sql, params = builder.ToSQL(15, 2)
		err = sess.SQL(sql, params...).Find(&resPg2)
		if err != nil {
			return err
		}

		sql, params = builder.ToSQL(15, 3)
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
	createDashboards(t, db, 0, 1, user.OrgId)

	level := models.PERMISSION_EDIT

	builder := &searchstore.Builder{
		Filters: []interface{}{
			searchstore.OrgFilter{OrgId: user.OrgId},
			searchstore.TitleSorter{},
			permissions.DashboardPermissionFilter{
				Dialect:         db.Dialect,
				OrgRole:         user.OrgRole,
				OrgId:           user.OrgId,
				UserId:          user.UserId,
				PermissionLevel: level,
			},
		},
		Dialect: db.Dialect,
	}

	res := []sqlstore.DashboardSearchProjection{}
	err := db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		sql, params := builder.ToSQL(limit, page)
		return sess.SQL(sql, params...).Find(&res)
	})
	require.NoError(t, err)

	assert.Len(t, res, 0)
}

func setupTestEnvironment(t *testing.T) *sqlstore.SQLStore {
	t.Helper()
	store := sqlstore.InitTestDB(t)
	return store
}

func createDashboards(t *testing.T, db *sqlstore.SQLStore, startID, endID int, orgID int64) []int64 {
	t.Helper()

	require.GreaterOrEqual(t, endID, startID)

	createdIds := []int64{}
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
		require.NoError(t, err)

		var dash *models.Dashboard
		err = db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
			dash = models.NewDashboardFromJson(dashboard)
			dash.OrgId = orgID
			dash.Uid = util.GenerateShortUID()
			dash.CreatedBy = 1
			dash.UpdatedBy = 1
			_, err := sess.Insert(dash)
			require.NoError(t, err)

			tags := dash.GetTags()
			if len(tags) > 0 {
				for _, tag := range tags {
					if _, err := sess.Insert(&sqlstore.DashboardTag{DashboardId: dash.Id, Term: tag}); err != nil {
						return err
					}
				}
			}

			return nil
		})
		require.NoError(t, err)

		createdIds = append(createdIds, dash.Id)
	}

	return createdIds
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
