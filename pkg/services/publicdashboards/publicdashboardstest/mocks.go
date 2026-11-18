package publicdashboardstest

import "github.com/grafana/grafana/pkg/services/publicdashboards/internal/testhelpers"

type (
	FakePublicDashboardService        = testhelpers.FakePublicDashboardService
	FakePublicDashboardServiceWrapper = testhelpers.FakePublicDashboardServiceWrapper
)

var (
	NewFakePublicDashboardMiddleware     = testhelpers.NewFakePublicDashboardMiddleware
	NewFakePublicDashboardService        = testhelpers.NewFakePublicDashboardService
	NewFakePublicDashboardServiceWrapper = testhelpers.NewFakePublicDashboardServiceWrapper
)
