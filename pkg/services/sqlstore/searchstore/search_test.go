// package search_test contains integration tests for search
package searchstore_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore/permissions"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
)

const (
	limit int64 = 15
	page  int64 = 1
)

func TestBuilder_EqualResults_Basic(t *testing.T) {
	user := &user.SignedInUser{
		UserID:  1,
		OrgID:   1,
		OrgRole: org.RoleEditor,
	}

	store := setupTestEnvironment(t)
	dashIds := createDashboards(t, store, 0, 1, user.OrgID)
	require.Len(t, dashIds, 1)

	// create one dashboard in another organization that shouldn't
	// be listed in the results.
	createDashboards(t, store, 1, 2, 2)

	builder := &searchstore.Builder{
		Filters: []interface{}{
			searchstore.OrgFilter{OrgId: user.OrgID},
			searchstore.TitleSorter{},
		},
		Dialect: store.GetDialect(),
	}

	res := []dashboards.DashboardSearchProjection{}
	err := store.WithDbSession(context.Background(), func(sess *db.Session) error {
		sql, params := builder.ToSQL(limit, page)
		return sess.SQL(sql, params...).Find(&res)
	})
	require.NoError(t, err)

	assert.Len(t, res, 1)
	res[0].UID = ""
	assert.EqualValues(t, []dashboards.DashboardSearchProjection{
		{
			ID:    dashIds[0],
			Title: "A",
			Slug:  "a",
			Term:  "templated",
		},
	}, res)
}

func TestBuilder_Pagination(t *testing.T) {
	user := &user.SignedInUser{
		UserID:  1,
		OrgID:   1,
		OrgRole: org.RoleViewer,
	}

	store := setupTestEnvironment(t)
	createDashboards(t, store, 0, 25, user.OrgID)

	builder := &searchstore.Builder{
		Filters: []interface{}{
			searchstore.OrgFilter{OrgId: user.OrgID},
			searchstore.TitleSorter{},
		},
		Dialect: store.GetDialect(),
	}

	resPg1 := []dashboards.DashboardSearchProjection{}
	resPg2 := []dashboards.DashboardSearchProjection{}
	resPg3 := []dashboards.DashboardSearchProjection{}
	err := store.WithDbSession(context.Background(), func(sess *db.Session) error {
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
	user := &user.SignedInUser{
		UserID:  1,
		OrgID:   1,
		OrgRole: org.RoleViewer,
	}

	store := setupTestEnvironment(t)
	createDashboards(t, store, 0, 1, user.OrgID)

	level := dashboards.PERMISSION_EDIT

	builder := &searchstore.Builder{
		Filters: []interface{}{
			searchstore.OrgFilter{OrgId: user.OrgID},
			searchstore.TitleSorter{},
			permissions.DashboardPermissionFilter{
				Dialect:         store.GetDialect(),
				OrgRole:         user.OrgRole,
				OrgId:           user.OrgID,
				UserId:          user.UserID,
				PermissionLevel: level,
			},
		},
		Dialect: store.GetDialect(),
	}

	res := []dashboards.DashboardSearchProjection{}
	err := store.WithDbSession(context.Background(), func(sess *db.Session) error {
		sql, params := builder.ToSQL(limit, page)
		return sess.SQL(sql, params...).Find(&res)
	})
	require.NoError(t, err)

	assert.Len(t, res, 0)
}

func TestBuilder_RBAC(t *testing.T) {
	testsCases := []struct {
		desc            string
		userPermissions []accesscontrol.Permission
		features        featuremgmt.FeatureToggles
		expectedParams  []interface{}
	}{
		{
			desc:     "no user permissions",
			features: featuremgmt.WithFeatures(),
			expectedParams: []interface{}{
				int64(1),
			},
		},
		{
			desc: "user with view permission",
			userPermissions: []accesscontrol.Permission{
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:1"},
			},
			features: featuremgmt.WithFeatures(),
			expectedParams: []interface{}{
				int64(1),
				int64(1),
				int64(1),
				0,
				"Viewer",
				int64(1),
				0,
				"dashboards:read",
				"dashboards:write",
				2,
				int64(1),
				int64(1),
				0,
				"Viewer",
				int64(1),
				0,
				"dashboards:read",
				"dashboards:write",
				2,
				int64(1),
				int64(1),
				0,
				"Viewer",
				int64(1),
				0,
				"folders:read",
				"dashboards:create",
				2,
			},
		},
		{
			desc: "user with view permission with nesting",
			userPermissions: []accesscontrol.Permission{
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:1"},
			},
			features: featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders),
			expectedParams: []interface{}{
				int64(1),
				int64(1),
				0,
				"Viewer",
				int64(1),
				0,
				"dashboards:read",
				"dashboards:write",
				2,
				int64(1),
				int64(1),
				0,
				"Viewer",
				int64(1),
				0,
				"folders:read",
				"dashboards:create",
				2,
				int64(1),
				int64(1),
				int64(1),
				0,
				"Viewer",
				int64(1),
				0,
				"dashboards:read",
				"dashboards:write",
				2,
			},
		},
	}

	user := &user.SignedInUser{
		UserID:  1,
		OrgID:   1,
		OrgRole: org.RoleViewer,
	}

	store := setupTestEnvironment(t)
	createDashboards(t, store, 0, 1, user.OrgID)

	recursiveQueriesAreSupported, err := store.RecursiveQueriesAreSupported()
	require.NoError(t, err)

	for _, tc := range testsCases {
		t.Run(tc.desc, func(t *testing.T) {
			if len(tc.userPermissions) > 0 {
				user.Permissions = map[int64]map[string][]string{1: accesscontrol.GroupScopesByAction(tc.userPermissions)}
			}

			level := dashboards.PERMISSION_EDIT

			builder := &searchstore.Builder{
				Filters: []interface{}{
					searchstore.OrgFilter{OrgId: user.OrgID},
					searchstore.TitleSorter{},
					permissions.NewAccessControlDashboardPermissionFilter(
						user,
						level,
						"",
						tc.features,
						recursiveQueriesAreSupported,
					),
				},
				Dialect: store.GetDialect(),
			}

			res := []dashboards.DashboardSearchProjection{}
			err := store.WithDbSession(context.Background(), func(sess *db.Session) error {
				sql, params := builder.ToSQL(limit, page)
				// TODO: replace with a proper test
				assert.Equal(t, tc.expectedParams, params)
				return sess.SQL(sql, params...).Find(&res)
			})
			require.NoError(t, err)

			assert.Len(t, res, 0)
		})
	}
}

func setupTestEnvironment(t *testing.T) db.DB {
	t.Helper()
	store := db.InitTestDB(t)
	return store
}

func createDashboards(t *testing.T, store db.DB, startID, endID int, orgID int64) []int64 {
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

		var dash *dashboards.Dashboard
		err = store.WithDbSession(context.Background(), func(sess *db.Session) error {
			dash = dashboards.NewDashboardFromJson(dashboard)
			dash.OrgID = orgID
			dash.UID = util.GenerateShortUID()
			dash.CreatedBy = 1
			dash.UpdatedBy = 1
			_, err := sess.Insert(dash)
			require.NoError(t, err)

			tags := dash.GetTags()
			if len(tags) > 0 {
				for _, tag := range tags {
					if _, err := sess.Insert(&DashboardTag{DashboardId: dash.ID, Term: tag}); err != nil {
						return err
					}
				}
			}

			return nil
		})
		require.NoError(t, err)

		createdIds = append(createdIds, dash.ID)
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

type DashboardTag struct {
	Id          int64
	DashboardId int64
	Term        string
}
