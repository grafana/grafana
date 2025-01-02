package apiregistry

import (
	"github.com/grafana/grafana/pkg/registry/apis/alerting/notifications"
	dashboardinternal "github.com/grafana/grafana/pkg/registry/apis/dashboard"
	dashboardv0alpha1 "github.com/grafana/grafana/pkg/registry/apis/dashboard/v0alpha1"
	dashboardv1alpha1 "github.com/grafana/grafana/pkg/registry/apis/dashboard/v1alpha1"
	dashboardv2alpha1 "github.com/grafana/grafana/pkg/registry/apis/dashboard/v2alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/dashboardsnapshot"
	"github.com/grafana/grafana/pkg/registry/apis/datasource"
	"github.com/grafana/grafana/pkg/registry/apis/featuretoggle"
	"github.com/grafana/grafana/pkg/registry/apis/folders"
	"github.com/grafana/grafana/pkg/registry/apis/iam"
	"github.com/grafana/grafana/pkg/registry/apis/peakq"
	"github.com/grafana/grafana/pkg/registry/apis/query"
	"github.com/grafana/grafana/pkg/registry/apis/scope"
	"github.com/grafana/grafana/pkg/registry/apis/userstorage"
)

type Service struct{}

// ProvideRegistryServiceSink is an entry point for each service that will force initialization
// and give each builder the chance to register itself with the main server
func ProvideRegistryServiceSink(
	_ *dashboardinternal.DashboardsAPIBuilder,
	_ *dashboardv0alpha1.DashboardsAPIBuilder,
	_ *dashboardv1alpha1.DashboardsAPIBuilder,
	_ *dashboardv2alpha1.DashboardsAPIBuilder,
	_ *dashboardsnapshot.SnapshotsAPIBuilder,
	_ *featuretoggle.FeatureFlagAPIBuilder,
	_ *datasource.DataSourceAPIBuilder,
	_ *folders.FolderAPIBuilder,
	_ *peakq.PeakQAPIBuilder,
	_ *iam.IdentityAccessManagementAPIBuilder,
	_ *scope.ScopeAPIBuilder,
	_ *query.QueryAPIBuilder,
	_ *notifications.NotificationsAPIBuilder,
	_ *userstorage.UserStorageAPIBuilder,
) *Service {
	return &Service{}
}
