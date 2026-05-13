// NOTE: This file was auto generated.  DO NOT EDIT DIRECTLY!
// To change feature flags, edit:
//  pkg/services/featuremgmt/registry.go
// Then run tests in:
//  pkg/services/featuremgmt/toggles_gen_test.go

/**
 * Describes available feature toggles in Grafana. These can be configured via
 * conf/custom.ini to enable features under development or not yet available in
 * stable version.
 *
 * Only enabled values will be returned in this interface.
 *
 * NOTE: the possible values may change between versions without notice, although
 * this may cause compilation issues when depending on removed feature keys, the
 * runtime state will continue to work.
 *
 * @public
 */
export interface FeatureToggles {
  /**
  * Disable envelope encryption (emergency only)
  * @default false
  */
  disableEnvelopeEncryption?: boolean;
  /**
  * Search for dashboards using panel title
  * @default false
  */
  panelTitleSearch?: boolean;
  /**
  * Enables public dashboard sharing to be restricted to only allowed emails
  * @default false
  */
  publicDashboardsEmailSharing?: boolean;
  /**
  * Enables public dashboard rendering using scenes
  * @default true
  */
  publicDashboardsScene?: boolean;
  /**
  * Support new streaming approach for loki (prototype, needs special loki build)
  * @default false
  */
  lokiExperimentalStreaming?: boolean;
  /**
  * Highlight Grafana Enterprise features
  * @default false
  */
  featureHighlights?: boolean;
  /**
  * Configurable storage for dashboards, datasources, and resources
  * @default false
  */
  storage?: boolean;
  /**
  * Allow elements nesting
  * @default false
  */
  canvasPanelNesting?: boolean;
  /**
  * Run the GRPC server
  * @default false
  */
  grpcServer?: boolean;
  /**
  * Enables cross-account querying in CloudWatch datasources
  * @default true
  */
  cloudWatchCrossAccountQuerying?: boolean;
  /**
  * Show warnings when dashboards do not validate against the schema
  * @default false
  */
  showDashboardValidationWarnings?: boolean;
  /**
  * Rule backtesting API for alerting
  * @default false
  */
  alertingBacktesting?: boolean;
  /**
  * Allow datasource to provide custom UI for context view
  * @default true
  */
  logsContextDatasourceUi?: boolean;
  /**
  * Use stream shards to split queries into smaller subqueries
  * @default false
  */
  lokiShardSplitting?: boolean;
  /**
  * Split large interval queries into subqueries with smaller time intervals
  * @default true
  */
  lokiQuerySplitting?: boolean;
  /**
  * Query InfluxDB InfluxQL without the proxy
  * @default true
  */
  influxdbBackendMigration?: boolean;
  /**
  * Registers a live apiserver
  * @default false
  */
  liveAPIServer?: boolean;
  /**
  * populate star status from apiserver
  * @default false
  */
  starsFromAPIServer?: boolean;
  /**
  * Routes stars requests from /api to the /apis endpoint
  * @default false
  */
  kubernetesStars?: boolean;
  /**
  * Enable streaming JSON parser for InfluxDB datasource InfluxQL query language
  * @default false
  */
  influxqlStreamingParser?: boolean;
  /**
  * Enables running InfluxDB Influxql queries in parallel
  * @default false
  */
  influxdbRunQueriesInParallel?: boolean;
  /**
  * Changes logs responses from Loki to be compliant with the dataplane specification.
  * @default false
  */
  lokiLogsDataplane?: boolean;
  /**
  * Disables dataplane specific processing in server side expressions.
  * @default false
  */
  disableSSEDataplane?: boolean;
  /**
  * Uses JWT-based auth for rendering instead of relying on remote cache
  * @default false
  */
  renderAuthJWT?: boolean;
  /**
  * Refactor time range variables flow to reduce number of API calls made when query variables are chained
  * @default false
  */
  refactorVariablesTimeRange?: boolean;
  /**
  * Enable the data source selector within the Frontend Apps section of the Frontend Observability
  * @default false
  */
  faroDatasourceSelector?: boolean;
  /**
  * Enables the edit functionality in the datagrid panel
  * @default false
  */
  enableDatagridEditing?: boolean;
  /**
  * A table visualisation for logs in Explore
  * @default true
  */
  logsExploreTableVisualisation?: boolean;
  /**
  * Support temporary security credentials in AWS plugins for Grafana Cloud customers
  * @default true
  */
  awsDatasourcesTempCredentials?: boolean;
  /**
  * Enable support for Machine Learning in server-side expressions
  * @default false
  */
  mlExpressions?: boolean;
  /**
  * Expose some datasources as apiservers.
  * @default false
  */
  datasourceAPIServers?: boolean;
  /**
  * Register experimental APIs with the k8s API server, including all datasources
  * @default false
  */
  grafanaAPIServerWithExperimentalAPIs?: boolean;
  /**
  * Next generation provisioning... and git
  * @default false
  */
  provisioning?: boolean;
  /**
  * Start an additional https handler and write kubectl options
  * @default false
  */
  grafanaAPIServerEnsureKubectlAccess?: boolean;
  /**
  * Enable caching for async queries for Redshift and Athena. Requires that the datasource has caching and async query support enabled
  * @default true
  */
  awsAsyncQueryCaching?: boolean;
  /**
  * Enable request deduplication when query caching is enabled. Requests issuing the same query will be deduplicated, only the first request to arrive will be executed and the response will be shared with requests arriving while there is a request in-flight
  * @default false
  */
  queryCacheRequestDeduplication?: boolean;
  /**
  * Enable changing the scheduler base interval via configuration option unified_alerting.scheduler_tick_interval
  * @default false
  */
  configurableSchedulerTick?: boolean;
  /**
  * Enable AI powered features in dashboards
  * @default true
  */
  dashgpt?: boolean;
  /**
  * Enable AI powered features for dashboards to auto-summary changes when saving
  * @default false
  */
  aiGeneratedDashboardChanges?: boolean;
  /**
  * Enables rendering retries for the reporting feature
  * @default false
  */
  reportingRetries?: boolean;
  /**
  * Enables CSV encoding options in the reporting feature
  * @default false
  */
  reportingCsvEncodingOptions?: boolean;
  /**
  * Send query to the same datasource in a single request when using server side expressions. The `cloudWatchBatchQueries` feature toggle should be enabled if this used with CloudWatch.
  * @default false
  */
  sseGroupByDatasource?: boolean;
  /**
  * Enables running Loki queries in parallel
  * @default false
  */
  lokiRunQueriesInParallel?: boolean;
  /**
  * Automatic service account and token setup for plugins
  * @default false
  */
  externalServiceAccounts?: boolean;
  /**
  * Routes snapshot requests from /api to the /apis endpoint
  * @default false
  */
  kubernetesSnapshots?: boolean;
  /**
  * Routes library panel requests from /api to the /apis endpoint
  * @default false
  */
  kubernetesLibraryPanels?: boolean;
  /**
  * Use the kubernetes API in the frontend for dashboards
  * @default true
  */
  kubernetesDashboards?: boolean;
  /**
  * Enables k8s short url api and uses it under the hood when handling legacy /api
  * @default false
  */
  kubernetesShortURLs?: boolean;
  /**
  * Routes short url requests from /api to the /apis endpoint in the frontend. Depends on kubernetesShortURLs
  * @default false
  */
  useKubernetesShortURLsAPI?: boolean;
  /**
  * Adds support for Kubernetes alerting and recording rules
  * @default false
  */
  kubernetesAlertingRules?: boolean;
  /**
  * Adds support for Kubernetes correlations
  * @default false
  */
  kubernetesCorrelations?: boolean;
  /**
  * Adds support for Kubernetes unified storage quotas
  * @default false
  */
  kubernetesUnifiedStorageQuotas?: boolean;
  /**
  * Adds support for Kubernetes logs drilldown
  * @default false
  */
  kubernetesLogsDrilldown?: boolean;
  /**
  * Adds support for Kubernetes querycaching
  * @default false
  */
  kubernetesQueryCaching?: boolean;
  /**
  * Disable schema validation for dashboards/v1
  * @default false
  */
  dashboardDisableSchemaValidationV1?: boolean;
  /**
  * Disable schema validation for dashboards/v2
  * @default false
  */
  dashboardDisableSchemaValidationV2?: boolean;
  /**
  * Log schema validation errors so they can be analyzed later
  * @default false
  */
  dashboardSchemaValidationLogging?: boolean;
  /**
  * Enable fallback parsing behavior when scan row encounters invalid dashboard JSON
  * @default false
  */
  scanRowInvalidDashboardParseFallbackEnabled?: boolean;
  /**
  * Show query type endpoints in datasource API servers (currently hardcoded for testdata, expressions, and prometheus)
  * @default false
  */
  datasourceQueryTypes?: boolean;
  /**
  * Register /apis/query.grafana.app/ -- will eventually replace /api/ds/query
  * @default false
  */
  queryService?: boolean;
  /**
  * Adds datasource connections to the query service
  * @default false
  */
  queryServiceWithConnections?: boolean;
  /**
  * Rewrite requests targeting /ds/query to the query service
  * @default false
  */
  queryServiceRewrite?: boolean;
  /**
  * Routes requests to the new query service
  * @default false
  */
  queryServiceFromUI?: boolean;
  /**
  * Runs CloudWatch metrics queries as separate batches
  * @default false
  */
  cloudWatchBatchQueries?: boolean;
  /**
  * If enabled, the caching backend gradually serializes query responses for the cache, comparing against the configured `[caching]max_value_mb` value as it goes. This can can help prevent Grafana from running out of memory while attempting to cache very large query responses.
  * @default false
  */
  cachingOptimizeSerializationMemoryUsage?: boolean;
  /**
  * Enable Grafana to sync configuration and state with a remote Alertmanager.
  * @default false
  */
  alertmanagerRemoteSecondary?: boolean;
  /**
  * Enables a feature to avoid issues with concurrent writes to the alerting provenance table in MySQL
  * @default false
  */
  alertingProvenanceLockWrites?: boolean;
  /**
  * Enables the UI to use certain backend-side filters
  * @default false
  */
  alertingUIUseBackendFilters?: boolean;
  /**
  * Enables the UI to use rules backend-side filters 100% compatible with the frontend filters
  * @default false
  */
  alertingUIUseFullyCompatBackendFilters?: boolean;
  /**
  * Enable Grafana to have a remote Alertmanager instance as the primary Alertmanager.
  * @default false
  */
  alertmanagerRemotePrimary?: boolean;
  /**
  * Change the way annotation permissions work by scoping them to folders and dashboards.
  * @default true
  */
  annotationPermissionUpdate?: boolean;
  /**
  * Enables dashboard rendering using Scenes for viewer roles
  * @default true
  */
  dashboardSceneForViewers?: boolean;
  /**
  * Enables rendering dashboards using scenes for solo panels
  * @default true
  */
  dashboardSceneSolo?: boolean;
  /**
  * Enables dashboard rendering using scenes for all roles
  * @default true
  */
  dashboardScene?: boolean;
  /**
  * Enables new dashboard layouts
  * @default false
  */
  dashboardNewLayouts?: boolean;
  /**
  * Enables undo/redo in dynamic dashboards
  * @default false
  */
  dashboardUndoRedo?: boolean;
  /**
  * Enables unlimited dashboard panel grouping
  * @default false
  */
  unlimitedLayoutsNesting?: boolean;
  /**
  * Enables showing recently used drilldowns or recommendations given by the datasource in the AdHocFilters and GroupBy variables
  * @default false
  */
  drilldownRecommendations?: boolean;
  /**
  * Enables viewing non-applicable drilldowns on a panel level
  * @default false
  */
  perPanelNonApplicableDrilldowns?: boolean;
  /**
  * Enables a group by action per panel
  * @default false
  */
  panelGroupBy?: boolean;
  /**
  * Enables filtering by grouping labels on the panel level through legend or tooltip
  * @default false
  */
  perPanelFiltering?: boolean;
  /**
  * Enables use of the `systemPanelFilterVar` variable to filter panels in a dashboard
  * @default false
  */
  panelFilterVariable?: boolean;
  /**
  * Enables generating table data as PDF in reporting
  * @default false
  */
  pdfTables?: boolean;
  /**
  * Allow pan and zoom in canvas panel
  * @default false
  */
  canvasPanelPanZoom?: boolean;
  /**
  * Enables time comparison option in supported panels
  * @default false
  */
  timeComparison?: boolean;
  /**
  * Enables shared crosshair in table panel
  * @default false
  */
  tableSharedCrosshair?: boolean;
  /**
  * Enabled grafana cloud specific RBAC roles
  * @default false
  */
  cloudRBACRoles?: boolean;
  /**
  * Optimizes eligible queries in order to reduce load on datasources
  * @default false
  */
  alertingQueryOptimization?: boolean;
  /**
  * Distributes alert rule evaluations more evenly over time, including spreading out rules within the same group. Disables sequential evaluation if enabled.
  * @default false
  */
  jitterAlertRulesWithinGroups?: boolean;
  /**
  * Enable audit logging with Kubernetes under app platform
  * @default false
  */
  auditLoggingAppPlatform?: boolean;
  /**
  * Enable the secrets management API and services under app platform
  * @default false
  */
  secretsManagementAppPlatform?: boolean;
  /**
  * Enable the secrets management app platform UI
  * @default false
  */
  secretsManagementAppPlatformUI?: boolean;
  /**
  * Writes the state periodically to the database, asynchronous to rule evaluation
  * @default false
  */
  alertingSaveStatePeriodic?: boolean;
  /**
  * Enables the compressed protobuf-based alert state storage. Default is enabled.
  * @default true
  */
  alertingSaveStateCompressed?: boolean;
  /**
  * In-development feature flag for the scope api using the app platform.
  * @default false
  */
  scopeApi?: boolean;
  /**
  * Use the single node endpoint for the scope api. This is used to fetch the scope parent node.
  * @default false
  */
  useScopeSingleNodeEndpoint?: boolean;
  /**
  * Makes the frontend use the 'names' param for fetching multiple scope nodes at once
  * @default false
  */
  useMultipleScopeNodesEndpoint?: boolean;
  /**
  * In-development feature that will allow injection of labels into loki queries.
  * @default false
  */
  logQLScope?: boolean;
  /**
  * Enables SQL Expressions, which can execute SQL queries against data source results.
  * @default false
  */
  sqlExpressions?: boolean;
  /**
  * Enables column autocomplete for SQL Expressions
  * @default false
  */
  sqlExpressionsColumnAutoComplete?: boolean;
  /**
  * Enable grafana's embedded kube-aggregator
  * @default false
  */
  kubernetesAggregator?: boolean;
  /**
  * Enable CAP token based authentication in grafana's embedded kube-aggregator
  * @default false
  */
  kubernetesAggregatorCapTokenAuth?: boolean;
  /**
  * Enable groupBy variable support in scenes dashboards
  * @default false
  */
  groupByVariable?: boolean;
  /**
  * Enables the use of scope filters in Grafana
  * @default false
  */
  scopeFilters?: boolean;
  /**
  * Require that sub claims is present in oauth tokens.
  * @default false
  */
  oauthRequireSubClaim?: boolean;
  /**
  * Require that refresh tokens are present in oauth tokens.
  * @default false
  */
  refreshTokenRequired?: boolean;
  /**
  * Enables filters and group by variables on all new dashboards. Variables are added only if default data source supports filtering.
  * @default false
  */
  newDashboardWithFiltersAndGroupBy?: boolean;
  /**
  * Wraps the ad hoc and group by variables in a single wrapper, with all other variables below it
  * @default false
  */
  dashboardAdHocAndGroupByWrapper?: boolean;
  /**
  * Updates CloudWatch label parsing to be more accurate
  * @default true
  */
  cloudWatchNewLabelParsing?: boolean;
  /**
  * In server-side expressions, disable the sorting of numeric-kind metrics by their metric name or labels.
  * @default false
  */
  disableNumericMetricsSortingInExpressions?: boolean;
  /**
  * Enables Grafana-managed recording rules.
  * @default false
  */
  grafanaManagedRecordingRules?: boolean;
  /**
  * Enables Saved queries (query library) feature
  * @default false
  */
  queryLibrary?: boolean;
  /**
  * Enables Saved queries (query library) RBAC permissions
  * @default false
  */
  savedQueriesRBAC?: boolean;
  /**
  * Displays datasource provisioned dashboards in dashboard empty page, only when coming from datasource configuration page
  * @default false
  */
  dashboardLibrary?: boolean;
  /**
  * Displays datasource provisioned and community dashboards in dashboard empty page, only when coming from datasource configuration page
  * @default false
  */
  suggestedDashboards?: boolean;
  /**
  * Enables dashboard validator app to run compatibility checks between a dashboard and data source
  * @default false
  */
  dashboardValidatorApp?: boolean;
  /**
  * Enables a flow to get started with a new dashboard from a template
  * @default false
  */
  dashboardTemplates?: boolean;
  /**
  * Enables the new alert list view design
  * @default false
  */
  alertingListViewV2?: boolean;
  /**
  * Enables the new Alerting navigation structure with improved menu grouping
  * @default false
  */
  alertingNavigationV2?: boolean;
  /**
  * Enables saved searches for alert rules list
  * @default false
  */
  alertingSavedSearches?: boolean;
  /**
  * Disables the ability to send alerts to an external Alertmanager datasource.
  * @default false
  */
  alertingDisableSendAlertsExternal?: boolean;
  /**
  * Enables possibility to preserve dashboard variables and time range when navigating between dashboards
  * @default false
  */
  preserveDashboardStateWhenNavigating?: boolean;
  /**
  * Enables the new central alert history.
  * @default false
  */
  alertingCentralAlertHistory?: boolean;
  /**
  * Preserve plugin proxy trailing slash.
  * @default false
  */
  pluginProxyPreserveTrailingSlash?: boolean;
  /**
  * Allows configuration of Azure Monitor as a data source that can provide Prometheus exemplars
  * @default true
  */
  azureMonitorPrometheusExemplars?: boolean;
  /**
  * Enables the gRPC server for authorization
  * @default false
  */
  authZGRPCServer?: boolean;
  /**
  * Use the new SSO Settings API to configure LDAP
  * @default true
  */
  ssoSettingsLDAP?: boolean;
  /**
  * Use openFGA as authorization engine.
  * @default false
  */
  zanzana?: boolean;
  /**
  * Use openFGA as main authorization engine and disable legacy RBAC clietn.
  * @default false
  */
  zanzanaNoLegacyClient?: boolean;
  /**
  * Enables reload of dashboards on scopes, time range and variables changes
  * @default false
  */
  reloadDashboardsOnParamsChange?: boolean;
  /**
  * Enables the scopes usage in Metrics Explore
  * @default false
  */
  enableScopesInMetricsExplore?: boolean;
  /**
  * Round up end time for metric queries to the next minute to avoid missing data
  * @default true
  */
  cloudWatchRoundUpEndTime?: boolean;
  /**
  * Deprecated. Allow override default AAD audience for Azure Prometheus endpoint. Enabled by default. This feature should no longer be used and will be removed in the future.
  * @deprecated
  * @default true
  */
  prometheusAzureOverrideAudience?: boolean;
  /**
  * Enable the new alerting search experience
  * @default false
  */
  alertingFilterV2?: boolean;
  /**
  * Enable grafana dataplane aggregator
  * @default false
  */
  dataplaneAggregator?: boolean;
  /**
  * Enables new combobox style UI for the Ad hoc filters variable in scenes architecture
  * @default true
  */
  newFiltersUI?: boolean;
  /**
  * Allows authenticated API calls in actions
  * @default false
  */
  vizActionsAuth?: boolean;
  /**
  * Uses Prometheus rules as the primary source of truth for ruler-enabled data sources
  * @default false
  */
  alertingPrometheusRulesPrimary?: boolean;
  /**
  * Deprecated. Replace with lokiShardSplitting. Used in Logs Drilldown to split queries into multiple queries based on the number of shards
  * @default false
  */
  exploreLogsShardSplitting?: boolean;
  /**
  * Used in Logs Drilldown to query by aggregated metrics
  * @default false
  */
  exploreLogsAggregatedMetrics?: boolean;
  /**
  * Enables the gRPC client to authenticate with the App Platform by using ID & access tokens
  * @default false
  */
  appPlatformGrpcClientAuth?: boolean;
  /**
  * Enable the groupsync extension for managing Group Attribute Sync feature
  * @default false
  */
  groupAttributeSync?: boolean;
  /**
  * Enables step mode for alerting queries and expressions
  * @default true
  */
  alertingQueryAndExpressionsStepMode?: boolean;
  /**
  * Enables improved support for OAuth external sessions. After enabling this feature, users might need to re-authenticate themselves.
  * @default true
  */
  improvedExternalSessionHandling?: boolean;
  /**
  * Use session storage for handling the redirection after login
  * @default true
  */
  useSessionStorageForRedirection?: boolean;
  /**
  * Enables the new role picker drawer design
  * @default false
  */
  rolePickerDrawer?: boolean;
  /**
  * Pick the dual write mode from database configs
  * @default false
  */
  managedDualWriter?: boolean;
  /**
  * Enables SRI checks for plugin assets
  * @default false
  */
  pluginsSriChecks?: boolean;
  /**
  * Enables to save big objects in blob storage
  * @default false
  */
  unifiedStorageBigObjectsSupport?: boolean;
  /**
  * Enables time pickers sync
  * @default false
  */
  timeRangeProvider?: boolean;
  /**
  * Enables time range panning functionality
  * @default false
  */
  timeRangePan?: boolean;
  /**
  * Enables new keyboard shortcuts for time range zoom operations
  * @default false
  */
  newTimeRangeZoomShortcuts?: boolean;
  /**
  * Disables the log limit restriction for Azure Monitor when true. The limit is enabled by default.
  * @default false
  */
  azureMonitorDisableLogLimit?: boolean;
  /**
  * Enables experimental reconciler for playlists
  * @default false
  */
  playlistsReconciler?: boolean;
  /**
  * Enable passwordless login via magic link authentication
  * @default false
  */
  passwordlessMagicLinkAuthentication?: boolean;
  /**
  * Adds support for quotes and special characters in label values for Prometheus queries
  * @default false
  */
  prometheusSpecialCharsInLabelValues?: boolean;
  /**
  * Enables the extension admin page regardless of development mode
  * @default false
  */
  enableExtensionsAdminPage?: boolean;
  /**
  * Enables SCIM support for user and group management
  * @default true
  */
  enableSCIM?: boolean;
  /**
  * Enables browser crash detection reporting to Faro.
  * @default false
  */
  crashDetection?: boolean;
  /**
  * Enables removing the reducer from the alerting UI when creating a new alert rule and using instant query
  * @default true
  */
  alertingUIOptimizeReducer?: boolean;
  /**
  * Enables user auth for Azure Monitor datasource only
  * @default true
  */
  azureMonitorEnableUserAuth?: boolean;
  /**
  * Enable AI-generated alert rules.
  * @default false
  */
  alertingAIGenAlertRules?: boolean;
  /**
  * Enable AI-generated feedback from the Grafana UI.
  * @default false
  */
  alertingAIFeedback?: boolean;
  /**
  * Enable AI-improve alert rules labels and annotations.
  * @default false
  */
  alertingAIImproveAlertRules?: boolean;
  /**
  * Enable AI-generated alerting templates.
  * @default false
  */
  alertingAIGenTemplates?: boolean;
  /**
  * Enable enrichment per rule in the alerting UI.
  * @default false
  */
  alertingEnrichmentPerRule?: boolean;
  /**
  * Enable Assistant Investigations enrichment type.
  * @default false
  */
  alertingEnrichmentAssistantInvestigations?: boolean;
  /**
  * Enable AI-analyze central state history.
  * @default false
  */
  alertingAIAnalyzeCentralStateHistory?: boolean;
  /**
  * Enables simplified step mode in the notifications section
  * @default true
  */
  alertingNotificationsStepMode?: boolean;
  /**
  * Enable unified storage search UI
  * @default false
  */
  unifiedStorageSearchUI?: boolean;
  /**
  * Enables cross cluster search in the Elasticsearch data source
  * @default false
  */
  elasticsearchCrossClusterSearch?: boolean;
  /**
  * Defaults to using the Loki `/labels` API instead of `/series`
  * @default true
  */
  lokiLabelNamesQueryApi?: boolean;
  /**
  * Enable folder's api server counts
  * @default false
  */
  k8SFolderCounts?: boolean;
  /**
  * Enables improved support for SAML external sessions. Ensure the NameID format is correctly configured in Grafana for SAML Single Logout to function properly.
  * @default true
  */
  improvedExternalSessionHandlingSAML?: boolean;
  /**
  * Enables LBAC for datasources for Tempo to apply LBAC filtering of traces to the client requests for users in teams
  * @default false
  */
  teamHttpHeadersTempo?: boolean;
  /**
  * Enables Advisor app
  * @default false
  */
  grafanaAdvisor?: boolean;
  /**
  * Enables less memory intensive Elasticsearch result parsing
  * @default false
  */
  elasticsearchImprovedParsing?: boolean;
  /**
  * Shows defined connections for a data source in the plugins detail page
  * @default false
  */
  datasourceConnectionsTab?: boolean;
  /**
  * Use a POST request to list rules by passing down the namespaces user has access to
  * @default false
  */
  fetchRulesUsingPost?: boolean;
  /**
  * Add compact=true when fetching rules
  * @default false
  */
  fetchRulesInCompactMode?: boolean;
  /**
  * Enables the new logs panel
  * @default true
  */
  newLogsPanel?: boolean;
  /**
  * Enables the temporary themes for GrafanaCon
  * @default true
  */
  grafanaconThemes?: boolean;
  /**
  * Enables the new Jira integration for contact points in cloud alert managers.
  * @default false
  */
  alertingJiraIntegration?: boolean;
  /**
  * 
  * @default true
  */
  alertingUseNewSimplifiedRoutingHashAlgorithm?: boolean;
  /**
  * Use the scopes navigation endpoint instead of the dashboardbindings endpoint
  * @default false
  */
  useScopesNavigationEndpoint?: boolean;
  /**
  * Enable scope search to include all levels of the scope node tree
  * @default false
  */
  scopeSearchAllLevels?: boolean;
  /**
  * Enables the alert rule version history restore feature
  * @default true
  */
  alertingRuleVersionHistoryRestore?: boolean;
  /**
  * Enables the report creation drawer in a dashboard
  * @default false
  */
  newShareReportDrawer?: boolean;
  /**
  * Disable pre-loading app plugins when the request is coming from the renderer
  * @default false
  */
  rendererDisableAppPluginsPreload?: boolean;
  /**
  * Enables SRI checks for Grafana JavaScript assets
  * @default false
  */
  assetSriChecks?: boolean;
  /**
  * Enables the alert rule restore feature
  * @default true
  */
  alertRuleRestore?: boolean;
  /**
  * Enables running Infinity queries in parallel
  * @default false
  */
  infinityRunQueriesInParallel?: boolean;
  /**
  * Enables the alerting migration UI, to migrate data source-managed rules to Grafana-managed rules
  * @default true
  */
  alertingMigrationUI?: boolean;
  /**
  * Enables a UI feature for importing rules from a Prometheus file to Grafana-managed rules
  * @default true
  */
  alertingImportYAMLUI?: boolean;
  /**
  * Enables the logs builder mode for the Azure Monitor data source
  * @default false
  */
  azureMonitorLogsBuilderEditor?: boolean;
  /**
  * Specifies the locale so the correct format for numbers and dates can be shown
  * @deprecated
  * @default false
  */
  localeFormatPreference?: boolean;
  /**
  * Enables the unified storage grpc connection pool
  * @default false
  */
  unifiedStorageGrpcConnectionPool?: boolean;
  /**
  * Enables UI functionality to permanently delete alert rules
  * @default true
  */
  alertingRulePermanentlyDelete?: boolean;
  /**
  * Enables the UI functionality to recover and view deleted alert rules
  * @default true
  */
  alertingRuleRecoverDeleted?: boolean;
  /**
  * use multi-tenant path for awsTempCredentials
  * @default false
  */
  multiTenantTempCredentials?: boolean;
  /**
  * Enables unified navbars
  * @default false
  */
  unifiedNavbars?: boolean;
  /**
  * Enables a control component for the logs panel in Explore
  * @default true
  */
  logsPanelControls?: boolean;
  /**
  * Enables creating metrics from profiles and storing them as recording rules
  * @default false
  */
  metricsFromProfiles?: boolean;
  /**
  * Enables integration with Grafana Assistant in Profiles Drilldown
  * @default true
  */
  grafanaAssistantInProfilesDrilldown?: boolean;
  /**
  * Enables creating alerts from Tempo data source
  * @default false
  */
  tempoAlerting?: boolean;
  /**
  * Enables auto-updating of users installed plugins
  * @default false
  */
  pluginsAutoUpdate?: boolean;
  /**
  * Enables the alerting list view v2 preview toggle
  * @default false
  */
  alertingListViewV2PreviewToggle?: boolean;
  /**
  * Use FiredAt for StartsAt when sending alerts to Alertmaanger
  * @default false
  */
  alertRuleUseFiredAtForStartsAt?: boolean;
  /**
  * Enables the alerting bulk actions in the UI
  * @default true
  */
  alertingBulkActionsInUI?: boolean;
  /**
  * Deprecated: Use kubernetesAuthzCoreRolesApi, kubernetesAuthzRolesApi, and kubernetesAuthzRoleBindingsApi instead
  * @deprecated
  * @default false
  */
  kubernetesAuthzApis?: boolean;
  /**
  * Redirects the traffic from the legacy access control endpoints to the new K8s AuthZ endpoints
  * @default false
  */
  kubernetesAuthZHandlerRedirect?: boolean;
  /**
  * Registers AuthZ resource permission /apis endpoints
  * @default false
  */
  kubernetesAuthzResourcePermissionApis?: boolean;
  /**
  * Enable sync of Zanzana authorization store on AuthZ CRD mutations
  * @default false
  */
  kubernetesAuthzZanzanaSync?: boolean;
  /**
  * Registers AuthZ Core Roles /apis endpoint
  * @default false
  */
  kubernetesAuthzCoreRolesApi?: boolean;
  /**
  * Registers AuthZ Global Roles /apis endpoint
  * @default false
  */
  kubernetesAuthzGlobalRolesApi?: boolean;
  /**
  * Registers AuthZ Roles /apis endpoint
  * @default false
  */
  kubernetesAuthzRolesApi?: boolean;
  /**
  * Registers AuthZ TeamLBACRule /apis endpoint
  * @default false
  */
  kubernetesAuthzTeamLBACRuleApi?: boolean;
  /**
  * Registers AuthZ Role Bindings /apis endpoint
  * @default false
  */
  kubernetesAuthzRoleBindingsApi?: boolean;
  /**
  * Enables create, delete, and update mutations for resources owned by IAM identity
  * @default false
  */
  kubernetesAuthnMutation?: boolean;
  /**
  * Routes external group mapping requests from /api to the /apis endpoint
  * @default false
  */
  kubernetesExternalGroupMapping?: boolean;
  /**
  * Enables restore deleted dashboards feature
  * @default false
  */
  restoreDashboards?: boolean;
  /**
  * Enables recently viewed dashboards section in the browsing dashboard page
  * @default false
  */
  recentlyViewedDashboards?: boolean;
  /**
  * A/A test for recently viewed dashboards feature
  * @default false
  */
  experimentRecentlyViewedDashboards?: boolean;
  /**
  * Enable configuration of alert enrichments in Grafana Cloud.
  * @default false
  */
  alertEnrichment?: boolean;
  /**
  * Allow multiple steps per enrichment.
  * @default false
  */
  alertEnrichmentMultiStep?: boolean;
  /**
  * Enable conditional alert enrichment steps.
  * @default false
  */
  alertEnrichmentConditional?: boolean;
  /**
  * Enables the API to import Alertmanager configuration
  * @default false
  */
  alertingImportAlertmanagerAPI?: boolean;
  /**
  * Enables the UI to see imported Alertmanager configuration
  * @default false
  */
  alertingImportAlertmanagerUI?: boolean;
  /**
  * Disables the DMA feature in the UI
  * @default false
  */
  alertingDisableDMAinUI?: boolean;
  /**
  * Enables image sharing functionality for dashboards
  * @default true
  */
  sharingDashboardImage?: boolean;
  /**
  * Prefer library panel title over viz panel title.
  * @default false
  */
  preferLibraryPanelTitle?: boolean;
  /**
  * Use fixed-width numbers globally in the UI
  * @default false
  */
  tabularNumbers?: boolean;
  /**
  * Enables new design for the InfluxDB data source configuration page
  * @default false
  */
  newInfluxDSConfigPageDesign?: boolean;
  /**
  * Set this to true to enable all app chrome extensions registered by plugins.
  * @default false
  */
  enableAppChromeExtensions?: boolean;
  /**
  * Set this to true to enable all dashboard empty state extensions registered by plugins.
  * @default false
  */
  enableDashboardEmptyExtensions?: boolean;
  /**
  * Enables use of app platform API for folders
  * @default false
  */
  foldersAppPlatformAPI?: boolean;
  /**
  * Applies OTel formatting templates to displayed logs
  * @default false
  */
  otelLogsFormatting?: boolean;
  /**
  * Enables the notification history feature
  * @default false
  */
  alertingNotificationHistory?: boolean;
  /**
  * Enable dual reader for unified storage search
  * @default false
  */
  unifiedStorageSearchDualReaderEnabled?: boolean;
  /**
  * Supports __from and __to macros that always use the dashboard level time range
  * @default false
  */
  dashboardLevelTimeMacros?: boolean;
  /**
  * Starts Grafana in remote secondary mode pulling the latest state from the remote Alertmanager to avoid duplicate notifications.
  * @default false
  */
  alertmanagerRemoteSecondaryWithRemoteState?: boolean;
  /**
  * Enables sharing a list of APIs with a list of plugins
  * @default false
  */
  restrictedPluginApis?: boolean;
  /**
  * Enable favorite datasources
  * @default false
  */
  favoriteDatasources?: boolean;
  /**
  * New Log Context component
  * @default false
  */
  newLogContext?: boolean;
  /**
  * Enables new design for the Clickhouse data source configuration page
  * @default false
  */
  newClickhouseConfigPageDesign?: boolean;
  /**
  * Enables team folders functionality
  * @default false
  */
  teamFolders?: boolean;
  /**
  * Enables the interactive learning app
  * @default false
  */
  interactiveLearning?: boolean;
  /**
  * Enables the alerting triage feature
  * @default false
  */
  alertingTriage?: boolean;
  /**
  * Enables the Graphite data source full backend mode
  * @default false
  */
  graphiteBackendMode?: boolean;
  /**
  * Enables the updated Azure Monitor resource picker
  * @default true
  */
  azureResourcePickerUpdates?: boolean;
  /**
  * Checks for deprecated Prometheus authentication methods (SigV4 and Azure), installs the relevant data source, and migrates the Prometheus data sources
  * @default false
  */
  prometheusTypeMigration?: boolean;
  /**
  * Enables running plugins in containers
  * @default false
  */
  pluginContainers?: boolean;
  /**
  * Prioritize loading plugins from the CDN before other sources
  * @default false
  */
  cdnPluginsLoadFirst?: boolean;
  /**
  * Enable loading plugins via declarative URLs
  * @default false
  */
  cdnPluginsUrls?: boolean;
  /**
  * Enable syncing plugin installations to the installs API
  * @default false
  */
  pluginInstallAPISync?: boolean;
  /**
  * Enable new gauge visualization
  * @default false
  */
  newGauge?: boolean;
  /**
  * Enable new visualization suggestions
  * @default false
  */
  newVizSuggestions?: boolean;
  /**
  * Enable all plugins to supply visualization suggestions (including 3rd party plugins)
  * @default false
  */
  externalVizSuggestions?: boolean;
  /**
  * Enable Y-axis scale configuration options for pre-bucketed heatmap data (heatmap-rows)
  * @default false
  */
  heatmapRowsAxisOptions?: boolean;
  /**
  * Restrict PanelChrome contents with overflow: hidden;
  * @default true
  */
  preventPanelChromeOverflow?: boolean;
  /**
  * Enable querying trace data through Jaeger's gRPC endpoint (HTTP)
  * @default false
  */
  jaegerEnableGrpcEndpoint?: boolean;
  /**
  * Load plugins on store service startup instead of wire provider, and call RegisterFixedRoles after all plugins are loaded
  * @default false
  */
  pluginStoreServiceLoading?: boolean;
  /**
  * Increases panel padding globally
  * @default true
  */
  newPanelPadding?: boolean;
  /**
  * When storing dashboard and folder resource permissions, only store action sets and not the full list of underlying permission
  * @default true
  */
  onlyStoreActionSets?: boolean;
  /**
  * Show insights for plugins in the plugin details page
  * @default false
  */
  pluginInsights?: boolean;
  /**
  * Enables a new panel time settings drawer
  * @default false
  */
  panelTimeSettings?: boolean;
  /**
  * Enables the raw DSL query editor in the Elasticsearch data source
  * @default false
  */
  elasticsearchRawDSLQuery?: boolean;
  /**
  * Enables app platform API for annotations
  * @default false
  */
  kubernetesAnnotations?: boolean;
  /**
  * Enables http proxy settings for aws datasources
  * @default false
  */
  awsDatasourcesHttpProxy?: boolean;
  /**
  * Show transformation quick-start cards in empty transformations state
  * @default false
  */
  transformationsEmptyPlaceholder?: boolean;
  /**
  * Run queries through the data source backend
  * @default false
  */
  opentsdbBackendMigration?: boolean;
  /**
  * Enable TTL plugin instance manager
  * @default false
  */
  ttlPluginInstanceManager?: boolean;
  /**
  * Send X-Loki-Query-Limits-Context header to Loki on first split request
  * @default false
  */
  lokiQueryLimitsContext?: boolean;
  /**
  * Enables the new version of rudderstack
  * @default false
  */
  rudderstackUpgrade?: boolean;
  /**
  * Adds support for Kubernetes alerting historian APIs
  * @default false
  */
  kubernetesAlertingHistorian?: boolean;
  /**
  * Enables plugins decoupling from bootdata
  * @default false
  */
  useMTPlugins?: boolean;
  /**
  * Enables support for variables whose values can have multiple properties
  * @default false
  */
  multiPropsVariables?: boolean;
  /**
  * Enables the ASAP smoothing transformation for time series data
  * @default false
  */
  smoothingTransformation?: boolean;
  /**
  * Enables the creation of keepers that manage secrets stored on AWS secrets manager
  * @default false
  */
  secretsManagementAppPlatformAwsKeeper?: boolean;
  /**
  * Enables profiles exemplars support in profiles drilldown
  * @default false
  */
  profilesExemplars?: boolean;
  /**
  * Use synchronized dispatch timer to minimize duplicate notifications across alertmanager HA pods
  * @default false
  */
  alertingSyncDispatchTimer?: boolean;
  /**
  * Enables the Query with Assistant button in the query editor
  * @default false
  */
  queryWithAssistant?: boolean;
  /**
  * Enables next generation query editor experience
  * @default false
  */
  queryEditorNext?: boolean;
  /**
  * Enables search for team bindings in the app platform API
  * @default false
  */
  kubernetesTeamBindings?: boolean;
}

/**
 * Release stage for a registered feature toggle (see Grafana release life cycle).
 *
 * @public
 */
export type FeatureToggleStage =
  | 'experimental'
  | 'privatePreview'
  | 'publicPreview'
  | 'GA'
  | 'deprecated'
  | 'unknown';

/**
 * Static registry metadata for feature toggles (for UI such as the Administration Labs page).
 *
 * @public
 */
export interface FeatureToggleRegistryEntry {
  readonly name: string;
  readonly description: string;
  readonly stage: FeatureToggleStage;
  readonly owner: string;
  readonly expression: string;
  readonly frontendOnly: boolean;
  readonly requiresRestart: boolean;
  readonly requiresDevMode: boolean;
  readonly hideFromDocs: boolean;
}

/**
 * All standard feature toggles with metadata, sorted by name.
 *
 * @public
 */
export const FEATURE_TOGGLE_REGISTRY: readonly FeatureToggleRegistryEntry[] = [
  {
    name: "aiGeneratedDashboardChanges",
    description: "Enable AI powered features for dashboards to auto-summary changes when saving",
    stage: "experimental",
    owner: "@grafana/dashboards-squad",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "alertEnrichment",
    description: "Enable configuration of alert enrichments in Grafana Cloud.",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "alertEnrichmentConditional",
    description: "Enable conditional alert enrichment steps.",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "alertEnrichmentMultiStep",
    description: "Allow multiple steps per enrichment.",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "alertRuleRestore",
    description: "Enables the alert rule restore feature",
    stage: "publicPreview",
    owner: "@grafana/alerting-squad",
    expression: "true",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "alertRuleUseFiredAtForStartsAt",
    description: "Use FiredAt for StartsAt when sending alerts to Alertmaanger",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "alertingAIAnalyzeCentralStateHistory",
    description: "Enable AI-analyze central state history.",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "alertingAIFeedback",
    description: "Enable AI-generated feedback from the Grafana UI.",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "alertingAIGenAlertRules",
    description: "Enable AI-generated alert rules.",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "alertingAIGenTemplates",
    description: "Enable AI-generated alerting templates.",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "alertingAIImproveAlertRules",
    description: "Enable AI-improve alert rules labels and annotations.",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "alertingBacktesting",
    description: "Rule backtesting API for alerting",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "alertingBulkActionsInUI",
    description: "Enables the alerting bulk actions in the UI",
    stage: "GA",
    owner: "@grafana/alerting-squad",
    expression: "true",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "alertingCentralAlertHistory",
    description: "Enables the new central alert history.",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "alertingDisableDMAinUI",
    description: "Disables the DMA feature in the UI",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "alertingDisableSendAlertsExternal",
    description: "Disables the ability to send alerts to an external Alertmanager datasource.",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "alertingEnrichmentAssistantInvestigations",
    description: "Enable Assistant Investigations enrichment type.",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "alertingEnrichmentPerRule",
    description: "Enable enrichment per rule in the alerting UI.",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "alertingFilterV2",
    description: "Enable the new alerting search experience",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "alertingImportAlertmanagerAPI",
    description: "Enables the API to import Alertmanager configuration",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "alertingImportAlertmanagerUI",
    description: "Enables the UI to see imported Alertmanager configuration",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "alertingImportYAMLUI",
    description: "Enables a UI feature for importing rules from a Prometheus file to Grafana-managed rules",
    stage: "GA",
    owner: "@grafana/alerting-squad",
    expression: "true",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "alertingJiraIntegration",
    description: "Enables the new Jira integration for contact points in cloud alert managers.",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "alertingListViewV2",
    description: "Enables the new alert list view design",
    stage: "privatePreview",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "alertingListViewV2PreviewToggle",
    description: "Enables the alerting list view v2 preview toggle",
    stage: "privatePreview",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "alertingMigrationUI",
    description: "Enables the alerting migration UI, to migrate data source-managed rules to Grafana-managed rules",
    stage: "GA",
    owner: "@grafana/alerting-squad",
    expression: "true",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "alertingNavigationV2",
    description: "Enables the new Alerting navigation structure with improved menu grouping",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "alertingNotificationHistory",
    description: "Enables the notification history feature",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "alertingNotificationsStepMode",
    description: "Enables simplified step mode in the notifications section",
    stage: "GA",
    owner: "@grafana/alerting-squad",
    expression: "true",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "alertingPrometheusRulesPrimary",
    description: "Uses Prometheus rules as the primary source of truth for ruler-enabled data sources",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "alertingProvenanceLockWrites",
    description: "Enables a feature to avoid issues with concurrent writes to the alerting provenance table in MySQL",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "alertingQueryAndExpressionsStepMode",
    description: "Enables step mode for alerting queries and expressions",
    stage: "GA",
    owner: "@grafana/alerting-squad",
    expression: "true",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "alertingQueryOptimization",
    description: "Optimizes eligible queries in order to reduce load on datasources",
    stage: "GA",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "alertingRulePermanentlyDelete",
    description: "Enables UI functionality to permanently delete alert rules",
    stage: "GA",
    owner: "@grafana/alerting-squad",
    expression: "true",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "alertingRuleRecoverDeleted",
    description: "Enables the UI functionality to recover and view deleted alert rules",
    stage: "GA",
    owner: "@grafana/alerting-squad",
    expression: "true",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "alertingRuleVersionHistoryRestore",
    description: "Enables the alert rule version history restore feature",
    stage: "GA",
    owner: "@grafana/alerting-squad",
    expression: "true",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "alertingSaveStateCompressed",
    description: "Enables the compressed protobuf-based alert state storage. Default is enabled.",
    stage: "publicPreview",
    owner: "@grafana/alerting-squad",
    expression: "true",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "alertingSaveStatePeriodic",
    description: "Writes the state periodically to the database, asynchronous to rule evaluation",
    stage: "privatePreview",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "alertingSavedSearches",
    description: "Enables saved searches for alert rules list",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "alertingSyncDispatchTimer",
    description: "Use synchronized dispatch timer to minimize duplicate notifications across alertmanager HA pods",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "alertingTriage",
    description: "Enables the alerting triage feature",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "alertingUIOptimizeReducer",
    description: "Enables removing the reducer from the alerting UI when creating a new alert rule and using instant query",
    stage: "GA",
    owner: "@grafana/alerting-squad",
    expression: "true",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "alertingUIUseBackendFilters",
    description: "Enables the UI to use certain backend-side filters",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "alertingUIUseFullyCompatBackendFilters",
    description: "Enables the UI to use rules backend-side filters 100% compatible with the frontend filters",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "alertingUseNewSimplifiedRoutingHashAlgorithm",
    description: "",
    stage: "publicPreview",
    owner: "@grafana/alerting-squad",
    expression: "true",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "alertmanagerRemotePrimary",
    description: "Enable Grafana to have a remote Alertmanager instance as the primary Alertmanager.",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "alertmanagerRemoteSecondary",
    description: "Enable Grafana to sync configuration and state with a remote Alertmanager.",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "alertmanagerRemoteSecondaryWithRemoteState",
    description: "Starts Grafana in remote secondary mode pulling the latest state from the remote Alertmanager to avoid duplicate notifications.",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "annotationPermissionUpdate",
    description: "Change the way annotation permissions work by scoping them to folders and dashboards.",
    stage: "GA",
    owner: "@grafana/identity-access-team",
    expression: "true",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "appPlatformGrpcClientAuth",
    description: "Enables the gRPC client to authenticate with the App Platform by using ID & access tokens",
    stage: "experimental",
    owner: "@grafana/identity-access-team",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "assetSriChecks",
    description: "Enables SRI checks for Grafana JavaScript assets",
    stage: "experimental",
    owner: "@grafana/frontend-ops",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "auditLoggingAppPlatform",
    description: "Enable audit logging with Kubernetes under app platform",
    stage: "experimental",
    owner: "@grafana/grafana-operator-experience-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "authZGRPCServer",
    description: "Enables the gRPC server for authorization",
    stage: "experimental",
    owner: "@grafana/identity-access-team",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "awsAsyncQueryCaching",
    description: "Enable caching for async queries for Redshift and Athena. Requires that the datasource has caching and async query support enabled",
    stage: "GA",
    owner: "@grafana/aws-datasources",
    expression: "true",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "awsDatasourcesHttpProxy",
    description: "Enables http proxy settings for aws datasources",
    stage: "experimental",
    owner: "@grafana/aws-datasources",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "awsDatasourcesTempCredentials",
    description: "Support temporary security credentials in AWS plugins for Grafana Cloud customers",
    stage: "GA",
    owner: "@grafana/aws-datasources",
    expression: "true",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "azureMonitorDisableLogLimit",
    description: "Disables the log limit restriction for Azure Monitor when true. The limit is enabled by default.",
    stage: "GA",
    owner: "@grafana/partner-datasources",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "azureMonitorEnableUserAuth",
    description: "Enables user auth for Azure Monitor datasource only",
    stage: "GA",
    owner: "@grafana/partner-datasources",
    expression: "true",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "azureMonitorLogsBuilderEditor",
    description: "Enables the logs builder mode for the Azure Monitor data source",
    stage: "publicPreview",
    owner: "@grafana/partner-datasources",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "azureMonitorPrometheusExemplars",
    description: "Allows configuration of Azure Monitor as a data source that can provide Prometheus exemplars",
    stage: "GA",
    owner: "@grafana/partner-datasources",
    expression: "true",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "azureResourcePickerUpdates",
    description: "Enables the updated Azure Monitor resource picker",
    stage: "GA",
    owner: "@grafana/partner-datasources",
    expression: "true",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "cachingOptimizeSerializationMemoryUsage",
    description: "If enabled, the caching backend gradually serializes query responses for the cache, comparing against the configured `[caching]max_value_mb` value as it goes. This can can help prevent Grafana from running out of memory while attempting to cache very large query responses.",
    stage: "experimental",
    owner: "@grafana/grafana-operator-experience-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "canvasPanelNesting",
    description: "Allow elements nesting",
    stage: "experimental",
    owner: "@grafana/dataviz-squad",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "canvasPanelPanZoom",
    description: "Allow pan and zoom in canvas panel",
    stage: "publicPreview",
    owner: "@grafana/dataviz-squad",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "cdnPluginsLoadFirst",
    description: "Prioritize loading plugins from the CDN before other sources",
    stage: "experimental",
    owner: "@grafana/plugins-platform-backend",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "cdnPluginsUrls",
    description: "Enable loading plugins via declarative URLs",
    stage: "experimental",
    owner: "@grafana/plugins-platform-backend",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "cloudRBACRoles",
    description: "Enabled grafana cloud specific RBAC roles",
    stage: "publicPreview",
    owner: "@grafana/identity-access-team",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "cloudWatchBatchQueries",
    description: "Runs CloudWatch metrics queries as separate batches",
    stage: "publicPreview",
    owner: "@grafana/aws-datasources",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "cloudWatchCrossAccountQuerying",
    description: "Enables cross-account querying in CloudWatch datasources",
    stage: "GA",
    owner: "@grafana/aws-datasources",
    expression: "true",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "cloudWatchNewLabelParsing",
    description: "Updates CloudWatch label parsing to be more accurate",
    stage: "GA",
    owner: "@grafana/aws-datasources",
    expression: "true",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "cloudWatchRoundUpEndTime",
    description: "Round up end time for metric queries to the next minute to avoid missing data",
    stage: "GA",
    owner: "@grafana/aws-datasources",
    expression: "true",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "configurableSchedulerTick",
    description: "Enable changing the scheduler base interval via configuration option unified_alerting.scheduler_tick_interval",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "crashDetection",
    description: "Enables browser crash detection reporting to Faro.",
    stage: "experimental",
    owner: "@grafana/observability-traces-and-profiling",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "dashboardAdHocAndGroupByWrapper",
    description: "Wraps the ad hoc and group by variables in a single wrapper, with all other variables below it",
    stage: "experimental",
    owner: "@grafana/dashboards-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "dashboardDisableSchemaValidationV1",
    description: "Disable schema validation for dashboards/v1",
    stage: "experimental",
    owner: "@grafana/grafana-app-platform-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "dashboardDisableSchemaValidationV2",
    description: "Disable schema validation for dashboards/v2",
    stage: "experimental",
    owner: "@grafana/grafana-app-platform-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "dashboardLevelTimeMacros",
    description: "Supports __from and __to macros that always use the dashboard level time range",
    stage: "experimental",
    owner: "@grafana/dashboards-squad",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "dashboardLibrary",
    description: "Displays datasource provisioned dashboards in dashboard empty page, only when coming from datasource configuration page",
    stage: "experimental",
    owner: "@grafana/sharing-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "dashboardNewLayouts",
    description: "Enables new dashboard layouts",
    stage: "publicPreview",
    owner: "@grafana/dashboards-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "dashboardScene",
    description: "Enables dashboard rendering using scenes for all roles",
    stage: "GA",
    owner: "@grafana/dashboards-squad",
    expression: "true",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "dashboardSceneForViewers",
    description: "Enables dashboard rendering using Scenes for viewer roles",
    stage: "GA",
    owner: "@grafana/dashboards-squad",
    expression: "true",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "dashboardSceneSolo",
    description: "Enables rendering dashboards using scenes for solo panels",
    stage: "GA",
    owner: "@grafana/dashboards-squad",
    expression: "true",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "dashboardSchemaValidationLogging",
    description: "Log schema validation errors so they can be analyzed later",
    stage: "experimental",
    owner: "@grafana/grafana-app-platform-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "dashboardTemplates",
    description: "Enables a flow to get started with a new dashboard from a template",
    stage: "publicPreview",
    owner: "@grafana/sharing-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "dashboardUndoRedo",
    description: "Enables undo/redo in dynamic dashboards",
    stage: "experimental",
    owner: "@grafana/dashboards-squad",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "dashboardValidatorApp",
    description: "Enables dashboard validator app to run compatibility checks between a dashboard and data source",
    stage: "experimental",
    owner: "@grafana/sharing-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "dashgpt",
    description: "Enable AI powered features in dashboards",
    stage: "GA",
    owner: "@grafana/dashboards-squad",
    expression: "true",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "dataplaneAggregator",
    description: "Enable grafana dataplane aggregator",
    stage: "experimental",
    owner: "@grafana/grafana-app-platform-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "datasourceAPIServers",
    description: "Expose some datasources as apiservers.",
    stage: "experimental",
    owner: "@grafana/grafana-app-platform-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "datasourceConnectionsTab",
    description: "Shows defined connections for a data source in the plugins detail page",
    stage: "privatePreview",
    owner: "@grafana/plugins-platform-backend",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "datasourceQueryTypes",
    description: "Show query type endpoints in datasource API servers (currently hardcoded for testdata, expressions, and prometheus)",
    stage: "experimental",
    owner: "@grafana/grafana-app-platform-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "disableEnvelopeEncryption",
    description: "Disable envelope encryption (emergency only)",
    stage: "GA",
    owner: "@grafana/grafana-operator-experience-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "disableNumericMetricsSortingInExpressions",
    description: "In server-side expressions, disable the sorting of numeric-kind metrics by their metric name or labels.",
    stage: "experimental",
    owner: "@grafana/oss-big-tent",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "disableSSEDataplane",
    description: "Disables dataplane specific processing in server side expressions.",
    stage: "experimental",
    owner: "@grafana/grafana-datasources-core-services",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "drilldownRecommendations",
    description: "Enables showing recently used drilldowns or recommendations given by the datasource in the AdHocFilters and GroupBy variables",
    stage: "experimental",
    owner: "@grafana/dashboards-squad",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "elasticsearchCrossClusterSearch",
    description: "Enables cross cluster search in the Elasticsearch data source",
    stage: "GA",
    owner: "@grafana/partner-datasources",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "elasticsearchImprovedParsing",
    description: "Enables less memory intensive Elasticsearch result parsing",
    stage: "experimental",
    owner: "@grafana/partner-datasources",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "elasticsearchRawDSLQuery",
    description: "Enables the raw DSL query editor in the Elasticsearch data source",
    stage: "experimental",
    owner: "@grafana/partner-datasources",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "enableAppChromeExtensions",
    description: "Set this to true to enable all app chrome extensions registered by plugins.",
    stage: "experimental",
    owner: "@grafana/plugins-platform-backend",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "enableDashboardEmptyExtensions",
    description: "Set this to true to enable all dashboard empty state extensions registered by plugins.",
    stage: "experimental",
    owner: "@grafana/dashboards-squad",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "enableDatagridEditing",
    description: "Enables the edit functionality in the datagrid panel",
    stage: "publicPreview",
    owner: "@grafana/dataviz-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "enableExtensionsAdminPage",
    description: "Enables the extension admin page regardless of development mode",
    stage: "experimental",
    owner: "@grafana/plugins-platform-backend",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "enableSCIM",
    description: "Enables SCIM support for user and group management",
    stage: "GA",
    owner: "@grafana/identity-access-team",
    expression: "true",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "enableScopesInMetricsExplore",
    description: "Enables the scopes usage in Metrics Explore",
    stage: "experimental",
    owner: "@grafana/dashboards-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "experimentRecentlyViewedDashboards",
    description: "A/A test for recently viewed dashboards feature",
    stage: "experimental",
    owner: "@grafana/grafana-search-navigate-organise",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "exploreLogsAggregatedMetrics",
    description: "Used in Logs Drilldown to query by aggregated metrics",
    stage: "experimental",
    owner: "@grafana/observability-logs",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "exploreLogsShardSplitting",
    description: "Deprecated. Replace with lokiShardSplitting. Used in Logs Drilldown to split queries into multiple queries based on the number of shards",
    stage: "experimental",
    owner: "@grafana/observability-logs",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "externalServiceAccounts",
    description: "Automatic service account and token setup for plugins",
    stage: "publicPreview",
    owner: "@grafana/identity-access-team",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "externalVizSuggestions",
    description: "Enable all plugins to supply visualization suggestions (including 3rd party plugins)",
    stage: "experimental",
    owner: "@grafana/dataviz-squad",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "faroDatasourceSelector",
    description: "Enable the data source selector within the Frontend Apps section of the Frontend Observability",
    stage: "publicPreview",
    owner: "@grafana/app-o11y",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "favoriteDatasources",
    description: "Enable favorite datasources",
    stage: "experimental",
    owner: "@grafana/plugins-platform-backend",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "featureHighlights",
    description: "Highlight Grafana Enterprise features",
    stage: "GA",
    owner: "@grafana/grafana-operator-experience-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "fetchRulesInCompactMode",
    description: "Add compact=true when fetching rules",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "fetchRulesUsingPost",
    description: "Use a POST request to list rules by passing down the namespaces user has access to",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "foldersAppPlatformAPI",
    description: "Enables use of app platform API for folders",
    stage: "experimental",
    owner: "@grafana/grafana-search-navigate-organise",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "grafanaAPIServerEnsureKubectlAccess",
    description: "Start an additional https handler and write kubectl options",
    stage: "experimental",
    owner: "@grafana/grafana-app-platform-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: true,
    hideFromDocs: false,
  },
  {
    name: "grafanaAPIServerWithExperimentalAPIs",
    description: "Register experimental APIs with the k8s API server, including all datasources",
    stage: "experimental",
    owner: "@grafana/grafana-app-platform-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: true,
    hideFromDocs: false,
  },
  {
    name: "grafanaAdvisor",
    description: "Enables Advisor app",
    stage: "privatePreview",
    owner: "@grafana/plugins-platform-backend",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "grafanaAssistantInProfilesDrilldown",
    description: "Enables integration with Grafana Assistant in Profiles Drilldown",
    stage: "GA",
    owner: "@grafana/observability-traces-and-profiling",
    expression: "true",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "grafanaManagedRecordingRules",
    description: "Enables Grafana-managed recording rules.",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "grafanaconThemes",
    description: "Enables the temporary themes for GrafanaCon",
    stage: "GA",
    owner: "@grafana/grafana-frontend-platform",
    expression: "true",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "graphiteBackendMode",
    description: "Enables the Graphite data source full backend mode",
    stage: "privatePreview",
    owner: "@grafana/partner-datasources",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "groupAttributeSync",
    description: "Enable the groupsync extension for managing Group Attribute Sync feature",
    stage: "privatePreview",
    owner: "@grafana/identity-access-team",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "groupByVariable",
    description: "Enable groupBy variable support in scenes dashboards",
    stage: "experimental",
    owner: "@grafana/dashboards-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "grpcServer",
    description: "Run the GRPC server",
    stage: "publicPreview",
    owner: "@grafana/search-and-storage",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "heatmapRowsAxisOptions",
    description: "Enable Y-axis scale configuration options for pre-bucketed heatmap data (heatmap-rows)",
    stage: "experimental",
    owner: "@grafana/dataviz-squad",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "improvedExternalSessionHandling",
    description: "Enables improved support for OAuth external sessions. After enabling this feature, users might need to re-authenticate themselves.",
    stage: "GA",
    owner: "@grafana/identity-access-team",
    expression: "true",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "improvedExternalSessionHandlingSAML",
    description: "Enables improved support for SAML external sessions. Ensure the NameID format is correctly configured in Grafana for SAML Single Logout to function properly.",
    stage: "GA",
    owner: "@grafana/identity-access-team",
    expression: "true",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "infinityRunQueriesInParallel",
    description: "Enables running Infinity queries in parallel",
    stage: "privatePreview",
    owner: "@grafana/oss-big-tent",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "influxdbBackendMigration",
    description: "Query InfluxDB InfluxQL without the proxy",
    stage: "GA",
    owner: "@grafana/partner-datasources",
    expression: "true",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "influxdbRunQueriesInParallel",
    description: "Enables running InfluxDB Influxql queries in parallel",
    stage: "privatePreview",
    owner: "@grafana/partner-datasources",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "influxqlStreamingParser",
    description: "Enable streaming JSON parser for InfluxDB datasource InfluxQL query language",
    stage: "experimental",
    owner: "@grafana/partner-datasources",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "interactiveLearning",
    description: "Enables the interactive learning app",
    stage: "publicPreview",
    owner: "@grafana/pathfinder",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "jaegerEnableGrpcEndpoint",
    description: "Enable querying trace data through Jaeger's gRPC endpoint (HTTP)",
    stage: "experimental",
    owner: "@grafana/oss-big-tent",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "jitterAlertRulesWithinGroups",
    description: "Distributes alert rule evaluations more evenly over time, including spreading out rules within the same group. Disables sequential evaluation if enabled.",
    stage: "publicPreview",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "k8SFolderCounts",
    description: "Enable folder's api server counts",
    stage: "experimental",
    owner: "@grafana/search-and-storage",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "kubernetesAggregator",
    description: "Enable grafana's embedded kube-aggregator",
    stage: "experimental",
    owner: "@grafana/grafana-app-platform-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "kubernetesAggregatorCapTokenAuth",
    description: "Enable CAP token based authentication in grafana's embedded kube-aggregator",
    stage: "experimental",
    owner: "@grafana/grafana-app-platform-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "kubernetesAlertingHistorian",
    description: "Adds support for Kubernetes alerting historian APIs",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "kubernetesAlertingRules",
    description: "Adds support for Kubernetes alerting and recording rules",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "kubernetesAnnotations",
    description: "Enables app platform API for annotations",
    stage: "experimental",
    owner: "@grafana/grafana-backend-services-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "kubernetesAuthZHandlerRedirect",
    description: "Redirects the traffic from the legacy access control endpoints to the new K8s AuthZ endpoints",
    stage: "experimental",
    owner: "@grafana/identity-access-team",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "kubernetesAuthnMutation",
    description: "Enables create, delete, and update mutations for resources owned by IAM identity",
    stage: "experimental",
    owner: "@grafana/identity-access-team",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "kubernetesAuthzApis",
    description: "Deprecated: Use kubernetesAuthzCoreRolesApi, kubernetesAuthzRolesApi, and kubernetesAuthzRoleBindingsApi instead",
    stage: "deprecated",
    owner: "@grafana/identity-access-team",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "kubernetesAuthzCoreRolesApi",
    description: "Registers AuthZ Core Roles /apis endpoint",
    stage: "experimental",
    owner: "@grafana/identity-access-team",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "kubernetesAuthzGlobalRolesApi",
    description: "Registers AuthZ Global Roles /apis endpoint",
    stage: "experimental",
    owner: "@grafana/identity-access-team",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "kubernetesAuthzResourcePermissionApis",
    description: "Registers AuthZ resource permission /apis endpoints",
    stage: "experimental",
    owner: "@grafana/identity-access-team",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "kubernetesAuthzRoleBindingsApi",
    description: "Registers AuthZ Role Bindings /apis endpoint",
    stage: "experimental",
    owner: "@grafana/identity-access-team",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "kubernetesAuthzRolesApi",
    description: "Registers AuthZ Roles /apis endpoint",
    stage: "experimental",
    owner: "@grafana/identity-access-team",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "kubernetesAuthzTeamLBACRuleApi",
    description: "Registers AuthZ TeamLBACRule /apis endpoint",
    stage: "experimental",
    owner: "@grafana/identity-access-team",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "kubernetesAuthzZanzanaSync",
    description: "Enable sync of Zanzana authorization store on AuthZ CRD mutations",
    stage: "experimental",
    owner: "@grafana/identity-access-team",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "kubernetesCorrelations",
    description: "Adds support for Kubernetes correlations",
    stage: "experimental",
    owner: "@grafana/datapro",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "kubernetesDashboards",
    description: "Use the kubernetes API in the frontend for dashboards",
    stage: "GA",
    owner: "@grafana/dashboards-squad",
    expression: "true",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "kubernetesExternalGroupMapping",
    description: "Routes external group mapping requests from /api to the /apis endpoint",
    stage: "experimental",
    owner: "@grafana/identity-access-team",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "kubernetesLibraryPanels",
    description: "Routes library panel requests from /api to the /apis endpoint",
    stage: "experimental",
    owner: "@grafana/grafana-app-platform-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "kubernetesLogsDrilldown",
    description: "Adds support for Kubernetes logs drilldown",
    stage: "experimental",
    owner: "@grafana/observability-logs",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "kubernetesQueryCaching",
    description: "Adds support for Kubernetes querycaching",
    stage: "experimental",
    owner: "@grafana/grafana-operator-experience-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "kubernetesShortURLs",
    description: "Enables k8s short url api and uses it under the hood when handling legacy /api",
    stage: "experimental",
    owner: "@grafana/grafana-app-platform-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "kubernetesSnapshots",
    description: "Routes snapshot requests from /api to the /apis endpoint",
    stage: "experimental",
    owner: "@grafana/grafana-app-platform-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "kubernetesStars",
    description: "Routes stars requests from /api to the /apis endpoint",
    stage: "experimental",
    owner: "@grafana/grafana-app-platform-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "kubernetesTeamBindings",
    description: "Enables search for team bindings in the app platform API",
    stage: "experimental",
    owner: "@grafana/identity-access-team",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "kubernetesUnifiedStorageQuotas",
    description: "Adds support for Kubernetes unified storage quotas",
    stage: "experimental",
    owner: "@grafana/search-and-storage",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "liveAPIServer",
    description: "Registers a live apiserver",
    stage: "experimental",
    owner: "@grafana/grafana-app-platform-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: true,
    hideFromDocs: true,
  },
  {
    name: "localeFormatPreference",
    description: "Specifies the locale so the correct format for numbers and dates can be shown",
    stage: "deprecated",
    owner: "@grafana/grafana-frontend-platform",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "logQLScope",
    description: "In-development feature that will allow injection of labels into loki queries.",
    stage: "privatePreview",
    owner: "@grafana/oss-big-tent",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "logsContextDatasourceUi",
    description: "Allow datasource to provide custom UI for context view",
    stage: "GA",
    owner: "@grafana/observability-logs",
    expression: "true",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "logsExploreTableVisualisation",
    description: "A table visualisation for logs in Explore",
    stage: "GA",
    owner: "@grafana/observability-logs",
    expression: "true",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "logsPanelControls",
    description: "Enables a control component for the logs panel in Explore",
    stage: "publicPreview",
    owner: "@grafana/observability-logs",
    expression: "true",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "lokiExperimentalStreaming",
    description: "Support new streaming approach for loki (prototype, needs special loki build)",
    stage: "experimental",
    owner: "@grafana/oss-big-tent",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "lokiLabelNamesQueryApi",
    description: "Defaults to using the Loki `/labels` API instead of `/series`",
    stage: "GA",
    owner: "@grafana/oss-big-tent",
    expression: "true",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "lokiLogsDataplane",
    description: "Changes logs responses from Loki to be compliant with the dataplane specification.",
    stage: "experimental",
    owner: "@grafana/oss-big-tent",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "lokiQueryLimitsContext",
    description: "Send X-Loki-Query-Limits-Context header to Loki on first split request",
    stage: "experimental",
    owner: "@grafana/observability-logs",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "lokiQuerySplitting",
    description: "Split large interval queries into subqueries with smaller time intervals",
    stage: "GA",
    owner: "@grafana/observability-logs",
    expression: "true",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "lokiRunQueriesInParallel",
    description: "Enables running Loki queries in parallel",
    stage: "privatePreview",
    owner: "@grafana/oss-big-tent",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "lokiShardSplitting",
    description: "Use stream shards to split queries into smaller subqueries",
    stage: "experimental",
    owner: "@grafana/observability-logs",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "managedDualWriter",
    description: "Pick the dual write mode from database configs",
    stage: "experimental",
    owner: "@grafana/search-and-storage",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "metricsFromProfiles",
    description: "Enables creating metrics from profiles and storing them as recording rules",
    stage: "experimental",
    owner: "@grafana/observability-traces-and-profiling",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "mlExpressions",
    description: "Enable support for Machine Learning in server-side expressions",
    stage: "experimental",
    owner: "@grafana/alerting-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "multiPropsVariables",
    description: "Enables support for variables whose values can have multiple properties",
    stage: "experimental",
    owner: "@grafana/dashboards-squad",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "multiTenantTempCredentials",
    description: "use multi-tenant path for awsTempCredentials",
    stage: "experimental",
    owner: "@grafana/aws-datasources",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "newClickhouseConfigPageDesign",
    description: "Enables new design for the Clickhouse data source configuration page",
    stage: "privatePreview",
    owner: "@grafana/partner-datasources",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "newDashboardWithFiltersAndGroupBy",
    description: "Enables filters and group by variables on all new dashboards. Variables are added only if default data source supports filtering.",
    stage: "experimental",
    owner: "@grafana/dashboards-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "newFiltersUI",
    description: "Enables new combobox style UI for the Ad hoc filters variable in scenes architecture",
    stage: "GA",
    owner: "@grafana/dashboards-squad",
    expression: "true",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "newGauge",
    description: "Enable new gauge visualization",
    stage: "publicPreview",
    owner: "@grafana/dataviz-squad",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "newInfluxDSConfigPageDesign",
    description: "Enables new design for the InfluxDB data source configuration page",
    stage: "privatePreview",
    owner: "@grafana/partner-datasources",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "newLogContext",
    description: "New Log Context component",
    stage: "experimental",
    owner: "@grafana/observability-logs",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "newLogsPanel",
    description: "Enables the new logs panel",
    stage: "GA",
    owner: "@grafana/observability-logs",
    expression: "true",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "newPanelPadding",
    description: "Increases panel padding globally",
    stage: "publicPreview",
    owner: "@grafana/dashboards-squad",
    expression: "true",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "newShareReportDrawer",
    description: "Enables the report creation drawer in a dashboard",
    stage: "publicPreview",
    owner: "@grafana/grafana-operator-experience-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "newTimeRangeZoomShortcuts",
    description: "Enables new keyboard shortcuts for time range zoom operations",
    stage: "experimental",
    owner: "@grafana/dataviz-squad",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "newVizSuggestions",
    description: "Enable new visualization suggestions",
    stage: "publicPreview",
    owner: "@grafana/dataviz-squad",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "oauthRequireSubClaim",
    description: "Require that sub claims is present in oauth tokens.",
    stage: "experimental",
    owner: "@grafana/identity-access-team",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "onlyStoreActionSets",
    description: "When storing dashboard and folder resource permissions, only store action sets and not the full list of underlying permission",
    stage: "GA",
    owner: "@grafana/identity-access-team",
    expression: "true",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "opentsdbBackendMigration",
    description: "Run queries through the data source backend",
    stage: "GA",
    owner: "@grafana/oss-big-tent",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "otelLogsFormatting",
    description: "Applies OTel formatting templates to displayed logs",
    stage: "experimental",
    owner: "@grafana/observability-logs",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "panelFilterVariable",
    description: "Enables use of the `systemPanelFilterVar` variable to filter panels in a dashboard",
    stage: "experimental",
    owner: "@grafana/dashboards-squad",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "panelGroupBy",
    description: "Enables a group by action per panel",
    stage: "experimental",
    owner: "@grafana/dashboards-squad",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "panelTimeSettings",
    description: "Enables a new panel time settings drawer",
    stage: "experimental",
    owner: "@grafana/dashboards-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "panelTitleSearch",
    description: "Search for dashboards using panel title",
    stage: "publicPreview",
    owner: "@grafana/search-and-storage",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "passwordlessMagicLinkAuthentication",
    description: "Enable passwordless login via magic link authentication",
    stage: "experimental",
    owner: "@grafana/identity-access-team",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "pdfTables",
    description: "Enables generating table data as PDF in reporting",
    stage: "publicPreview",
    owner: "@grafana/grafana-operator-experience-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "perPanelFiltering",
    description: "Enables filtering by grouping labels on the panel level through legend or tooltip",
    stage: "experimental",
    owner: "@grafana/dashboards-squad",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "perPanelNonApplicableDrilldowns",
    description: "Enables viewing non-applicable drilldowns on a panel level",
    stage: "experimental",
    owner: "@grafana/dashboards-squad",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "playlistsReconciler",
    description: "Enables experimental reconciler for playlists",
    stage: "experimental",
    owner: "@grafana/grafana-app-platform-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "pluginContainers",
    description: "Enables running plugins in containers",
    stage: "privatePreview",
    owner: "@grafana/plugins-platform-backend",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "pluginInsights",
    description: "Show insights for plugins in the plugin details page",
    stage: "experimental",
    owner: "@grafana/plugins-platform-backend",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "pluginInstallAPISync",
    description: "Enable syncing plugin installations to the installs API",
    stage: "experimental",
    owner: "@grafana/plugins-platform-backend",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "pluginProxyPreserveTrailingSlash",
    description: "Preserve plugin proxy trailing slash.",
    stage: "GA",
    owner: "@grafana/plugins-platform-backend",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "pluginStoreServiceLoading",
    description: "Load plugins on store service startup instead of wire provider, and call RegisterFixedRoles after all plugins are loaded",
    stage: "experimental",
    owner: "@grafana/plugins-platform-backend",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "pluginsAutoUpdate",
    description: "Enables auto-updating of users installed plugins",
    stage: "experimental",
    owner: "@grafana/plugins-platform-backend",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "pluginsSriChecks",
    description: "Enables SRI checks for plugin assets",
    stage: "GA",
    owner: "@grafana/plugins-platform-backend",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "preferLibraryPanelTitle",
    description: "Prefer library panel title over viz panel title.",
    stage: "privatePreview",
    owner: "@grafana/dashboards-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "preserveDashboardStateWhenNavigating",
    description: "Enables possibility to preserve dashboard variables and time range when navigating between dashboards",
    stage: "experimental",
    owner: "@grafana/dashboards-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "preventPanelChromeOverflow",
    description: "Restrict PanelChrome contents with overflow: hidden;",
    stage: "publicPreview",
    owner: "@grafana/grafana-frontend-platform",
    expression: "true",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "profilesExemplars",
    description: "Enables profiles exemplars support in profiles drilldown",
    stage: "experimental",
    owner: "@grafana/observability-traces-and-profiling",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "prometheusAzureOverrideAudience",
    description: "Deprecated. Allow override default AAD audience for Azure Prometheus endpoint. Enabled by default. This feature should no longer be used and will be removed in the future.",
    stage: "deprecated",
    owner: "@grafana/partner-datasources",
    expression: "true",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "prometheusSpecialCharsInLabelValues",
    description: "Adds support for quotes and special characters in label values for Prometheus queries",
    stage: "experimental",
    owner: "@grafana/oss-big-tent",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "prometheusTypeMigration",
    description: "Checks for deprecated Prometheus authentication methods (SigV4 and Azure), installs the relevant data source, and migrates the Prometheus data sources",
    stage: "experimental",
    owner: "@grafana/partner-datasources",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "provisioning",
    description: "Next generation provisioning... and git",
    stage: "experimental",
    owner: "@grafana/grafana-app-platform-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "publicDashboardsEmailSharing",
    description: "Enables public dashboard sharing to be restricted to only allowed emails",
    stage: "publicPreview",
    owner: "@grafana/grafana-operator-experience-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "publicDashboardsScene",
    description: "Enables public dashboard rendering using scenes",
    stage: "GA",
    owner: "@grafana/grafana-operator-experience-squad",
    expression: "true",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "queryCacheRequestDeduplication",
    description: "Enable request deduplication when query caching is enabled. Requests issuing the same query will be deduplicated, only the first request to arrive will be executed and the response will be shared with requests arriving while there is a request in-flight",
    stage: "experimental",
    owner: "@grafana/grafana-operator-experience-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "queryEditorNext",
    description: "Enables next generation query editor experience",
    stage: "experimental",
    owner: "@grafana/datapro",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "queryLibrary",
    description: "Enables Saved queries (query library) feature",
    stage: "publicPreview",
    owner: "@grafana/sharing-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "queryService",
    description: "Register /apis/query.grafana.app/ -- will eventually replace /api/ds/query",
    stage: "experimental",
    owner: "@grafana/grafana-datasources-core-services",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "queryServiceFromUI",
    description: "Routes requests to the new query service",
    stage: "experimental",
    owner: "@grafana/grafana-datasources-core-services",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "queryServiceRewrite",
    description: "Rewrite requests targeting /ds/query to the query service",
    stage: "experimental",
    owner: "@grafana/grafana-datasources-core-services",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "queryServiceWithConnections",
    description: "Adds datasource connections to the query service",
    stage: "experimental",
    owner: "@grafana/grafana-datasources-core-services",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "queryWithAssistant",
    description: "Enables the Query with Assistant button in the query editor",
    stage: "experimental",
    owner: "@grafana/oss-big-tent",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "recentlyViewedDashboards",
    description: "Enables recently viewed dashboards section in the browsing dashboard page",
    stage: "experimental",
    owner: "@grafana/grafana-search-navigate-organise",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "refactorVariablesTimeRange",
    description: "Refactor time range variables flow to reduce number of API calls made when query variables are chained",
    stage: "publicPreview",
    owner: "@grafana/dashboards-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "refreshTokenRequired",
    description: "Require that refresh tokens are present in oauth tokens.",
    stage: "experimental",
    owner: "@grafana/identity-access-team",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "reloadDashboardsOnParamsChange",
    description: "Enables reload of dashboards on scopes, time range and variables changes",
    stage: "experimental",
    owner: "@grafana/dashboards-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "renderAuthJWT",
    description: "Uses JWT-based auth for rendering instead of relying on remote cache",
    stage: "publicPreview",
    owner: "@grafana/grafana-operator-experience-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "rendererDisableAppPluginsPreload",
    description: "Disable pre-loading app plugins when the request is coming from the renderer",
    stage: "experimental",
    owner: "@grafana/grafana-operator-experience-squad",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "reportingCsvEncodingOptions",
    description: "Enables CSV encoding options in the reporting feature",
    stage: "experimental",
    owner: "@grafana/grafana-operator-experience-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "reportingRetries",
    description: "Enables rendering retries for the reporting feature",
    stage: "publicPreview",
    owner: "@grafana/grafana-operator-experience-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "restoreDashboards",
    description: "Enables restore deleted dashboards feature",
    stage: "experimental",
    owner: "@grafana/grafana-search-navigate-organise",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "restrictedPluginApis",
    description: "Enables sharing a list of APIs with a list of plugins",
    stage: "experimental",
    owner: "@grafana/plugins-platform-backend",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "rolePickerDrawer",
    description: "Enables the new role picker drawer design",
    stage: "experimental",
    owner: "@grafana/identity-access-team",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "rudderstackUpgrade",
    description: "Enables the new version of rudderstack",
    stage: "experimental",
    owner: "@grafana/grafana-frontend-platform",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "savedQueriesRBAC",
    description: "Enables Saved queries (query library) RBAC permissions",
    stage: "publicPreview",
    owner: "@grafana/sharing-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "scanRowInvalidDashboardParseFallbackEnabled",
    description: "Enable fallback parsing behavior when scan row encounters invalid dashboard JSON",
    stage: "experimental",
    owner: "@grafana/search-and-storage",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "scopeApi",
    description: "In-development feature flag for the scope api using the app platform.",
    stage: "experimental",
    owner: "@grafana/grafana-app-platform-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "scopeFilters",
    description: "Enables the use of scope filters in Grafana",
    stage: "experimental",
    owner: "@grafana/dashboards-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "scopeSearchAllLevels",
    description: "Enable scope search to include all levels of the scope node tree",
    stage: "experimental",
    owner: "@grafana/grafana-operator-experience-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "secretsManagementAppPlatform",
    description: "Enable the secrets management API and services under app platform",
    stage: "experimental",
    owner: "@grafana/grafana-operator-experience-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "secretsManagementAppPlatformAwsKeeper",
    description: "Enables the creation of keepers that manage secrets stored on AWS secrets manager",
    stage: "experimental",
    owner: "@grafana/grafana-operator-experience-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "secretsManagementAppPlatformUI",
    description: "Enable the secrets management app platform UI",
    stage: "experimental",
    owner: "@grafana/grafana-operator-experience-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "sharingDashboardImage",
    description: "Enables image sharing functionality for dashboards",
    stage: "GA",
    owner: "@grafana/sharing-squad",
    expression: "true",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "showDashboardValidationWarnings",
    description: "Show warnings when dashboards do not validate against the schema",
    stage: "experimental",
    owner: "@grafana/dashboards-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "smoothingTransformation",
    description: "Enables the ASAP smoothing transformation for time series data",
    stage: "experimental",
    owner: "@grafana/datapro",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "sqlExpressions",
    description: "Enables SQL Expressions, which can execute SQL queries against data source results.",
    stage: "publicPreview",
    owner: "@grafana/grafana-datasources-core-services",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "sqlExpressionsColumnAutoComplete",
    description: "Enables column autocomplete for SQL Expressions",
    stage: "experimental",
    owner: "@grafana/datapro",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "sseGroupByDatasource",
    description: "Send query to the same datasource in a single request when using server side expressions. The `cloudWatchBatchQueries` feature toggle should be enabled if this used with CloudWatch.",
    stage: "experimental",
    owner: "@grafana/grafana-datasources-core-services",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "ssoSettingsLDAP",
    description: "Use the new SSO Settings API to configure LDAP",
    stage: "GA",
    owner: "@grafana/identity-access-team",
    expression: "true",
    frontendOnly: false,
    requiresRestart: true,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "starsFromAPIServer",
    description: "populate star status from apiserver",
    stage: "experimental",
    owner: "@grafana/grafana-search-navigate-organise",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "storage",
    description: "Configurable storage for dashboards, datasources, and resources",
    stage: "experimental",
    owner: "@grafana/search-and-storage",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "suggestedDashboards",
    description: "Displays datasource provisioned and community dashboards in dashboard empty page, only when coming from datasource configuration page",
    stage: "experimental",
    owner: "@grafana/sharing-squad",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "tableSharedCrosshair",
    description: "Enables shared crosshair in table panel",
    stage: "experimental",
    owner: "@grafana/dataviz-squad",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "tabularNumbers",
    description: "Use fixed-width numbers globally in the UI",
    stage: "GA",
    owner: "@grafana/grafana-frontend-platform",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "teamFolders",
    description: "Enables team folders functionality",
    stage: "experimental",
    owner: "@grafana/grafana-search-navigate-organise",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "teamHttpHeadersTempo",
    description: "Enables LBAC for datasources for Tempo to apply LBAC filtering of traces to the client requests for users in teams",
    stage: "experimental",
    owner: "@grafana/identity-access-team",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "tempoAlerting",
    description: "Enables creating alerts from Tempo data source",
    stage: "experimental",
    owner: "@grafana/observability-traces-and-profiling",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "timeComparison",
    description: "Enables time comparison option in supported panels",
    stage: "experimental",
    owner: "@grafana/dataviz-squad",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "timeRangePan",
    description: "Enables time range panning functionality",
    stage: "experimental",
    owner: "@grafana/dataviz-squad",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "timeRangeProvider",
    description: "Enables time pickers sync",
    stage: "experimental",
    owner: "@grafana/grafana-frontend-platform",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "transformationsEmptyPlaceholder",
    description: "Show transformation quick-start cards in empty transformations state",
    stage: "publicPreview",
    owner: "@grafana/datapro",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "ttlPluginInstanceManager",
    description: "Enable TTL plugin instance manager",
    stage: "experimental",
    owner: "@grafana/plugins-platform-backend",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "unifiedNavbars",
    description: "Enables unified navbars",
    stage: "GA",
    owner: "@grafana/plugins-platform-backend",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "unifiedStorageBigObjectsSupport",
    description: "Enables to save big objects in blob storage",
    stage: "experimental",
    owner: "@grafana/search-and-storage",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "unifiedStorageGrpcConnectionPool",
    description: "Enables the unified storage grpc connection pool",
    stage: "experimental",
    owner: "@grafana/search-and-storage",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "unifiedStorageSearchDualReaderEnabled",
    description: "Enable dual reader for unified storage search",
    stage: "experimental",
    owner: "@grafana/search-and-storage",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "unifiedStorageSearchUI",
    description: "Enable unified storage search UI",
    stage: "experimental",
    owner: "@grafana/search-and-storage",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "unlimitedLayoutsNesting",
    description: "Enables unlimited dashboard panel grouping",
    stage: "experimental",
    owner: "@grafana/dashboards-squad",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "useKubernetesShortURLsAPI",
    description: "Routes short url requests from /api to the /apis endpoint in the frontend. Depends on kubernetesShortURLs",
    stage: "experimental",
    owner: "@grafana/sharing-squad",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "useMTPlugins",
    description: "Enables plugins decoupling from bootdata",
    stage: "experimental",
    owner: "@grafana/plugins-platform-backend",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "useMultipleScopeNodesEndpoint",
    description: "Makes the frontend use the 'names' param for fetching multiple scope nodes at once",
    stage: "experimental",
    owner: "@grafana/grafana-operator-experience-squad",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "useScopeSingleNodeEndpoint",
    description: "Use the single node endpoint for the scope api. This is used to fetch the scope parent node.",
    stage: "experimental",
    owner: "@grafana/grafana-operator-experience-squad",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "useScopesNavigationEndpoint",
    description: "Use the scopes navigation endpoint instead of the dashboardbindings endpoint",
    stage: "experimental",
    owner: "@grafana/grafana-operator-experience-squad",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "useSessionStorageForRedirection",
    description: "Use session storage for handling the redirection after login",
    stage: "GA",
    owner: "@grafana/identity-access-team",
    expression: "true",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: false,
  },
  {
    name: "vizActionsAuth",
    description: "Allows authenticated API calls in actions",
    stage: "publicPreview",
    owner: "@grafana/dataviz-squad",
    expression: "false",
    frontendOnly: true,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "zanzana",
    description: "Use openFGA as authorization engine.",
    stage: "experimental",
    owner: "@grafana/identity-access-team",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
  {
    name: "zanzanaNoLegacyClient",
    description: "Use openFGA as main authorization engine and disable legacy RBAC clietn.",
    stage: "experimental",
    owner: "@grafana/identity-access-team",
    expression: "false",
    frontendOnly: false,
    requiresRestart: false,
    requiresDevMode: false,
    hideFromDocs: true,
  },
];
