package datasource

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/datasources"
	fakeDatasources "github.com/grafana/grafana/pkg/services/datasources/fakes"
	testdatasource "github.com/grafana/grafana/pkg/tsdb/grafana-testdata-datasource"
)

// This is a helper function to create a new datasource API server for a group
// This currently has no dependencies and only works for testdata.  In future iterations
// this will include here (or elsewhere) versions that can load config from HG api or
// the remote SQL directly
func NewStandaloneDatasource(group string) (*DataSourceAPIBuilder, error) {
	if group != "testdata.datasource.grafana.app" {
		return nil, fmt.Errorf("only testadata is currently supported")
	}

	p := plugins.JSONData{
		ID:   "grafana-testdata-datasource",
		Type: plugins.TypeDataSource,
	}
	s := testdatasource.ProvideService()
	ds := &datasources.DataSource{
		UID:     "builtin", // fake for now
		Created: time.Now(),
		Updated: time.Now(),
		Name:    "Testdata (builtin)",
	}
	dss := []*datasources.DataSource{ds}
	return NewDataSourceAPIBuilder(p, s,
		&fakeDatasources.FakeDataSourceService{DataSources: dss},
		&fakeDatasources.FakeCacheService{DataSources: dss},
		&actest.FakeAccessControl{ExpectedEvaluate: true}, // always OK
	)
}
