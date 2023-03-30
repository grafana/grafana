package searchV2

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

// setupBenchEnv will set up a database with folderCount folders and dashboardsPerFolder dashboards per folder
// It will also set up and run the search service
// and create a signed in user object with explicit permissions on each dashboard and folder.
func setupBenchEnv(b *testing.B, folderCount, dashboardsPerFolder int) (*StandardSearchService, *user.SignedInUser, error) {
	sqlStore := db.InitTestDB(b)
	err := populateDB(folderCount, dashboardsPerFolder, sqlStore)
	require.NoError(b, err, "error when populating the database")

	// load all dashboards and folders
	dbLoadingBatchSize := (dashboardsPerFolder + 1) * folderCount
	cfg := &setting.Cfg{Search: setting.SearchSettings{DashboardLoadingBatchSize: dbLoadingBatchSize}}
	features := featuremgmt.WithFeatures()
	orgSvc := &orgtest.FakeOrgService{
		ExpectedOrgs: []*org.OrgDTO{{ID: 1}},
	}
	searchService, ok := ProvideService(cfg, sqlStore, store.NewDummyEntityEventsService(), actest.FakeService{},
		tracing.InitializeTracerForTest(), features, orgSvc, nil, nil).(*StandardSearchService)
	require.True(b, ok)

	err = runSearchService(searchService)
	require.NoError(b, err, "error when running search service")

	user := getSignedInUser(folderCount, dashboardsPerFolder)

	return searchService, user, nil
}

// Returns a signed in user object with permissions on all dashboards and folders
func getSignedInUser(folderCount, dashboardsPerFolder int) *user.SignedInUser {
	folderScopes := make([]string, folderCount)
	for i := 1; i <= folderCount; i++ {
		folderScopes[i-1] = dashboards.ScopeFoldersProvider.GetResourceScopeUID(fmt.Sprintf("folder%d", i))
	}

	dashScopes := make([]string, folderCount*dashboardsPerFolder)
	for i := folderCount + 1; i <= (folderCount * (dashboardsPerFolder + 1)); i++ {
		dashScopes[i-(folderCount+1)] = dashboards.ScopeDashboardsProvider.GetResourceScopeUID(fmt.Sprintf("dashboard%d", i))
	}

	user := &user.SignedInUser{
		UserID: 1,
		OrgID:  1,
		Permissions: map[int64]map[string][]string{
			1: {
				dashboards.ActionDashboardsRead: dashScopes,
				dashboards.ActionFoldersRead:    folderScopes,
			},
		},
	}

	return user
}

// Runs initial indexing of search service
func runSearchService(searchService *StandardSearchService) error {
	if err := searchService.dashboardIndex.buildInitialIndexes(context.Background(), []int64{int64(1)}); err != nil {
		return err
	}
	searchService.dashboardIndex.initialIndexingComplete = true

	// Required for sync that is called during dashboard search
	go func() {
		for {
			doneCh := <-searchService.dashboardIndex.syncCh
			close(doneCh)
		}
	}()

	return nil
}

// Populates database with dashboards and folders
func populateDB(folderCount, dashboardsPerFolder int, sqlStore *sqlstore.SQLStore) error {
	// Insert folders
	offset := 1
	if errInsert := actest.ConcurrentBatch(actest.Concurrency, folderCount, actest.BatchSize, func(start, end int) error {
		n := end - start
		folders := make([]dashboards.Dashboard, 0, n)
		now := time.Now()

		for u := start; u < end; u++ {
			folderID := int64(u + offset)
			folders = append(folders, dashboards.Dashboard{
				ID:       folderID,
				UID:      fmt.Sprintf("folder%v", folderID),
				Title:    fmt.Sprintf("folder%v", folderID),
				IsFolder: true,
				OrgID:    1,
				Created:  now,
				Updated:  now,
			})
		}

		err := sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			if _, err := sess.Insert(folders); err != nil {
				return err
			}
			return nil
		})
		return err
	}); errInsert != nil {
		return errInsert
	}

	// Insert dashboards
	offset += folderCount
	if errInsert := actest.ConcurrentBatch(actest.Concurrency, dashboardsPerFolder*folderCount, actest.BatchSize, func(start, end int) error {
		n := end - start
		dbs := make([]dashboards.Dashboard, 0, n)
		now := time.Now()

		for u := start; u < end; u++ {
			dashID := int64(u + offset)
			folderID := int64((u+offset)%folderCount + 1)
			dbs = append(dbs, dashboards.Dashboard{
				ID:       dashID,
				UID:      fmt.Sprintf("dashboard%v", dashID),
				Title:    fmt.Sprintf("dashboard%v", dashID),
				IsFolder: false,
				FolderID: folderID,
				OrgID:    1,
				Created:  now,
				Updated:  now,
			})
		}

		err := sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			if _, err := sess.Insert(dbs); err != nil {
				return err
			}
			return nil
		})
		return err
	}); errInsert != nil {
		return errInsert
	}

	return nil
}

func benchSearchV2(b *testing.B, folderCount, dashboardsPerFolder int) {
	searchService, testUser, err := setupBenchEnv(b, folderCount, dashboardsPerFolder)
	require.NoError(b, err)

	b.ResetTimer()

	expectedResultCount := (dashboardsPerFolder + 1) * folderCount
	for n := 0; n < b.N; n++ {
		result := searchService.doDashboardQuery(context.Background(), testUser, 1, DashboardQuery{Limit: expectedResultCount})
		require.NoError(b, result.Error)
		require.NotZero(b, len(result.Frames))
		for _, field := range result.Frames[0].Fields {
			if field.Name == "uid" {
				require.Equal(b, expectedResultCount, field.Len())
				break
			}
		}
	}
}

// Test with some dashboards and some folders
func BenchmarkSearchV2_10_10(b *testing.B) {
	benchSearchV2(b, 10, 10)
} // ~0.0002 s/op
func BenchmarkSearchV2_10_100(b *testing.B) {
	benchSearchV2(b, 10, 100)
} // ~0.002 s/op

// Test with many dashboards and only one folder
func BenchmarkSearchV2_1_1k(b *testing.B) {
	benchSearchV2(b, 1, 1000)
} // ~0.002 s/op
func BenchmarkSearchV2_1_10k(b *testing.B) {
	benchSearchV2(b, 1, 10000)
} // ~0.019 s/op

// Test with a large number of dashboards and folders
func BenchmarkSearchV2_100_100(b *testing.B) {
	benchSearchV2(b, 100, 100)
} // ~0.02 s/op
func BenchmarkSearchV2_100_1k(b *testing.B) {
	benchSearchV2(b, 100, 1000)
} // ~0.22 s/op
func BenchmarkSearchV2_1k_100(b *testing.B) {
	benchSearchV2(b, 1000, 100)
} // ~0.22 s/op
