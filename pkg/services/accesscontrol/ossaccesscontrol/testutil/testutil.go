package testutil

import (
	testifymock "github.com/stretchr/testify/mock"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	acdb "github.com/grafana/grafana/pkg/services/accesscontrol/database"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ossaccesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/permreg"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/licensing/licensingtest"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/supportbundles/bundleregistry"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	resourcepb "github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func ProvideFolderPermissions(
	features featuremgmt.FeatureToggles,
	cfg *setting.Cfg,
	sqlStore *sqlstore.SQLStore,
) (*ossaccesscontrol.FolderPermissionsService, error) {
	actionSets := resourcepermissions.NewActionSetService()

	license := licensingtest.NewFakeLicensing()
	license.On("FeatureEnabled", "accesscontrol.enforcement").Return(true).Maybe()

	ac := acimpl.ProvideAccessControl(featuremgmt.WithFeatures())

	quotaService := quotatest.New(false, nil)

	acSvc := acimpl.ProvideOSSService(
		cfg, acdb.ProvideService(sqlStore), actionSets, localcache.ProvideService(),
		features, tracing.InitializeTracerForTest(), sqlStore, permreg.ProvidePermissionRegistry(),
		nil,
	)

	orgService, err := orgimpl.ProvideService(sqlStore, cfg, quotaService)
	if err != nil {
		return nil, err
	}
	teamSvc, err := teamimpl.ProvideService(sqlStore, cfg, tracing.InitializeTracerForTest(), nil)
	if err != nil {
		return nil, err
	}
	cache := localcache.ProvideService()

	userSvc, err := userimpl.ProvideService(
		sqlStore,
		orgService,
		cfg,
		teamSvc,
		cache,
		tracing.InitializeTracerForTest(),
		quotaService,
		bundleregistry.ProvideService(),
		nil,
	)
	if err != nil {
		return nil, err
	}

	searchMock := &resource.MockResourceClient{}
	searchMock.On("Search", testifymock.Anything, testifymock.Anything, testifymock.Anything).Return(&resourcepb.ResourceSearchResponse{TotalHits: 0}, nil).Maybe()
	searchMock.On("GetStats", testifymock.Anything, testifymock.Anything, testifymock.Anything).Return(&resourcepb.ResourceStatsResponse{}, nil).Maybe()
	fService := folderimpl.ProvideService(
		ac,
		userSvc, features, supportbundlestest.NewFakeBundleService(), nil, cfg, nil, tracing.InitializeTracerForTest(), searchMock, sort.ProvideService(), apiserver.WithoutRestConfig)

	return ossaccesscontrol.ProvideFolderPermissions(
		cfg,
		features,
		routing.NewRouteRegister(),
		sqlStore,
		ac,
		license,
		fService,
		acSvc,
		teamSvc,
		userSvc,
		actionSets,
		apiserver.ProvideDirectRestConfigProvider(),
	)
}
