// NOTE: This file was auto generated.  DO NOT EDIT DIRECTLY!
// To change feature flags, edit:
//  pkg/services/featuremgmt/registry.go
// Then run tests in:
//  pkg/services/featuremgmt/toggles_gen_test.go

package featuremgmt

const (
	// FlagPanelTitleSearch
	// Search for dashboards using panel title
	FlagPanelTitleSearch = "panelTitleSearch"

	// FlagPublicDashboardsEmailSharing
	// Enables public dashboard sharing to be restricted to only allowed emails
	FlagPublicDashboardsEmailSharing = "publicDashboardsEmailSharing"

	// FlagLokiExperimentalStreaming
	// Support new streaming approach for loki (prototype, needs special loki build)
	FlagLokiExperimentalStreaming = "lokiExperimentalStreaming"

	// FlagFeatureHighlights
	// Highlight Grafana Enterprise features
	FlagFeatureHighlights = "featureHighlights"

	// FlagStorage
	// Configurable storage for dashboards, datasources, and resources
	FlagStorage = "storage"

	// FlagGrpcServer
	// Run the GRPC server
	FlagGrpcServer = "grpcServer"

	// FlagCloudWatchCrossAccountQuerying
	// Enables cross-account querying in CloudWatch datasources
	FlagCloudWatchCrossAccountQuerying = "cloudWatchCrossAccountQuerying"

	// FlagAlertingBacktesting
	// Rule backtesting API for alerting
	FlagAlertingBacktesting = "alertingBacktesting"

	// FlagLiveAPIServer
	// Registers a live apiserver
	FlagLiveAPIServer = "liveAPIServer"

	// FlagKubernetesStars
	// Routes stars requests from /api to the /apis endpoint
	FlagKubernetesStars = "kubernetesStars"

	// FlagInfluxqlStreamingParser
	// Enable streaming JSON parser for InfluxDB datasource InfluxQL query language
	FlagInfluxqlStreamingParser = "influxqlStreamingParser"

	// FlagInfluxdbRunQueriesInParallel
	// Enables running InfluxDB Influxql queries in parallel
	FlagInfluxdbRunQueriesInParallel = "influxdbRunQueriesInParallel"

	// FlagLokiLogsDataplane
	// Changes logs responses from Loki to be compliant with the dataplane specification.
	FlagLokiLogsDataplane = "lokiLogsDataplane"

	// FlagDisableSSEDataplane
	// Disables dataplane specific processing in server side expressions.
	FlagDisableSSEDataplane = "disableSSEDataplane"

	// FlagRenderAuthJWT
	// Uses JWT-based auth for rendering instead of relying on remote cache
	FlagRenderAuthJWT = "renderAuthJWT"

	// FlagRefactorVariablesTimeRange
	// Refactor time range variables flow to reduce number of API calls made when query variables are chained
	FlagRefactorVariablesTimeRange = "refactorVariablesTimeRange"

	// FlagEnableDatagridEditing
	// Enables the edit functionality in the datagrid panel
	FlagEnableDatagridEditing = "enableDatagridEditing"

	// FlagAwsDatasourcesTempCredentials
	// Support temporary security credentials in AWS plugins for Grafana Cloud customers
	FlagAwsDatasourcesTempCredentials = "awsDatasourcesTempCredentials"

	// FlagMlExpressions
	// Enable support for Machine Learning in server-side expressions
	FlagMlExpressions = "mlExpressions"

	// FlagDatasourceAPIServers
	// Expose some datasources as apiservers.
	FlagDatasourceAPIServers = "datasourceAPIServers"

	// FlagGrafanaAPIServerWithExperimentalAPIs
	// Register experimental APIs with the k8s API server, including all datasources
	FlagGrafanaAPIServerWithExperimentalAPIs = "grafanaAPIServerWithExperimentalAPIs"

	// FlagProvisioning
	// Next generation provisioning... and git
	FlagProvisioning = "provisioning"

	// FlagGrafanaAPIServerEnsureKubectlAccess
	// Start an additional https handler and write kubectl options
	FlagGrafanaAPIServerEnsureKubectlAccess = "grafanaAPIServerEnsureKubectlAccess"

	// FlagAwsAsyncQueryCaching
	// Enable caching for async queries for Redshift and Athena. Requires that the datasource has caching and async query support enabled
	FlagAwsAsyncQueryCaching = "awsAsyncQueryCaching"

	// FlagQueryCacheRequestDeduplication
	// Enable request deduplication when query caching is enabled. Requests issuing the same query will be deduplicated, only the first request to arrive will be executed and the response will be shared with requests arriving while there is a request in-flight
	FlagQueryCacheRequestDeduplication = "queryCacheRequestDeduplication"

	// FlagConfigurableSchedulerTick
	// Enable changing the scheduler base interval via configuration option unified_alerting.scheduler_tick_interval
	FlagConfigurableSchedulerTick = "configurableSchedulerTick"

	// FlagReportingCsvEncodingOptions
	// Enables CSV encoding options in the reporting feature
	FlagReportingCsvEncodingOptions = "reportingCsvEncodingOptions"

	// FlagSseGroupByDatasource
	// Send query to the same datasource in a single request when using server side expressions. The `cloudWatchBatchQueries` feature toggle should be enabled if this used with CloudWatch.
	FlagSseGroupByDatasource = "sseGroupByDatasource"

	// FlagLokiRunQueriesInParallel
	// Enables running Loki queries in parallel
	FlagLokiRunQueriesInParallel = "lokiRunQueriesInParallel"

	// FlagExternalServiceAccounts
	// Automatic service account and token setup for plugins
	FlagExternalServiceAccounts = "externalServiceAccounts"

	// FlagKubernetesSnapshots
	// Routes snapshot requests from /api to the /apis endpoint
	FlagKubernetesSnapshots = "kubernetesSnapshots"

	// FlagKubernetesLibraryPanels
	// Routes library panel requests from /api to the /apis endpoint
	FlagKubernetesLibraryPanels = "kubernetesLibraryPanels"

	// FlagKubernetesDashboards
	// Use the kubernetes API in the frontend for dashboards
	FlagKubernetesDashboards = "kubernetesDashboards"

	// FlagKubernetesShortURLs
	// Enables k8s short url api and uses it under the hood when handling legacy /api
	FlagKubernetesShortURLs = "kubernetesShortURLs"

	// FlagKubernetesAlertingRules
	// Adds support for Kubernetes alerting and recording rules
	FlagKubernetesAlertingRules = "kubernetesAlertingRules"

	// FlagKubernetesCorrelations
	// Adds support for Kubernetes correlations
	FlagKubernetesCorrelations = "kubernetesCorrelations"

	// FlagKubernetesUnifiedStorageQuotas
	// Adds support for Kubernetes unified storage quotas
	FlagKubernetesUnifiedStorageQuotas = "kubernetesUnifiedStorageQuotas"

	// FlagKubernetesLogsDrilldown
	// Adds support for Kubernetes logs drilldown
	FlagKubernetesLogsDrilldown = "kubernetesLogsDrilldown"

	// FlagKubernetesQueryCaching
	// Adds support for Kubernetes querycaching
	FlagKubernetesQueryCaching = "kubernetesQueryCaching"

	// FlagDashboardDisableSchemaValidationV1
	// Disable schema validation for dashboards/v1
	FlagDashboardDisableSchemaValidationV1 = "dashboardDisableSchemaValidationV1"

	// FlagDashboardDisableSchemaValidationV2
	// Disable schema validation for dashboards/v2
	FlagDashboardDisableSchemaValidationV2 = "dashboardDisableSchemaValidationV2"

	// FlagDashboardSchemaValidationLogging
	// Log schema validation errors so they can be analyzed later
	FlagDashboardSchemaValidationLogging = "dashboardSchemaValidationLogging"

	// FlagScanRowInvalidDashboardParseFallbackEnabled
	// Enable fallback parsing behavior when scan row encounters invalid dashboard JSON
	FlagScanRowInvalidDashboardParseFallbackEnabled = "scanRowInvalidDashboardParseFallbackEnabled"

	// FlagDatasourceQueryTypes
	// Show query type endpoints in datasource API servers (currently hardcoded for testdata, expressions, and prometheus)
	FlagDatasourceQueryTypes = "datasourceQueryTypes"

	// FlagDatasourceDisableIdApi
	// Does not register datasource apis that use the numeric id
	FlagDatasourceDisableIdApi = "datasourceDisableIdApi"

	// FlagQueryService
	// Register /apis/query.grafana.app/ -- will eventually replace /api/ds/query
	FlagQueryService = "queryService"

	// FlagQueryServiceWithConnections
	// Adds datasource connections to the query service
	FlagQueryServiceWithConnections = "queryServiceWithConnections"

	// FlagQueryServiceRewrite
	// Rewrite requests targeting /ds/query to the query service
	FlagQueryServiceRewrite = "queryServiceRewrite"

	// FlagDatasourcesRerouteLegacyCRUDAPIs
	// Handle datasource CRUD requests to the legacy API routes by querying the new datasource api group endpoints behind the scenes.
	FlagDatasourcesRerouteLegacyCRUDAPIs = "datasourcesRerouteLegacyCRUDAPIs"

	// FlagDatasourcesApiServerEnableResourceEndpoint
	// Handle datasource resource requests to the legacy API routes by querying the new datasource api group endpoints behind the scenes.
	FlagDatasourcesApiServerEnableResourceEndpoint = "datasourcesApiServerEnableResourceEndpoint"

	// FlagDatasourcesApiServerEnableResourceEndpointFrontend
	// Send Datsource resource requests to K8s /apis/ API routes instead of the legacy /api/datasources/uid/{uid}/resources/{path} routes.
	FlagDatasourcesApiServerEnableResourceEndpointFrontend = "datasourcesApiServerEnableResourceEndpointFrontend"

	// FlagCloudWatchBatchQueries
	// Runs CloudWatch metrics queries as separate batches
	FlagCloudWatchBatchQueries = "cloudWatchBatchQueries"

	// FlagCachingOptimizeSerializationMemoryUsage
	// If enabled, the caching backend gradually serializes query responses for the cache, comparing against the configured `[caching]max_value_mb` value as it goes. This can can help prevent Grafana from running out of memory while attempting to cache very large query responses.
	FlagCachingOptimizeSerializationMemoryUsage = "cachingOptimizeSerializationMemoryUsage"

	// FlagAlertmanagerRemoteSecondary
	// Enable Grafana to sync configuration and state with a remote Alertmanager.
	FlagAlertmanagerRemoteSecondary = "alertmanagerRemoteSecondary"

	// FlagAlertingProvenanceLockWrites
	// Enables a feature to avoid issues with concurrent writes to the alerting provenance table in MySQL
	FlagAlertingProvenanceLockWrites = "alertingProvenanceLockWrites"

	// FlagAlertingUIUseBackendFilters
	// Enables the UI to use certain backend-side filters
	FlagAlertingUIUseBackendFilters = "alertingUIUseBackendFilters"

	// FlagAlertingUIUseFullyCompatBackendFilters
	// Enables the UI to use rules backend-side filters 100% compatible with the frontend filters
	FlagAlertingUIUseFullyCompatBackendFilters = "alertingUIUseFullyCompatBackendFilters"

	// FlagAlertmanagerRemotePrimary
	// Enable Grafana to have a remote Alertmanager instance as the primary Alertmanager.
	FlagAlertmanagerRemotePrimary = "alertmanagerRemotePrimary"

	// FlagAnnotationPermissionUpdate
	// Change the way annotation permissions work by scoping them to folders and dashboards.
	FlagAnnotationPermissionUpdate = "annotationPermissionUpdate"

	// FlagDashboardNewLayouts
	// Enables new dashboard layouts
	FlagDashboardNewLayouts = "dashboardNewLayouts"

	// FlagPdfTables
	// Enables generating table data as PDF in reporting
	FlagPdfTables = "pdfTables"

	// FlagCloudRBACRoles
	// Enabled grafana cloud specific RBAC roles
	FlagCloudRBACRoles = "cloudRBACRoles"

	// FlagAlertingQueryOptimization
	// Optimizes eligible queries in order to reduce load on datasources
	FlagAlertingQueryOptimization = "alertingQueryOptimization"

	// FlagJitterAlertRulesWithinGroups
	// Distributes alert rule evaluations more evenly over time, including spreading out rules within the same group. Disables sequential evaluation if enabled.
	FlagJitterAlertRulesWithinGroups = "jitterAlertRulesWithinGroups"

	// FlagAuditLoggingAppPlatform
	// Enable audit logging with Kubernetes under app platform
	FlagAuditLoggingAppPlatform = "auditLoggingAppPlatform"

	// FlagSecretsManagementAppPlatformUI
	// Enable the secrets management app platform UI
	FlagSecretsManagementAppPlatformUI = "secretsManagementAppPlatformUI"

	// FlagAlertingSaveStatePeriodic
	// Writes the state periodically to the database, asynchronous to rule evaluation
	FlagAlertingSaveStatePeriodic = "alertingSaveStatePeriodic"

	// FlagAlertingSaveStateCompressed
	// Enables the compressed protobuf-based alert state storage. Default is enabled.
	FlagAlertingSaveStateCompressed = "alertingSaveStateCompressed"

	// FlagScopeApi
	// In-development feature flag for the scope api using the app platform.
	FlagScopeApi = "scopeApi"

	// FlagLogQLScope
	// In-development feature that will allow injection of labels into loki queries.
	FlagLogQLScope = "logQLScope"

	// FlagSqlExpressions
	// Enables SQL Expressions, which can execute SQL queries against data source results.
	FlagSqlExpressions = "sqlExpressions"

	// FlagKubernetesAggregator
	// Enable grafana&#39;s embedded kube-aggregator
	FlagKubernetesAggregator = "kubernetesAggregator"

	// FlagKubernetesAggregatorCapTokenAuth
	// Enable CAP token based authentication in grafana&#39;s embedded kube-aggregator
	FlagKubernetesAggregatorCapTokenAuth = "kubernetesAggregatorCapTokenAuth"

	// FlagGroupByVariable
	// Enable groupBy variable support in scenes dashboards
	FlagGroupByVariable = "groupByVariable"

	// FlagScopeFilters
	// Enables the use of scope filters in Grafana
	FlagScopeFilters = "scopeFilters"

	// FlagOauthRequireSubClaim
	// Require that sub claims is present in oauth tokens.
	FlagOauthRequireSubClaim = "oauthRequireSubClaim"

	// FlagRefreshTokenRequired
	// Require that refresh tokens are present in oauth tokens.
	FlagRefreshTokenRequired = "refreshTokenRequired"

	// FlagNewDashboardWithFiltersAndGroupBy
	// Enables filters and group by variables on all new dashboards. Variables are added only if default data source supports filtering.
	FlagNewDashboardWithFiltersAndGroupBy = "newDashboardWithFiltersAndGroupBy"

	// FlagDashboardAdHocAndGroupByWrapper
	// Wraps the ad hoc and group by variables in a single wrapper, with all other variables below it
	FlagDashboardAdHocAndGroupByWrapper = "dashboardAdHocAndGroupByWrapper"

	// FlagCloudWatchNewLabelParsing
	// Updates CloudWatch label parsing to be more accurate
	FlagCloudWatchNewLabelParsing = "cloudWatchNewLabelParsing"

	// FlagDisableNumericMetricsSortingInExpressions
	// In server-side expressions, disable the sorting of numeric-kind metrics by their metric name or labels.
	FlagDisableNumericMetricsSortingInExpressions = "disableNumericMetricsSortingInExpressions"

	// FlagGrafanaManagedRecordingRules
	// Enables Grafana-managed recording rules.
	FlagGrafanaManagedRecordingRules = "grafanaManagedRecordingRules"

	// FlagQueryLibrary
	// Enables Saved queries (query library) feature
	FlagQueryLibrary = "queryLibrary"

	// FlagSavedQueriesRBAC
	// Enables Saved queries (query library) RBAC permissions
	FlagSavedQueriesRBAC = "savedQueriesRBAC"

	// FlagDashboardLibrary
	// Displays datasource provisioned dashboards in dashboard empty page, only when coming from datasource configuration page
	FlagDashboardLibrary = "dashboardLibrary"

	// FlagSuggestedDashboards
	// Displays datasource provisioned and community dashboards in dashboard empty page, only when coming from datasource configuration page
	FlagSuggestedDashboards = "suggestedDashboards"

	// FlagDashboardValidatorApp
	// Enables dashboard validator app to run compatibility checks between a dashboard and data source
	FlagDashboardValidatorApp = "dashboardValidatorApp"

	// FlagDashboardTemplates
	// Enables a flow to get started with a new dashboard from a template
	FlagDashboardTemplates = "dashboardTemplates"

	// FlagAlertingNavigationV2
	// Enables the new Alerting navigation structure with improved menu grouping
	FlagAlertingNavigationV2 = "alertingNavigationV2"

	// FlagAlertingDisableSendAlertsExternal
	// Disables the ability to send alerts to an external Alertmanager datasource.
	FlagAlertingDisableSendAlertsExternal = "alertingDisableSendAlertsExternal"

	// FlagPreserveDashboardStateWhenNavigating
	// Enables possibility to preserve dashboard variables and time range when navigating between dashboards
	FlagPreserveDashboardStateWhenNavigating = "preserveDashboardStateWhenNavigating"

	// FlagAlertingCentralAlertHistory
	// Enables the new central alert history.
	FlagAlertingCentralAlertHistory = "alertingCentralAlertHistory"

	// FlagPluginProxyPreserveTrailingSlash
	// Preserve plugin proxy trailing slash.
	FlagPluginProxyPreserveTrailingSlash = "pluginProxyPreserveTrailingSlash"

	// FlagAzureMonitorPrometheusExemplars
	// Allows configuration of Azure Monitor as a data source that can provide Prometheus exemplars
	FlagAzureMonitorPrometheusExemplars = "azureMonitorPrometheusExemplars"

	// FlagAuthZGRPCServer
	// Enables the gRPC server for authorization
	FlagAuthZGRPCServer = "authZGRPCServer"

	// FlagZanzana
	// Use openFGA as authorization engine.
	FlagZanzana = "zanzana"

	// FlagZanzanaNoLegacyClient
	// Use openFGA as main authorization engine and disable legacy RBAC clietn.
	FlagZanzanaNoLegacyClient = "zanzanaNoLegacyClient"

	// FlagReloadDashboardsOnParamsChange
	// Enables reload of dashboards on scopes, time range and variables changes
	FlagReloadDashboardsOnParamsChange = "reloadDashboardsOnParamsChange"

	// FlagEnableScopesInMetricsExplore
	// Enables the scopes usage in Metrics Explore
	FlagEnableScopesInMetricsExplore = "enableScopesInMetricsExplore"

	// FlagCloudWatchRoundUpEndTime
	// Round up end time for metric queries to the next minute to avoid missing data
	FlagCloudWatchRoundUpEndTime = "cloudWatchRoundUpEndTime"

	// FlagPrometheusAzureOverrideAudience
	// Deprecated. Allow override default AAD audience for Azure Prometheus endpoint. Enabled by default. This feature should no longer be used and will be removed in the future.
	FlagPrometheusAzureOverrideAudience = "prometheusAzureOverrideAudience"

	// FlagAlertingFilterV2
	// Enable the new alerting search experience
	FlagAlertingFilterV2 = "alertingFilterV2"

	// FlagDataplaneAggregator
	// Enable grafana dataplane aggregator
	FlagDataplaneAggregator = "dataplaneAggregator"

	// FlagNewFiltersUI
	// Enables new combobox style UI for the Ad hoc filters variable in scenes architecture
	FlagNewFiltersUI = "newFiltersUI"

	// FlagAppPlatformGrpcClientAuth
	// Enables the gRPC client to authenticate with the App Platform by using ID &amp; access tokens
	FlagAppPlatformGrpcClientAuth = "appPlatformGrpcClientAuth"

	// FlagGroupAttributeSync
	// Enable the groupsync extension for managing Group Attribute Sync feature
	FlagGroupAttributeSync = "groupAttributeSync"

	// FlagImprovedExternalSessionHandling
	// Enables improved support for OAuth external sessions. After enabling this feature, users might need to re-authenticate themselves.
	FlagImprovedExternalSessionHandling = "improvedExternalSessionHandling"

	// FlagUseSessionStorageForRedirection
	// Use session storage for handling the redirection after login
	FlagUseSessionStorageForRedirection = "useSessionStorageForRedirection"

	// FlagRolePickerDrawer
	// Enables the new role picker drawer design
	FlagRolePickerDrawer = "rolePickerDrawer"

	// FlagManagedDualWriter
	// Pick the dual write mode from database configs
	FlagManagedDualWriter = "managedDualWriter"

	// FlagPluginsSriChecks
	// Enables SRI checks for plugin assets
	FlagPluginsSriChecks = "pluginsSriChecks"

	// FlagUnifiedStorageBigObjectsSupport
	// Enables to save big objects in blob storage
	FlagUnifiedStorageBigObjectsSupport = "unifiedStorageBigObjectsSupport"

	// FlagTimeRangeProvider
	// Enables time pickers sync
	FlagTimeRangeProvider = "timeRangeProvider"

	// FlagAzureMonitorDisableLogLimit
	// Disables the log limit restriction for Azure Monitor when true. The limit is enabled by default.
	FlagAzureMonitorDisableLogLimit = "azureMonitorDisableLogLimit"

	// FlagPlaylistsReconciler
	// Enables experimental reconciler for playlists
	FlagPlaylistsReconciler = "playlistsReconciler"

	// FlagPasswordlessMagicLinkAuthentication
	// Enable passwordless login via magic link authentication
	FlagPasswordlessMagicLinkAuthentication = "passwordlessMagicLinkAuthentication"

	// FlagEnableExtensionsAdminPage
	// Enables the extension admin page regardless of development mode
	FlagEnableExtensionsAdminPage = "enableExtensionsAdminPage"

	// FlagEnableSCIM
	// Enables SCIM support for user and group management
	FlagEnableSCIM = "enableSCIM"

	// FlagAzureMonitorEnableUserAuth
	// Enables user auth for Azure Monitor datasource only
	FlagAzureMonitorEnableUserAuth = "azureMonitorEnableUserAuth"

	// FlagAlertingAIGenAlertRules
	// Enable AI-generated alert rules.
	FlagAlertingAIGenAlertRules = "alertingAIGenAlertRules"

	// FlagAlertingAIFeedback
	// Enable AI-generated feedback from the Grafana UI.
	FlagAlertingAIFeedback = "alertingAIFeedback"

	// FlagAlertingAIImproveAlertRules
	// Enable AI-improve alert rules labels and annotations.
	FlagAlertingAIImproveAlertRules = "alertingAIImproveAlertRules"

	// FlagAlertingAIGenTemplates
	// Enable AI-generated alerting templates.
	FlagAlertingAIGenTemplates = "alertingAIGenTemplates"

	// FlagAlertingEnrichmentPerRule
	// Enable enrichment per rule in the alerting UI.
	FlagAlertingEnrichmentPerRule = "alertingEnrichmentPerRule"

	// FlagAlertingEnrichmentAssistantInvestigations
	// Enable Assistant Investigations enrichment type.
	FlagAlertingEnrichmentAssistantInvestigations = "alertingEnrichmentAssistantInvestigations"

	// FlagAlertingAIAnalyzeCentralStateHistory
	// Enable AI-analyze central state history.
	FlagAlertingAIAnalyzeCentralStateHistory = "alertingAIAnalyzeCentralStateHistory"

	// FlagUnifiedStorageSearchUI
	// Enable unified storage search UI
	FlagUnifiedStorageSearchUI = "unifiedStorageSearchUI"

	// FlagElasticsearchCrossClusterSearch
	// Enables cross cluster search in the Elasticsearch data source
	FlagElasticsearchCrossClusterSearch = "elasticsearchCrossClusterSearch"

	// FlagLokiLabelNamesQueryApi
	// Defaults to using the Loki `/labels` API instead of `/series`
	FlagLokiLabelNamesQueryApi = "lokiLabelNamesQueryApi"

	// FlagK8SFolderCounts
	// Enable folder&#39;s api server counts
	FlagK8SFolderCounts = "k8SFolderCounts"

	// FlagImprovedExternalSessionHandlingSAML
	// Enables improved support for SAML external sessions. Ensure the NameID format is correctly configured in Grafana for SAML Single Logout to function properly.
	FlagImprovedExternalSessionHandlingSAML = "improvedExternalSessionHandlingSAML"

	// FlagTeamHttpHeadersTempo
	// Enables LBAC for datasources for Tempo to apply LBAC filtering of traces to the client requests for users in teams
	FlagTeamHttpHeadersTempo = "teamHttpHeadersTempo"

	// FlagTeamHttpHeadersFromAppPlatform
	// Use the Kubernetes TeamLBACRule API for team HTTP headers on datasource query requests
	FlagTeamHttpHeadersFromAppPlatform = "teamHttpHeadersFromAppPlatform"

	// FlagGrafanaAdvisor
	// Enables Advisor app
	FlagGrafanaAdvisor = "grafanaAdvisor"

	// FlagElasticsearchImprovedParsing
	// Enables less memory intensive Elasticsearch result parsing
	FlagElasticsearchImprovedParsing = "elasticsearchImprovedParsing"

	// FlagFetchRulesUsingPost
	// Use a POST request to list rules by passing down the namespaces user has access to
	FlagFetchRulesUsingPost = "fetchRulesUsingPost"

	// FlagFetchRulesInCompactMode
	// Add compact=true when fetching rules
	FlagFetchRulesInCompactMode = "fetchRulesInCompactMode"

	// FlagGrafanaconThemes
	// Enables the temporary themes for GrafanaCon
	FlagGrafanaconThemes = "grafanaconThemes"

	// FlagAlertingUseNewSimplifiedRoutingHashAlgorithm
	FlagAlertingUseNewSimplifiedRoutingHashAlgorithm = "alertingUseNewSimplifiedRoutingHashAlgorithm"

	// FlagScopeSearchAllLevels
	// Enable scope search to include all levels of the scope node tree
	FlagScopeSearchAllLevels = "scopeSearchAllLevels"

	// FlagNewShareReportDrawer
	// Enables the report creation drawer in a dashboard
	FlagNewShareReportDrawer = "newShareReportDrawer"

	// FlagAlertRuleRestore
	// Enables the alert rule restore feature
	FlagAlertRuleRestore = "alertRuleRestore"

	// FlagInfinityRunQueriesInParallel
	// Enables running Infinity queries in parallel
	FlagInfinityRunQueriesInParallel = "infinityRunQueriesInParallel"

	// FlagAzureMonitorLogsBuilderEditor
	// Enables the logs builder mode for the Azure Monitor data source
	FlagAzureMonitorLogsBuilderEditor = "azureMonitorLogsBuilderEditor"

	// FlagLocaleFormatPreference
	// Specifies the locale so the correct format for numbers and dates can be shown
	FlagLocaleFormatPreference = "localeFormatPreference"

	// FlagUnifiedStorageGrpcConnectionPool
	// Enables the unified storage grpc connection pool
	FlagUnifiedStorageGrpcConnectionPool = "unifiedStorageGrpcConnectionPool"

	// FlagAlertingRuleRecoverDeleted
	// Enables the UI functionality to recover and view deleted alert rules
	FlagAlertingRuleRecoverDeleted = "alertingRuleRecoverDeleted"

	// FlagMultiTenantTempCredentials
	// use multi-tenant path for awsTempCredentials
	FlagMultiTenantTempCredentials = "multiTenantTempCredentials"

	// FlagTempoAlerting
	// Enables creating alerts from Tempo data source
	FlagTempoAlerting = "tempoAlerting"

	// FlagPluginsAutoUpdate
	// Enables auto-updating of users installed plugins
	FlagPluginsAutoUpdate = "pluginsAutoUpdate"

	// FlagAlertRuleUseFiredAtForStartsAt
	// Use FiredAt for StartsAt when sending alerts to Alertmaanger
	FlagAlertRuleUseFiredAtForStartsAt = "alertRuleUseFiredAtForStartsAt"

	// FlagKubernetesAuthzApis
	// Deprecated: Use kubernetesAuthzCoreRolesApi, kubernetesAuthzRolesApi, and kubernetesAuthzRoleBindingsApi instead
	FlagKubernetesAuthzApis = "kubernetesAuthzApis"

	// FlagKubernetesAuthZHandlerRedirect
	// Deprecated: Use kubernetesAuthZResourcePermissionsRedirect and kubernetesAuthZRolesRedirect instead
	FlagKubernetesAuthZHandlerRedirect = "kubernetesAuthZHandlerRedirect"

	// FlagKubernetesAuthZResourcePermissionsRedirect
	// Redirects the traffic from the legacy resource permissions endpoints to the new K8s AuthZ endpoints
	FlagKubernetesAuthZResourcePermissionsRedirect = "kubernetesAuthZResourcePermissionsRedirect"

	// FlagKubernetesAuthZRolesRedirect
	// Redirects the traffic from the legacy roles endpoints to the new K8s AuthZ endpoints
	FlagKubernetesAuthZRolesRedirect = "kubernetesAuthZRolesRedirect"

	// FlagKubernetesAuthzResourcePermissionApis
	// Registers AuthZ resource permission /apis endpoints
	FlagKubernetesAuthzResourcePermissionApis = "kubernetesAuthzResourcePermissionApis"

	// FlagKubernetesAuthzZanzanaSync
	// Enable sync of Zanzana authorization store on AuthZ CRD mutations
	FlagKubernetesAuthzZanzanaSync = "kubernetesAuthzZanzanaSync"

	// FlagKubernetesAuthzCoreRolesApi
	// Registers AuthZ Core Roles /apis endpoint
	FlagKubernetesAuthzCoreRolesApi = "kubernetesAuthzCoreRolesApi"

	// FlagKubernetesAuthzGlobalRolesApi
	// Registers AuthZ Global Roles /apis endpoint
	FlagKubernetesAuthzGlobalRolesApi = "kubernetesAuthzGlobalRolesApi"

	// FlagKubernetesAuthzRolesApi
	// Registers AuthZ Roles /apis endpoint
	FlagKubernetesAuthzRolesApi = "kubernetesAuthzRolesApi"

	// FlagKubernetesAuthzTeamLBACRuleApi
	// Registers AuthZ TeamLBACRule /apis endpoint
	FlagKubernetesAuthzTeamLBACRuleApi = "kubernetesAuthzTeamLBACRuleApi"

	// FlagKubernetesAuthzRoleBindingsApi
	// Registers AuthZ Role Bindings /apis endpoint
	FlagKubernetesAuthzRoleBindingsApi = "kubernetesAuthzRoleBindingsApi"

	// FlagKubernetesAuthnMutation
	// Enables create, delete, and update mutations for resources owned by IAM identity
	FlagKubernetesAuthnMutation = "kubernetesAuthnMutation"

	// FlagRestoreDashboards
	// Enables restore deleted dashboards feature
	FlagRestoreDashboards = "restoreDashboards"

	// FlagAlertEnrichment
	// Enable configuration of alert enrichments in Grafana Cloud.
	FlagAlertEnrichment = "alertEnrichment"

	// FlagAlertEnrichmentMultiStep
	// Allow multiple steps per enrichment.
	FlagAlertEnrichmentMultiStep = "alertEnrichmentMultiStep"

	// FlagAlertEnrichmentConditional
	// Enable conditional alert enrichment steps.
	FlagAlertEnrichmentConditional = "alertEnrichmentConditional"

	// FlagAlertingImportAlertmanagerAPI
	// Enables the API to import Alertmanager configuration
	FlagAlertingImportAlertmanagerAPI = "alertingImportAlertmanagerAPI"

	// FlagAlertingImportAlertmanagerUI
	// Enables the UI to see imported Alertmanager configuration
	FlagAlertingImportAlertmanagerUI = "alertingImportAlertmanagerUI"

	// FlagAlertingDisableDMAinUI
	// Disables the DMA feature in the UI
	FlagAlertingDisableDMAinUI = "alertingDisableDMAinUI"

	// FlagPreferLibraryPanelTitle
	// Prefer library panel title over viz panel title.
	FlagPreferLibraryPanelTitle = "preferLibraryPanelTitle"

	// FlagTabularNumbers
	// Use fixed-width numbers globally in the UI
	FlagTabularNumbers = "tabularNumbers"

	// FlagNewInfluxDSConfigPageDesign
	// Enables new design for the InfluxDB data source configuration page
	FlagNewInfluxDSConfigPageDesign = "newInfluxDSConfigPageDesign"

	// FlagAlertingNotificationHistory
	// Enables the notification history feature
	FlagAlertingNotificationHistory = "alertingNotificationHistory"

	// FlagUnifiedStorageSearchDualReaderEnabled
	// Enable dual reader for unified storage search
	FlagUnifiedStorageSearchDualReaderEnabled = "unifiedStorageSearchDualReaderEnabled"

	// FlagAlertmanagerRemoteSecondaryWithRemoteState
	// Starts Grafana in remote secondary mode pulling the latest state from the remote Alertmanager to avoid duplicate notifications.
	FlagAlertmanagerRemoteSecondaryWithRemoteState = "alertmanagerRemoteSecondaryWithRemoteState"

	// FlagNewClickhouseConfigPageDesign
	// Enables new design for the Clickhouse data source configuration page
	FlagNewClickhouseConfigPageDesign = "newClickhouseConfigPageDesign"

	// FlagTeamFolders
	// Enables team folders functionality
	FlagTeamFolders = "teamFolders"

	// FlagInteractiveLearning
	// Enables the interactive learning app
	FlagInteractiveLearning = "interactiveLearning"

	// FlagAlertingTriage
	// Enables the alerting triage feature
	FlagAlertingTriage = "alertingTriage"

	// FlagGraphiteBackendMode
	// Enables the Graphite data source full backend mode
	FlagGraphiteBackendMode = "graphiteBackendMode"

	// FlagPrometheusTypeMigration
	// Checks for deprecated Prometheus authentication methods (SigV4 and Azure), installs the relevant data source, and migrates the Prometheus data sources
	FlagPrometheusTypeMigration = "prometheusTypeMigration"

	// FlagPluginContainers
	// Enables running plugins in containers
	FlagPluginContainers = "pluginContainers"

	// FlagCdnPluginsLoadFirst
	// Prioritize loading plugins from the CDN before other sources
	FlagCdnPluginsLoadFirst = "cdnPluginsLoadFirst"

	// FlagCdnPluginsUrls
	// Enable loading plugins via declarative URLs
	FlagCdnPluginsUrls = "cdnPluginsUrls"

	// FlagPluginInstallAPISync
	// Enable syncing plugin installations to the installs API
	FlagPluginInstallAPISync = "pluginInstallAPISync"

	// FlagJaegerEnableGrpcEndpoint
	// Enable querying trace data through Jaeger&#39;s gRPC endpoint (HTTP)
	FlagJaegerEnableGrpcEndpoint = "jaegerEnableGrpcEndpoint"

	// FlagPluginStoreServiceLoading
	// Load plugins on store service startup instead of wire provider, and call RegisterFixedRoles after all plugins are loaded
	FlagPluginStoreServiceLoading = "pluginStoreServiceLoading"

	// FlagOnlyStoreActionSets
	// When storing dashboard and folder resource permissions, only store action sets and not the full list of underlying permission
	FlagOnlyStoreActionSets = "onlyStoreActionSets"

	// FlagExcludeRedundantManagedPermissions
	// Exclude redundant individual dashboard/folder permissions from managed roles at query time
	FlagExcludeRedundantManagedPermissions = "excludeRedundantManagedPermissions"

	// FlagPanelTimeSettings
	// Enables a new panel time settings drawer
	FlagPanelTimeSettings = "panelTimeSettings"

	// FlagElasticsearchRawDSLQuery
	// Enables the raw DSL query editor in the Elasticsearch data source
	FlagElasticsearchRawDSLQuery = "elasticsearchRawDSLQuery"

	// FlagAwsDatasourcesHttpProxy
	// Enables http proxy settings for aws datasources
	FlagAwsDatasourcesHttpProxy = "awsDatasourcesHttpProxy"

	// FlagOpentsdbBackendMigration
	// Run queries through the data source backend
	FlagOpentsdbBackendMigration = "opentsdbBackendMigration"

	// FlagKubernetesAlertingHistorian
	// Adds support for Kubernetes alerting historian APIs
	FlagKubernetesAlertingHistorian = "kubernetesAlertingHistorian"

	// FlagSecretsManagementAppPlatformAwsKeeper
	// Enables the creation of keepers that manage secrets stored on AWS secrets manager
	FlagSecretsManagementAppPlatformAwsKeeper = "secretsManagementAppPlatformAwsKeeper"

	// FlagProfilesExemplars
	// Enables profiles exemplars support in profiles drilldown
	FlagProfilesExemplars = "profilesExemplars"

	// FlagAlertingSyncDispatchTimer
	// Use synchronized dispatch timer to minimize duplicate notifications across alertmanager HA pods
	FlagAlertingSyncDispatchTimer = "alertingSyncDispatchTimer"

	// FlagKubernetesTeamBindings
	// Enables search for team bindings in the app platform API
	FlagKubernetesTeamBindings = "kubernetesTeamBindings"

	// FlagKubernetesTeamsHandlerRedirect
	// Redirects the request of the team endpoints to the app platform APIs
	FlagKubernetesTeamsHandlerRedirect = "kubernetesTeamsHandlerRedirect"

	// FlagKubernetesExternalGroupMappingsApi
	// Enables external group mapping APIs in the app platform
	FlagKubernetesExternalGroupMappingsApi = "kubernetesExternalGroupMappingsApi"

	// FlagKubernetesExternalGroupMappingsRedirect
	// Redirects the request of the external group mapping endpoints to the app platform APIs
	FlagKubernetesExternalGroupMappingsRedirect = "kubernetesExternalGroupMappingsRedirect"

	// FlagKubernetesTeamSync
	// Use the new APIs for syncing users to teams
	FlagKubernetesTeamSync = "kubernetesTeamSync"

	// FlagAlertingMultiplePolicies
	// Enables the ability to create multiple alerting policies
	FlagAlertingMultiplePolicies = "alertingMultiplePolicies"

	// FlagAlertingIgnorePendingForNoDataAndError
	// Makes NoData and Error alerts fire immediately, without &#39;pending&#39; stage
	FlagAlertingIgnorePendingForNoDataAndError = "alertingIgnorePendingForNoDataAndError"

	// FlagAlertingNotificationHistoryRuleViewer
	// Enables the notification history tab in the rule viewer
	FlagAlertingNotificationHistoryRuleViewer = "alertingNotificationHistoryRuleViewer"

	// FlagAlertingNotificationHistoryGlobal
	// Enables the notification history global menu item viewer
	FlagAlertingNotificationHistoryGlobal = "alertingNotificationHistoryGlobal"

	// FlagReact19
	// Whether to use the new React 19 runtime
	FlagReact19 = "react19"

	// FlagFrontendServiceUseSettingsService
	// Enables the frontend service to fetch tenant-specific settings overrides from the settings service
	FlagFrontendServiceUseSettingsService = "frontendServiceUseSettingsService"
)
