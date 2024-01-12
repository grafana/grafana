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

	orgId := int64(1)
	pluginId := "grafana-testdata-datasource"
	now := time.Now()
	dss := []*datasources.DataSource{
		{
			OrgID:   orgId, // default -- used in the list command
			Type:    pluginId,
			UID:     "builtin", // fake for now
			Created: now,
			Updated: now,
			Name:    "Testdata (builtin)",
		},
		{
			OrgID:   orgId, // default -- used in the list command
			Type:    pluginId,
			UID:     "PD8C576611E62080A", // match the gdev version
			Created: now,
			Updated: now,
			Name:    "gdev-testdata",
		},
	}
	return NewDataSourceAPIBuilder(
		plugins.JSONData{ID: pluginId}, testdatasource.ProvideService(),
		&fakeDatasources.FakeDataSourceService{DataSources: dss},
		&fakeDatasources.FakeCacheService{DataSources: dss},
		// Always allow... but currently not called in standalone!
		&actest.FakeAccessControl{ExpectedEvaluate: true},
	)
}
