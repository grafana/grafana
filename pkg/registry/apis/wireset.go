package apiregistry

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/pkg/apiserver/auditing"
	"github.com/grafana/grafana/pkg/registry/apis/appplugin"
	"github.com/grafana/grafana/pkg/registry/apis/collections"
	dashboardinternal "github.com/grafana/grafana/pkg/registry/apis/dashboard"
	"github.com/grafana/grafana/pkg/registry/apis/datasource"
	"github.com/grafana/grafana/pkg/registry/apis/folders"
	"github.com/grafana/grafana/pkg/registry/apis/iam"
	"github.com/grafana/grafana/pkg/registry/apis/iam/externalgroupmapping"
	inmemory "github.com/grafana/grafana/pkg/registry/apis/iam/globalrole/inmemory"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/iam/noopstorage"
	"github.com/grafana/grafana/pkg/registry/apis/iam/resourcepermission"
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
	iam.ProvideNoopRoleApiInstaller,
	inmemory.ProvideInMemoryGlobalRoleApiInstaller,
	iam.ProvideNoopTeamLBACApiInstaller,
	iam.ProvideNoopExternalGroupMappingApiInstaller,
	iam.ProvideNoopRoleBindingApiInstaller,

	externalgroupmapping.ProvideNoopTeamGroupsREST,
	wire.Bind(new(externalgroupmapping.TeamGroupsHandler), new(*externalgroupmapping.NoopTeamGroupsREST)),

	externalgroupmapping.ProvideNoopSearchREST,
	wire.Bind(new(externalgroupmapping.SearchHandler), new(*externalgroupmapping.NoopSearchREST)),

	wire.InterfaceValue(new(legacy.ExternalGroupReconciler), legacy.NoopExternalGroupReconciler{}),

	// Auditing Options
	auditing.ProvideNoopBackend,
	auditing.ProvideNoopPolicyRuleProvider,
)

var provisioningExtras = wire.NewSet(
	pullrequest.ProvidePullRequestWorker,
	webhooks.ProvideWebhooksWithImages,
	extras.ProvideConnectionFactoryFromConfig,
	extras.ProvideProvisioningExtraAPIs,
	extras.ProvideExtraWorkers,
	extras.ProvideQuotaGetter,
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

	// Resource Permission
	resourcepermission.ProvideMappersRegistry,

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
	appplugin.RegisterAPIService,
)
