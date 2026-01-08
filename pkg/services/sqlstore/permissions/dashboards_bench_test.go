package permissions_test

import (
	"context"
	"fmt"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/permissions"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

func benchmarkDashboardPermissionFilter(b *testing.B, numUsers, numDashboards, numFolders, nestingLevel int) {
	usr := user.SignedInUser{UserID: 1, OrgID: 1, OrgRole: org.RoleViewer, Permissions: map[int64]map[string][]string{
		1: accesscontrol.GroupScopesByActionContext(context.Background(), []accesscontrol.Permission{
			{
				Action: dashboards.ActionFoldersCreate,
				Scope:  dashboards.ScopeFoldersAll,
			},
		}),
	}}

	features := featuremgmt.WithFeatures()
	store := setupBenchMark(b, usr, features, numUsers, numDashboards, numFolders, nestingLevel)

	recursiveQueriesAreSupported, err := store.RecursiveQueriesAreSupported()
	require.NoError(b, err)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		filter := permissions.NewAccessControlDashboardPermissionFilter(&usr, dashboardaccess.PERMISSION_VIEW, "", features, recursiveQueriesAreSupported, store.GetDialect())
		var result int
		err := store.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
			q, params := filter.Where()
			recQry, recQryParams := filter.With()
			params = append(recQryParams, params...)
			_, err := sess.SQL(recQry+"SELECT COUNT(*) FROM dashboard WHERE "+q, params...).Get(&result)
			return err
		})
		require.NoError(b, err)
		assert.Equal(b, numDashboards, result)
	}
}

func setupBenchMark(b *testing.B, usr user.SignedInUser, features featuremgmt.FeatureToggles, numUsers, numDashboards, numFolders, nestingLevel int) db.DB {
	if nestingLevel > folder.MaxNestedFolderDepth {
		nestingLevel = folder.MaxNestedFolderDepth
	}

	store, cfg := db.InitTestDBWithCfg(b)

	dashboardWriteStore, err := database.ProvideDashboardStore(store, cfg, features, tagimpl.ProvideService(store))
	require.NoError(b, err)

	fStore := folderimpl.ProvideStore(store)
	folderSvc := folderimpl.ProvideService(
		fStore, mock.New(), bus.ProvideBus(tracing.InitializeTracerForTest()), dashboardWriteStore,
		nil, store, features, supportbundlestest.NewFakeBundleService(), nil, cfg, nil, tracing.InitializeTracerForTest(), nil, dualwrite.ProvideTestService(), sort.ProvideService(), apiserver.WithoutRestConfig)

	rootFolders := make([]*folder.Folder, 0, numFolders)
	dashes := make([]dashboards.Dashboard, 0, numDashboards)
	parentUID := ""
	for i := 0; i < numFolders; i++ {
		uid := fmt.Sprintf("f%d", i)
		f, err := folderSvc.Create(context.Background(), &folder.CreateFolderCommand{
			UID:          uid,
			OrgID:        usr.OrgID,
			Title:        uid,
			SignedInUser: &usr,
			ParentUID:    parentUID,
		})
		require.NoError(b, err)
		rootFolders = append(rootFolders, f)

		parentUID := f.UID
		var leaf *folder.Folder
		for j := 1; j <= nestingLevel; j++ {
			uid := fmt.Sprintf("f%d_%d", i, j)
			sf, err := folderSvc.Create(context.Background(), &folder.CreateFolderCommand{
				UID:          uid,
				OrgID:        usr.OrgID,
				Title:        uid,
				SignedInUser: &usr,
				ParentUID:    parentUID,
			})
			require.NoError(b, err)
			parentUID = sf.UID
			leaf = sf
		}

		str := fmt.Sprintf("dashboard under folder %s", leaf.Title)
		now := time.Now()
		dashes = append(dashes, dashboards.Dashboard{
			OrgID:     usr.OrgID,
			IsFolder:  false,
			UID:       str,
			Slug:      str,
			Title:     str,
			Data:      simplejson.New(),
			Created:   now,
			Updated:   now,
			FolderUID: leaf.UID,
		})
	}

	err = store.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		now := time.Now()
		for i := len(dashes); i < numDashboards; i++ {
			str := strconv.Itoa(i)
			dashes = append(dashes, dashboards.Dashboard{
				OrgID:    usr.OrgID,
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
				// add permission to read dashboards under the general
				if dash.FolderUID == "" {
					permissions = append(permissions, accesscontrol.Permission{
						RoleID:  int64(i),
						Action:  dashboards.ActionDashboardsRead,
						Scope:   dashboards.ScopeDashboardsProvider.GetResourceScopeUID(dash.UID),
						Updated: now,
						Created: now,
					})
				}
			}

			for _, f := range rootFolders {
				// add permission to read folders under specific folders
				permissions = append(permissions, accesscontrol.Permission{
					RoleID:  int64(i),
					Action:  dashboards.ActionDashboardsRead,
					Scope:   dashboards.ScopeFoldersProvider.GetResourceScopeUID(f.UID),
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

func BenchmarkDashboardPermissionFilter_100_100_0_0(b *testing.B) {
	benchmarkDashboardPermissionFilter(b, 100, 100, 0, 0)
}

func BenchmarkDashboardPermissionFilter_100_100_10_2(b *testing.B) {
	benchmarkDashboardPermissionFilter(b, 100, 100, 10, 2)
}

func BenchmarkDashboardPermissionFilter_100_100_10_4(b *testing.B) {
	benchmarkDashboardPermissionFilter(b, 100, 100, 10, 4)
}

func BenchmarkDashboardPermissionFilter_100_100_10_8(b *testing.B) {
	benchmarkDashboardPermissionFilter(b, 100, 100, 10, 8)
}

func BenchmarkDashboardPermissionFilter_100_1000_0_0(b *testing.B) {
	benchmarkDashboardPermissionFilter(b, 100, 1000, 0, 0)
}

func BenchmarkDashboardPermissionFilter_100_1000_10_2(b *testing.B) {
	benchmarkDashboardPermissionFilter(b, 100, 1000, 10, 2)
}

func BenchmarkDashboardPermissionFilter_100_1000_10_4(b *testing.B) {
	benchmarkDashboardPermissionFilter(b, 100, 1000, 10, 4)
}

func BenchmarkDashboardPermissionFilter_100_1000_10_8(b *testing.B) {
	benchmarkDashboardPermissionFilter(b, 100, 1000, 10, 8)
}

func BenchmarkDashboardPermissionFilter_300_10000_0_0(b *testing.B) {
	benchmarkDashboardPermissionFilter(b, 300, 10000, 0, 0)
}

func BenchmarkDashboardPermissionFilter_300_10000_10_2(b *testing.B) {
	benchmarkDashboardPermissionFilter(b, 300, 10000, 10, 2)
}

func BenchmarkDashboardPermissionFilter_300_10000_10_4(b *testing.B) {
	benchmarkDashboardPermissionFilter(b, 300, 10000, 10, 4)
}

func BenchmarkDashboardPermissionFilter_300_10000_10_8(b *testing.B) {
	benchmarkDashboardPermissionFilter(b, 300, 10000, 10, 8)
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
