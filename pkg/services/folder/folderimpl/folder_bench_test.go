package folderimpl

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func BenchmarkFolderService_GetRootChildren_10000_1_CachingOff(b *testing.B) {
	benchmarkFolderService_GetChildren(b, 10000, "", 1, false)
}

func BenchmarkFolderService_GetRootChildren_10000_8_CachingOff(b *testing.B) {
	benchmarkFolderService_GetChildren(b, 10000, "", 8, false)
}

func BenchmarkFolderService_GetRootChildren_10000_64_CachingOff(b *testing.B) {
	benchmarkFolderService_GetChildren(b, 10000, "", 64, false)
}

func BenchmarkFolderService_GetRootChildren_10000_1_CachingOn(b *testing.B) {
	benchmarkFolderService_GetChildren(b, 10000, "", 1, true)
}

func BenchmarkFolderService_GetRootChildren_10000_8_CachingOn(b *testing.B) {
	benchmarkFolderService_GetChildren(b, 10000, "", 8, true)
}

func BenchmarkFolderService_GetRootChildren_10000_64_CachingOn(b *testing.B) {
	benchmarkFolderService_GetChildren(b, 10000, "", 64, true)
}

func setupGetChildren(b testing.TB, folderNum int, parentUID string, overrideConcurrencyFactor int, cachingOn bool) (*Service, user.SignedInUser) {
	db := sqlstore.InitTestDB(b)
	quotaService := quotatest.New(false, nil)
	folderStore := ProvideDashboardFolderStore(db)
	cfg := setting.NewCfg()

	featuresFlagOn := featuremgmt.WithFeatures("nestedFolders")
	dashStore, err := database.ProvideDashboardStore(db, db.Cfg, featuresFlagOn, tagimpl.ProvideService(db, db.Cfg), quotaService)
	require.NoError(b, err)
	nestedFolderStore := ProvideStore(db, db.Cfg, featuresFlagOn, overrideConcurrencyFactor)

	origNewGuardian := guardian.New
	guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanSaveValue: true, CanViewValue: true})

	b.Cleanup(func() {
		guardian.New = origNewGuardian
	})

	serviceWithFlagOn := &Service{
		cfg:                  cfg,
		log:                  log.New("test-folder-service"),
		dashboardStore:       dashStore,
		dashboardFolderStore: folderStore,
		store:                nestedFolderStore,
		features:             featuresFlagOn,
		bus:                  bus.ProvideBus(tracing.InitializeTracerForTest()),
		db:                   db,
		accessControl:        acimpl.ProvideAccessControl(cfg),
		registry:             make(map[string]folder.RegistryService),
		concurrencyFactor:    overrideConcurrencyFactor,
		caching:              cachingOn,
		cacheService:         localcache.ProvideService(),
	}

	var orgID = int64(1)
	signedInUser := user.SignedInUser{UserID: 1, OrgID: orgID, Permissions: map[int64]map[string][]string{
		orgID: {dashboards.ActionFoldersCreate: {}, dashboards.ActionFoldersWrite: {dashboards.ScopeFoldersAll}},
	}}

	for i := 0; i < folderNum; i++ {
		_, err := serviceWithFlagOn.Create(context.Background(), &folder.CreateFolderCommand{
			OrgID:        orgID,
			Title:        fmt.Sprintf("folder%d", i),
			ParentUID:    parentUID,
			SignedInUser: &signedInUser,
		})
		require.NoError(b, err)
	}
	return serviceWithFlagOn, signedInUser
}

func benchmarkFolderService_GetChildren(b *testing.B, folderNum int, parentUID string, overrideConcurrencyFactor int, overrideCaching bool) {
	serviceWithFlagOn, signedInUser := setupGetChildren(b, folderNum, parentUID, overrideConcurrencyFactor, overrideCaching)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		res, err := serviceWithFlagOn.GetChildren(context.Background(), &folder.GetChildrenQuery{
			OrgID:        orgID,
			UID:          parentUID,
			SignedInUser: &signedInUser,
		})
		assert.NoError(b, err)
		assert.Len(b, res, folderNum)
	}
}
