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
  * Enable Faro session replay for Grafana
  * @default false
  */
  faroSessionReplay?: boolean;
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
  * Does not register datasource apis that use the numeric id
  * @default false
  */
  datasourceDisableIdApi?: boolean;
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
  * Use the new datasource API groups for datasource CRUD requests
  * @default false
  */
  useNewAPIsForDatasourceCRUD?: boolean;
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
  * Handle datasource CRUD requests to the legacy API routes by querying the new datasource api group endpoints behind the scenes.
  * @default false
  */
  datasourcesRerouteLegacyCRUDAPIs?: boolean;
  /**
  * Handle datasource resource requests to the legacy API routes by querying the new datasource api group endpoints behind the scenes.
  * @default false
  */
  datasourcesApiServerEnableResourceEndpoint?: boolean;
  /**
  * Send Datsource resource requests to K8s /apis/ API routes instead of the legacy /api/datasources/uid/{uid}/resources/{path} routes.
  * @default false
  */
  datasourcesApiServerEnableResourceEndpointFrontend?: boolean;
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
  * Enables the dashboard filters overview pane
  * @default false
  */
  dashboardFiltersOverview?: boolean;
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
  * Enable v2 dashboard layout support in reports (auto-grid, tabs, rows)
  * @default false
  */
  reportingV2Layouts?: boolean;
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
  * Enable the secrets management app platform UI
  * @default false
  */
  secretsManagementAppPlatformUI?: boolean;
  /**
  * Enable the Secrets Keeper management UI for configuring external secret storage
  * @default false
  */
  secretsKeeperUI?: boolean;
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
  * Enables the Assistant button in the dashboard templates card
  * @default false
  */
  dashboardTemplatesAssistantButton?: boolean;
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
  * Use the new k8s API for fetching integration type schemas
  * @default false
  */
  alertingSyncNotifiersApiMigration?: boolean;
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
  * @default true
  */
  timeRangePan?: boolean;
  /**
  * Enables new keyboard shortcuts for time range zoom operations
  * @default true
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
  * Use the Kubernetes TeamLBACRule API for team HTTP headers on datasource query requests
  * @default false
  */
  teamHttpHeadersFromAppPlatform?: boolean;
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
  * Enables the migration wizard UI to migrate alert rules and notification resources from external sources to Grafana Alerting
  * @default false
  */
  alertingMigrationWizardUI?: boolean;
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
  * Deprecated: Use kubernetesAuthZResourcePermissionsRedirect and kubernetesAuthZRolesRedirect instead
  * @deprecated
  * @default false
  */
  kubernetesAuthZHandlerRedirect?: boolean;
  /**
  * Redirects the traffic from the legacy resource permissions endpoints to the new K8s AuthZ endpoints
  * @default false
  */
  kubernetesAuthZResourcePermissionsRedirect?: boolean;
  /**
  * Redirects the traffic from the legacy roles endpoints to the new K8s AuthZ endpoints
  * @default false
  */
  kubernetesAuthZRolesRedirect?: boolean;
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
  * Shows a promotional banner for the Alerts Activity feature on the Rule List page
  * @default false
  */
  alertingAlertsActivityBanner?: boolean;
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
  * Enable style actions (copy/paste) in the panel editor
  * @default false
  */
  panelStyleActions?: boolean;
  /**
  * Enable visualization presets
  * @default false
  */
  vizPresets?: boolean;
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
  * Exclude redundant individual dashboard/folder permissions from managed roles at query time
  * @default false
  */
  excludeRedundantManagedPermissions?: boolean;
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
  /**
  * Redirects the request of the team endpoints to the app platform APIs
  * @default false
  */
  kubernetesTeamsHandlerRedirect?: boolean;
  /**
  * Enables external group mapping APIs in the app platform
  * @default false
  */
  kubernetesExternalGroupMappingsApi?: boolean;
  /**
  * Redirects the request of the external group mapping endpoints to the app platform APIs
  * @default false
  */
  kubernetesExternalGroupMappingsRedirect?: boolean;
  /**
  * Use the new APIs for syncing users to teams
  * @default false
  */
  kubernetesTeamSync?: boolean;
  /**
  * Enables the ability to create multiple alerting policies
  * @default false
  */
  alertingMultiplePolicies?: boolean;
  /**
  * Makes NoData and Error alerts fire immediately, without 'pending' stage
  * @default false
  */
  alertingIgnorePendingForNoDataAndError?: boolean;
  /**
  * Enables the notification history tab in the rule viewer
  * @default false
  */
  alertingNotificationHistoryRuleViewer?: boolean;
  /**
  * Enables the notification history global menu item viewer
  * @default false
  */
  alertingNotificationHistoryGlobal?: boolean;
  /**
  * Whether to use the new React 19 runtime
  * @default false
  */
  react19?: boolean;
  /**
  * Enables the frontend service to fetch tenant-specific settings overrides from the settings service
  * @default false
  */
  frontendServiceUseSettingsService?: boolean;
}
