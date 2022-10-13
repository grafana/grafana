package permissions_test

import (
	"context"
	"strconv"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/permissions"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIntegration_DashboardPermissionFilter(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	type testCase struct {
		desc           string
		permissions    []accesscontrol.Permission
		expectedResult int
	}

	tests := []testCase{
		{
			desc: "Should be able to view all dashboards with wildcard scope",
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionDashboardsRead, Scope: dashboards.ScopeDashboardsAll},
			},
			expectedResult: 100,
		},
		{
			desc: "Should be able to view all dashboards with folder wildcard scope",
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionDashboardsRead, Scope: dashboards.ScopeFoldersAll},
			},
			expectedResult: 100,
		},
		{
			desc: "Should be able to view a subset of dashboards with dashboard scopes",
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:11"},
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:40"},
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:22"},
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:13"},
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:55"},
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:99"},
			},
			expectedResult: 6,
		},
		{
			desc: "Should be able to view a subset of dashboards with dashboard action and folder scope",
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionDashboardsRead, Scope: "folders:uid:2"},
				{Action: dashboards.ActionDashboardsRead, Scope: "folders:uid:8"},
			},
			expectedResult: 20,
		},
		{
			desc: "Should be able to view all folders with folder wildcard",
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:*"},
			},
			expectedResult: 10,
		},
		{
			desc: "Should be able to view a subset folders",
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:2"},
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:6"},
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:9"},
			},
			expectedResult: 3,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			store := setup(t, tt.permissions)
			filter := permissions.NewAccessControlDashboardPermissionFilter(&user.SignedInUser{
				OrgID: 1, OrgRole: org.RoleViewer, Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByAction(tt.permissions)},
			}, models.PERMISSION_VIEW, "")

			var result int
			err := store.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
				q, params := filter.Where()
				_, err := sess.SQL("SELECT COUNT(*) FROM dashboard WHERE "+q, params...).Get(&result)
				return err
			})
			require.NoError(t, err)

			assert.Equal(t, tt.expectedResult, result)
		})
	}
}

func setup(t *testing.T, permissions []accesscontrol.Permission) *sqlstore.SQLStore {
	store := sqlstore.InitTestDB(t)
	err := store.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		dashes := make([]models.Dashboard, 0, 110)
		for i := 1; i <= 10; i++ {
			str := strconv.Itoa(i)
			dashes = append(dashes, models.Dashboard{
				OrgId:    1,
				Slug:     str,
				Uid:      str,
				Title:    str,
				IsFolder: true,
				Data:     simplejson.New(),
				Created:  time.Now(),
				Updated:  time.Now(),
			})
		}
		// Seed 100 dashboard
		for i := 11; i <= 110; i++ {
			str := strconv.Itoa(i)
			folderID := 10
			if i%10 != 0 {
				folderID = i % 10
			}
			dashes = append(dashes, models.Dashboard{
				OrgId:    1,
				FolderId: int64(folderID),
				Uid:      str,
				Slug:     str,
				Title:    str,
				Data:     simplejson.New(),
				Created:  time.Now(),
				Updated:  time.Now(),
			})
		}

		_, err := sess.InsertMulti(&dashes)
		if err != nil {
			return err
		}

		role := &accesscontrol.Role{
			OrgID:   0,
			UID:     "basic_viewer",
			Name:    "basic:viewer",
			Updated: time.Now(),
			Created: time.Now(),
		}
		_, err = sess.Insert(role)
		if err != nil {
			return err
		}

		_, err = sess.Insert(accesscontrol.BuiltinRole{
			OrgID:   0,
			RoleID:  role.ID,
			Role:    "Viewer",
			Created: time.Now(),
			Updated: time.Now(),
		})
		if err != nil {
			return err
		}

		for i := range permissions {
			permissions[i].RoleID = role.ID
			permissions[i].Created = time.Now()
			permissions[i].Updated = time.Now()
		}
		if len(permissions) > 0 {
			_, err = sess.InsertMulti(&permissions)
			if err != nil {
				return err
			}
		}

		return nil
	})
	require.NoError(t, err)
	return store
}
