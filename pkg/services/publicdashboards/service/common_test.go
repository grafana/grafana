package service

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/annotations/annotationsimpl"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing/licensingtest"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/grafana/grafana/pkg/services/publicdashboards/database"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/publicdashboards/service/intervalv2"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
)

func newPublicDashboardServiceImpl(
	t *testing.T,
	publicDashboardStore publicdashboards.Store,
	dashboardService dashboards.DashboardService,
	annotationsRepo annotations.Repository,
) (*PublicDashboardServiceImpl, *sqlstore.SQLStore) {
	t.Helper()

	sqlStore := sqlstore.InitTestDB(t)
	tagService := tagimpl.ProvideService(sqlStore)
	if annotationsRepo == nil {
		annotationsRepo = annotationsimpl.ProvideService(sqlStore, sqlStore.Cfg, featuremgmt.WithFeatures(), tagService)
	}

	if publicDashboardStore == nil {
		publicDashboardStore = database.ProvideStore(sqlStore, sqlStore.Cfg, featuremgmt.WithFeatures())
	}
	serviceWrapper := ProvideServiceWrapper(publicDashboardStore)

	license := licensingtest.NewFakeLicensing()
	license.On("FeatureEnabled", FeaturePublicDashboardsEmailSharing).Return(false)

	return &PublicDashboardServiceImpl{
		AnnotationsRepo:    annotationsRepo,
		log:                log.New("test.logger"),
		intervalCalculator: intervalv2.NewCalculator(),
		dashboardService:   dashboardService,
		store:              publicDashboardStore,
		serviceWrapper:     serviceWrapper,
		license:            license,
	}, sqlStore
}
