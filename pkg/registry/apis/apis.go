package apiregistry

import (
	"context"

	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard"
	"github.com/grafana/grafana/pkg/registry/apis/dashboardsnapshot"
	"github.com/grafana/grafana/pkg/registry/apis/datasource"
	"github.com/grafana/grafana/pkg/registry/apis/example"
	"github.com/grafana/grafana/pkg/registry/apis/featuretoggle"
	"github.com/grafana/grafana/pkg/registry/apis/folders"
	"github.com/grafana/grafana/pkg/registry/apis/frontend"
	"github.com/grafana/grafana/pkg/registry/apis/peakq"
	"github.com/grafana/grafana/pkg/registry/apis/playlist"
	"github.com/grafana/grafana/pkg/registry/apis/query"
	"github.com/grafana/grafana/pkg/registry/apis/scope"
	"github.com/grafana/grafana/pkg/registry/apis/service"
)

var (
	_ registry.BackgroundService = (*Service)(nil)
)

type Service struct{}

// ProvideRegistryServiceSink is an entry point for each service that will force initialization
// and give each builder the chance to register itself with the main server
func ProvideRegistryServiceSink(
	_ *dashboard.DashboardsAPIBuilder,
	_ *playlist.PlaylistAPIBuilder,
	_ *example.TestingAPIBuilder,
	_ *dashboardsnapshot.SnapshotsAPIBuilder,
	_ *featuretoggle.FeatureFlagAPIBuilder,
	_ *datasource.DataSourceAPIBuilder,
	_ *folders.FolderAPIBuilder,
	_ *frontend.FrontendAPIBuilder,
	_ *peakq.PeakQAPIBuilder,
	_ *scope.ScopeAPIBuilder,
	_ *service.ServiceAPIBuilder,
	_ *query.QueryAPIBuilder,
) *Service {
	return &Service{}
}

func (s *Service) Run(ctx context.Context) error {
	<-ctx.Done()
	return nil
}
