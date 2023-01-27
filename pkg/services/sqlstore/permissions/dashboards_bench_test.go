package permissions_test

import (
	"context"
	"fmt"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/permissions"
	"github.com/grafana/grafana/pkg/services/user"
)

func benchmarkDashboardPermissionFilter(b *testing.B, numUsers, numDashboards int) {
	store := setupBenchMark(b, numUsers, numDashboards)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		usr := &user.SignedInUser{UserID: 1, OrgID: 1, OrgRole: org.RoleViewer, Permissions: map[int64]map[string][]string{1: {}}}
		filter := permissions.NewAccessControlDashboardPermissionFilter(usr, dashboards.PERMISSION_VIEW, "")
		var result int
		err := store.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
			q, params := filter.Where()
			_, err := sess.SQL("SELECT COUNT(*) FROM dashboard WHERE "+q, params...).Get(&result)
			return err
		})
		require.NoError(b, err)
		assert.Equal(b, numDashboards, result)
	}
}

func setupBenchMark(b *testing.B, numUsers, numDashboards int) db.DB {
	store := db.InitTestDB(b)
	now := time.Now()
	err := store.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		dashes := make([]dashboards.Dashboard, 0, numDashboards)
		for i := 1; i <= numDashboards; i++ {
			str := strconv.Itoa(i)
			dashes = append(dashes, dashboards.Dashboard{
				OrgID:    1,
				IsFolder: false,
				UID:      str,
				Slug:     str,
				Title:    str,
				Data:     simplejson.New(),
				Created:  now,
				Updated:  now,
			})
		}

		err := batch(len(dashes), 1000, func(start, end int) error {
			_, err := sess.InsertMulti(dashes[start:end])
			return err
		})
		require.NoError(b, err)

		roles := make([]accesscontrol.Role, 0, numUsers)
		assignments := make([]accesscontrol.UserRole, 0, numUsers)
		permissions := make([]accesscontrol.Permission, 0, numUsers*numDashboards)
		for i := 1; i <= numUsers; i++ {
			name := fmt.Sprintf("managed_%d", i)
			roles = append(roles, accesscontrol.Role{
				UID:     name,
				Name:    name,
				Updated: now,
				Created: now,
			})
			assignments = append(assignments, accesscontrol.UserRole{
				RoleID:  int64(i),
				UserID:  int64(i),
				Created: now,
			})
			for _, dash := range dashes {
				permissions = append(permissions, accesscontrol.Permission{
					RoleID:  int64(i),
					Action:  dashboards.ActionDashboardsRead,
					Scope:   dashboards.ScopeDashboardsProvider.GetResourceScopeUID(dash.UID),
					Updated: now,
					Created: now,
				})
			}
		}

		err = batch(len(roles), 5000, func(start, end int) error {
			_, err := sess.InsertMulti(roles[start:end])
			return err
		})
		require.NoError(b, err)

		err = batch(len(assignments), 5000, func(start, end int) error {
			_, err := sess.InsertMulti(assignments[start:end])
			return err
		})
		require.NoError(b, err)

		err = batch(len(permissions), 5000, func(start, end int) error {
			_, err := sess.InsertMulti(permissions[start:end])
			return err
		})
		require.NoError(b, err)
		return nil
	})

	require.NoError(b, err)
	return store
}

func BenchmarkDashboardPermissionFilter_100_100(b *testing.B) {
	benchmarkDashboardPermissionFilter(b, 100, 100)
}

func BenchmarkDashboardPermissionFilter_100_1000(b *testing.B) {
	benchmarkDashboardPermissionFilter(b, 100, 1000)
}

func BenchmarkDashboardPermissionFilter_300_10000(b *testing.B) {
	benchmarkDashboardPermissionFilter(b, 300, 10000)
}

func batch(count, batchSize int, eachFn func(start, end int) error) error {
	for i := 0; i < count; {
		end := i + batchSize
		if end > count {
			end = count
		}

		if err := eachFn(i, end); err != nil {
			return err
		}

		i = end
	}

	return nil
}
