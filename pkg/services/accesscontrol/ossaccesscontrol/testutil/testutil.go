package testutil

import (
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	acdb "github.com/grafana/grafana/pkg/services/accesscontrol/database"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ossaccesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/permreg"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/licensing/licensingtest"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/supportbundles/bundleregistry"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideFolderPermissions(
	features featuremgmt.FeatureToggles,
	cfg *setting.Cfg,
	sqlStore *sqlstore.SQLStore,
) (*ossaccesscontrol.FolderPermissionsService, error) {
	actionSets := resourcepermissions.NewActionSetService(features)
	acSvc := acimpl.ProvideOSSService(
		cfg, acdb.ProvideService(sqlStore), actionSets, localcache.ProvideService(),
		features, tracing.InitializeTracerForTest(), zanzana.NewNoopClient(), sqlStore, permreg.ProvidePermissionRegistry(), nil, orgtest.NewOrgServiceFake(),
	)

	license := licensingtest.NewFakeLicensing()
	license.On("FeatureEnabled", "accesscontrol.enforcement").Return(true).Maybe()

	ac := acimpl.ProvideAccessControl(featuremgmt.WithFeatures(), zanzana.NewNoopClient())

	fStore := folderimpl.ProvideStore(sqlStore)

	quotaService := quotatest.New(false, nil)
	orgService, err := orgimpl.ProvideService(sqlStore, cfg, quotaService)
	if err != nil {
		return nil, err
	}
	teamSvc, err := teamimpl.ProvideService(sqlStore, cfg, tracing.InitializeTracerForTest())
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
	)
	if err != nil {
		return nil, err
	}

	return ossaccesscontrol.ProvideFolderPermissions(
		cfg,
		features,
		routing.NewRouteRegister(),
		sqlStore,
		ac,
		license,
		&dashboards.FakeDashboardStore{},
		fStore,
		acSvc,
		teamSvc,
		userSvc,
		actionSets,
	)
}
