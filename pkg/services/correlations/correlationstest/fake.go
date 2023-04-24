package correlationstest

import (
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/correlations"
	"github.com/grafana/grafana/pkg/services/datasources"
	fakeDatasources "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

func New(sqlStore *sqlstore.SQLStore) *correlations.CorrelationsService {
	ds := &fakeDatasources.FakeDataSourceService{
		DataSources: []*datasources.DataSource{
			{ID: 1, UID: "graphite", Type: datasources.DS_GRAPHITE},
		},
	}

	correlationsSvc, _ := correlations.ProvideService(sqlStore, routing.NewRouteRegister(), ds, acimpl.ProvideAccessControl(setting.NewCfg()), sqlStore.Bus(), quotatest.New(false, nil), sqlStore.Cfg)
	return correlationsSvc
}
