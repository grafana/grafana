package apiregistry

import (
	"github.com/google/wire"

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
	"github.com/grafana/grafana/pkg/registry/apis/service"
	"github.com/grafana/grafana/pkg/registry/apis/userstorage"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
)

var WireSet = wire.NewSet(
	ProvideRegistryServiceSink, // dummy background service that forces registration

	// read-only datasource abstractions
	plugincontext.ProvideService,
	wire.Bind(new(datasource.PluginContextWrapper), new(*plugincontext.Provider)),
	datasource.ProvideDefaultPluginConfigs,

	// Each must be added here *and* in the ServiceSink above
	dashboardinternal.RegisterAPIService,
	dashboardv0alpha1.RegisterAPIService,
	dashboardv1alpha1.RegisterAPIService,
	dashboardv2alpha1.RegisterAPIService,
	dashboardsnapshot.RegisterAPIService,
	featuretoggle.RegisterAPIService,
	datasource.RegisterAPIService,
	folders.RegisterAPIService,
	iam.RegisterAPIService,
	peakq.RegisterAPIService,
	service.RegisterAPIService,
	query.RegisterAPIService,
	scope.RegisterAPIService,
	notifications.RegisterAPIService,
	userstorage.RegisterAPIService,
)
