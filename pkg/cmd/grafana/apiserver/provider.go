package apiserver

import (
	"fmt"

	"github.com/grafana/grafana/pkg/registry/apis/example"
	"github.com/grafana/grafana/pkg/registry/apis/featuretoggle"
	"github.com/grafana/grafana/pkg/registry/apis/query"
	"github.com/grafana/grafana/pkg/registry/apis/query/runner"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// StandaloneAPIProvider used by standalone command
type StandaloneAPIProvider interface {
	GetAPIGroupBuilder(group string, version string) (builder.APIGroupBuilder, error)
}

var _ StandaloneAPIProvider = (*DummyAPIProvider)(nil)

type DummyAPIProvider struct{}

// GetAPIGroupBuilder implements builder.StandaloneAPIProvider.
func (*DummyAPIProvider) GetAPIGroupBuilder(group string, version string) (builder.APIGroupBuilder, error) {
	if version != "v0alpha1" {
		return nil, fmt.Errorf("only alpha supported now!")
	}

	switch group {
	case "example.grafana.app":
		return example.NewTestingAPIBuilder(), nil

	// Only works with testdata
	case "query.grafana.app":
		return query.NewQueryAPIBuilder(
			featuremgmt.WithFeatures(),
			runner.NewDummyTestRunner(),
			runner.NewDummyRegistry(),
		), nil

	case "featuretoggle.grafana.app":
		return featuretoggle.NewFeatureFlagAPIBuilder(
			featuremgmt.WithFeatureManager(setting.FeatureMgmtSettings{}, nil), // none... for now
			&actest.FakeAccessControl{ExpectedEvaluate: false},
		), nil

	case "testdata.datasource.grafana.app":
		return server.InitializeDataSourceAPIServer(group)
	}

	return nil, fmt.Errorf("unsupported group")
}
