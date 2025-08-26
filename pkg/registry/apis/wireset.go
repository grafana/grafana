package apiregistry

import (
	"github.com/google/wire"

	dashboardinternal "github.com/grafana/grafana/pkg/registry/apis/dashboard"
	"github.com/grafana/grafana/pkg/registry/apis/dashboardsnapshot"
	"github.com/grafana/grafana/pkg/registry/apis/datasource"
	"github.com/grafana/grafana/pkg/registry/apis/featuretoggle"
	"github.com/grafana/grafana/pkg/registry/apis/folders"
	"github.com/grafana/grafana/pkg/registry/apis/iam"
	"github.com/grafana/grafana/pkg/registry/apis/iam/noopstorage"
	"github.com/grafana/grafana/pkg/registry/apis/ofrep"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning"
	"github.com/grafana/grafana/pkg/registry/apis/query"
	"github.com/grafana/grafana/pkg/registry/apis/secret"
	"github.com/grafana/grafana/pkg/registry/apis/service"
	"github.com/grafana/grafana/pkg/registry/apis/userstorage"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
)

// WireSetExts is a set of providers that can be overridden by enterprise implementations.
var WireSetExts = wire.NewSet(
	noopstorage.ProvideStorageBackend,
	wire.Bind(new(iam.CoreRoleStorageBackend), new(*noopstorage.StorageBackendImpl)),
	wire.Bind(new(iam.RoleStorageBackend), new(*noopstorage.StorageBackendImpl)),
)

var WireSet = wire.NewSet(
	ProvideRegistryServiceSink, // dummy background service that forces registration

	// read-only datasource abstractions
	plugincontext.ProvideService,
	wire.Bind(new(datasource.PluginContextWrapper), new(*plugincontext.Provider)),
	datasource.ProvideDefaultPluginConfigs,

	// Secrets
	secret.RegisterDependencies,

	// Each must be added here *and* in the ServiceSink above
	dashboardinternal.RegisterAPIService,
	dashboardsnapshot.RegisterAPIService,
	featuretoggle.RegisterAPIService,
	datasource.RegisterAPIService,
	folders.RegisterAPIService,
	iam.RegisterAPIService,
	provisioning.RegisterAPIService,
	service.RegisterAPIService,
	query.RegisterAPIService,
	userstorage.RegisterAPIService,
	ofrep.RegisterAPIService,
)
