package correlationstest

import (
	"context"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/correlations"
	"github.com/grafana/grafana/pkg/services/datasources"
	fakeDatasources "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func New(ctx context.Context, db db.DB, cfg *setting.Cfg, bus bus.Bus) *correlations.CorrelationsService {
	ds := &fakeDatasources.FakeDataSourceService{
		DataSources: []*datasources.DataSource{
			{ID: 1, UID: "graphite", Type: datasources.DS_GRAPHITE},
		},
	}

	clientGenerator := apiserver.ProvideClientGenerator(apiserver.ProvideEventualRestConfigProvider())

	correlationsSvc, _ := correlations.ProvideService(ctx, db, routing.NewRouteRegister(), ds, acimpl.ProvideAccessControl(featuremgmt.WithFeatures()), bus, quotatest.New(false, nil), cfg, clientGenerator, apiserver.ProvideEventualRestConfigProvider(), usertest.NewUserServiceFake(), &resource.MockResourceClient{})
	return correlationsSvc.(*correlations.CorrelationsService)
}
