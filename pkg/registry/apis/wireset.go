package apiregistry

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/pkg/apiserver/auditing"
	"github.com/grafana/grafana/pkg/registry/apis/collections"
	dashboardinternal "github.com/grafana/grafana/pkg/registry/apis/dashboard"
	"github.com/grafana/grafana/pkg/registry/apis/datasource"
	"github.com/grafana/grafana/pkg/registry/apis/folders"
	"github.com/grafana/grafana/pkg/registry/apis/iam"
	"github.com/grafana/grafana/pkg/registry/apis/iam/externalgroupmapping"
	"github.com/grafana/grafana/pkg/registry/apis/iam/noopstorage"
	"github.com/grafana/grafana/pkg/registry/apis/ofrep"
	"github.com/grafana/grafana/pkg/registry/apis/preferences"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/extras"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/webhooks"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/webhooks/pullrequest"
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
	wire.Bind(new(iam.RoleBindingStorageBackend), new(*noopstorage.StorageBackendImpl)),
	wire.Bind(new(iam.ExternalGroupMappingStorageBackend), new(*noopstorage.StorageBackendImpl)),

	externalgroupmapping.ProvideNoopTeamGroupsREST,
	wire.Bind(new(externalgroupmapping.TeamGroupsHandler), new(*externalgroupmapping.NoopTeamGroupsREST)),

	// Auditing Options
	auditing.ProvideNoopBackend,
	auditing.ProvideNoopPolicyRuleEvaluator,
)

var provisioningExtras = wire.NewSet(
	pullrequest.ProvidePullRequestWorker,
	webhooks.ProvideWebhooksWithImages,
	extras.ProvideFactoryFromConfig,
	extras.ProvideProvisioningExtraAPIs,
	extras.ProvideExtraWorkers,
)

var WireSet = wire.NewSet(
	ProvideRegistryServiceSink, // dummy background service that forces registration

	// read-only datasource abstractions
	plugincontext.ProvideService,
	wire.Bind(new(datasource.PluginContextWrapper), new(*plugincontext.Provider)),
	datasource.ProvideDefaultPluginConfigs,

	// Secrets
	secret.RegisterDependencies,
	// Provisioning
	provisioning.RegisterDependencies,
	provisioningExtras,

	// Each must be added here *and* in the ServiceSink above
	dashboardinternal.RegisterAPIService,
	datasource.RegisterAPIService,
	folders.RegisterAPIService,
	iam.RegisterAPIService,
	provisioning.RegisterAPIService,
	service.RegisterAPIService,
	query.RegisterAPIService,
	preferences.RegisterAPIService,
	collections.RegisterAPIService,
	userstorage.RegisterAPIService,
	ofrep.RegisterAPIService,
)
