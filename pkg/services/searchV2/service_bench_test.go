package searchV2

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/grafana/dskit/backoff"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/models"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/querylibrary/querylibraryimpl"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/stretchr/testify/require"
)

const concurrency = 10
const batchSize = 100

type bounds struct {
	start, end int
}

// concurrentBatch spawns the requested amount of workers then ask them to run eachFn on chunks of the requested size
func concurrentBatch(workers, count, size int, eachFn func(start, end int) error) error {
	var wg sync.WaitGroup
	alldone := make(chan bool) // Indicates that all workers have finished working
	chunk := make(chan bounds) // Gives the workers the bounds they should work with
	ret := make(chan error)    // Allow workers to notify in case of errors
	defer close(ret)

	// Launch all workers
	for x := 0; x < workers; x++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for ck := range chunk {
				if err := eachFn(ck.start, ck.end); err != nil {
					ret <- err
					return
				}
			}
		}()
	}

	go func() {
		// Tell the workers the chunks they have to work on
		for i := 0; i < count; {
			end := i + size
			if end > count {
				end = count
			}

			chunk <- bounds{start: i, end: end}

			i = end
		}
		close(chunk)

		// Wait for the workers
		wg.Wait()
		close(alldone)
	}()

	// wait for an error or for all workers to be done
	select {
	case err := <-ret:
		return err
	case <-alldone:
		break
	}
	return nil
}

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

	orgSvc := orgtest.NewOrgServiceFake()
	orgSvc.ExpectedOrgs = []*org.OrgDTO{{ID: 1}}
	querySvc := querylibraryimpl.ProvideService(cfg, features)

	searchService, ok := ProvideService(cfg, sqlStore, store.NewDummyEntityEventsService(), accesscontrolmock.New(),
		tracing.InitializeTracerForTest(), features, orgSvc, nil, querySvc).(*StandardSearchService)
	require.True(b, ok)

	err = runSearchService(b, searchService)
	require.NoError(b, err, "error when running search service")

	user := getSignedInUser(folderCount, dashboardsPerFolder)

	return searchService, user, nil
}

func getSignedInUser(folderCount, dashboardsPerFolder int) *user.SignedInUser {
	folderScopes := make([]string, folderCount)
	for i := 1; i <= folderCount; i++ {
		folderScopes[i-1] = dashboards.ScopeFoldersProvider.GetResourceScopeUID(fmt.Sprintf("folder%d", i))
	}

	dashScopes := make([]string, folderCount*dashboardsPerFolder)
	for i := folderCount + 1; i <= ((folderCount + 1) * dashboardsPerFolder); i++ {
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

// Runs search service (indexing etc) and waits until it becomes ready
func runSearchService(b *testing.B, searchService *StandardSearchService) error {
	go func() {
		err := searchService.Run(context.Background())
		require.NoError(b, err)
	}()

	backoff := backoff.New(context.Background(), backoff.Config{MaxBackoff: time.Second * 15})
	var ready bool
	for {
		ready = searchService.IsReady(context.Background(), 1).IsReady
		if ready {
			break
		}
		backoff.Wait()
		if !backoff.Ongoing() {
			break
		}
	}
	if !ready {
		return fmt.Errorf("search service did not become ready within the allocsted time")
	}
	return nil
}

// Populates database with dashboards and folders
func populateDB(folderCount, dashboardsPerFolder int, sqlStore *sqlstore.SQLStore) error {
	// Insert folders
	offset := 1
	if errInsert := concurrentBatch(concurrency, folderCount, batchSize, func(start, end int) error {
		n := end - start
		folders := make([]models.Dashboard, 0, n)
		now := time.Now()

		for u := start; u < end; u++ {
			folderID := int64(u + offset)
			folders = append(folders, models.Dashboard{
				Id:       folderID,
				Uid:      fmt.Sprintf("folder%v", folderID),
				Title:    fmt.Sprintf("folder%v", folderID),
				IsFolder: true,
				OrgId:    1,
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
	if errInsert := concurrentBatch(concurrency, dashboardsPerFolder*folderCount, batchSize, func(start, end int) error {
		n := end - start
		dashboards := make([]models.Dashboard, 0, n)
		now := time.Now()

		for u := start; u < end; u++ {
			dashID := int64(u + offset)
			folderID := int64((u+offset)%folderCount + 1)
			dashboards = append(dashboards, models.Dashboard{
				Id:       dashID,
				Uid:      fmt.Sprintf("dashboard%v", dashID),
				Title:    fmt.Sprintf("dashboard%v", dashID),
				IsFolder: false,
				FolderId: folderID,
				OrgId:    1,
				Created:  now,
				Updated:  now,
			})
		}

		err := sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			if _, err := sess.Insert(dashboards); err != nil {
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
} //
func BenchmarkSearchV2_10_100(b *testing.B) {
	benchSearchV2(b, 10, 100)
} //

// Test with many dashboards and only one folder
func BenchmarkSearchV2_1_1k(b *testing.B) {
	benchSearchV2(b, 1, 1000)
} // ~0.0045 s/op
func BenchmarkSearchV2_1_10k(b *testing.B) {
	benchSearchV2(b, 1, 10000)
} //

// Test with a large number of dashboards and folders
func BenchmarkSearchV2_100_100(b *testing.B) {
	benchSearchV2(b, 100, 100)
} //
func BenchmarkSearchV2_100_1k(b *testing.B) {
	benchSearchV2(b, 100, 1000)
} // ~0.55 s/op
func BenchmarkSearchV2_1k_100(b *testing.B) {
	benchSearchV2(b, 1000, 100)
} // ~0.54 s/op
func BenchmarkSearchV2_1k_1k(b *testing.B) {
	benchSearchV2(b, 1000, 1000)
} // ~3.10 s/op
