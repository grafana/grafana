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
  */
  panelTitleSearch?: boolean;
  /**
  * Enables public dashboard sharing to be restricted to only allowed emails
  */
  publicDashboardsEmailSharing?: boolean;
  /**
  * Enables public dashboard rendering using scenes
  * @default true
  */
  publicDashboardsScene?: boolean;
  /**
  * Support new streaming approach for loki (prototype, needs special loki build)
  */
  lokiExperimentalStreaming?: boolean;
  /**
  * Highlight Grafana Enterprise features
  * @default false
  */
  featureHighlights?: boolean;
  /**
  * Configurable storage for dashboards, datasources, and resources
  */
  storage?: boolean;
  /**
  * Correlations page
  * @default true
  */
  correlations?: boolean;
  /**
  * Allow elements nesting
  */
  canvasPanelNesting?: boolean;
  /**
  * Disable duplicated secret storage in legacy tables
  */
  disableSecretsCompatibility?: boolean;
  /**
  * Logs the path for requests that are instrumented as unknown
  */
  logRequestsInstrumentedAsUnknown?: boolean;
  /**
  * Run the GRPC server
  */
  grpcServer?: boolean;
  /**
  * Enables cross-account querying in CloudWatch datasources
  * @default true
  */
  cloudWatchCrossAccountQuerying?: boolean;
  /**
  * Show warnings when dashboards do not validate against the schema
  */
  showDashboardValidationWarnings?: boolean;
  /**
  * Use double quotes to escape keyword in a MySQL query
  */
  mysqlAnsiQuotes?: boolean;
  /**
  * Enable folder nesting
  * @default true
  */
  nestedFolders?: boolean;
  /**
  * Rule backtesting API for alerting
  */
  alertingBacktesting?: boolean;
  /**
  * Enables drag and drop for CSV and Excel files
  */
  editPanelCSVDragAndDrop?: boolean;
  /**
  * Allow datasource to provide custom UI for context view
  * @default true
  */
  logsContextDatasourceUi?: boolean;
  /**
  * Use stream shards to split queries into smaller subqueries
  */
  lokiShardSplitting?: boolean;
  /**
  * Split large interval queries into subqueries with smaller time intervals
  * @default true
  */
  lokiQuerySplitting?: boolean;
  /**
  * Give users the option to configure split durations for Loki queries
  */
  lokiQuerySplittingConfig?: boolean;
  /**
  * Support overriding cookie preferences per user
  */
  individualCookiePreferences?: boolean;
  /**
  * Query InfluxDB InfluxQL without the proxy
  * @default true
  */
  influxdbBackendMigration?: boolean;
  /**
  * Enable streaming JSON parser for InfluxDB datasource InfluxQL query language
  */
  influxqlStreamingParser?: boolean;
  /**
  * Enables running InfluxDB Influxql queries in parallel
  */
  influxdbRunQueriesInParallel?: boolean;
  /**
  * Changes logs responses from Loki to be compliant with the dataplane specification.
  */
  lokiLogsDataplane?: boolean;
  /**
  * Support dataplane contract field name change for transformations and field name matchers where the name is different
  * @default true
  */
  dataplaneFrontendFallback?: boolean;
  /**
  * Disables dataplane specific processing in server side expressions.
  */
  disableSSEDataplane?: boolean;
  /**
  * Writes error logs to the request logger
  * @default true
  */
  unifiedRequestLog?: boolean;
  /**
  * Uses JWT-based auth for rendering instead of relying on remote cache
  */
  renderAuthJWT?: boolean;
  /**
  * Refactor time range variables flow to reduce number of API calls made when query variables are chained
  */
  refactorVariablesTimeRange?: boolean;
  /**
  * Enable the data source selector within the Frontend Apps section of the Frontend Observability
  */
  faroDatasourceSelector?: boolean;
  /**
  * Enables the edit functionality in the datagrid panel
  */
  enableDatagridEditing?: boolean;
  /**
  * Enables extra themes
  */
  extraThemes?: boolean;
  /**
  * Adds predefined query operations to Loki query editor
  */
  lokiPredefinedOperations?: boolean;
  /**
  * Enables the plugins frontend sandbox
  */
  pluginsFrontendSandbox?: boolean;
  /**
  * Enables monitor only in the plugin frontend sandbox (if enabled)
  */
  frontendSandboxMonitorOnly?: boolean;
  /**
  * Enables right panel for the plugins details page
  * @default true
  */
  pluginsDetailsRightPanel?: boolean;
  /**
  * Enables previous SQL data source dataset dropdown behavior
  */
  sqlDatasourceDatabaseSelection?: boolean;
  /**
  * Enables writing multiple items from a single query within Recorded Queries
  * @default true
  */
  recordedQueriesMulti?: boolean;
  /**
  * A table visualisation for logs in Explore
  * @default true
  */
  logsExploreTableVisualisation?: boolean;
  /**
  * Support temporary security credentials in AWS plugins for Grafana Cloud customers
  */
  awsDatasourcesTempCredentials?: boolean;
  /**
  * Enables the transformations redesign
  * @default true
  */
  transformationsRedesign?: boolean;
  /**
  * Enable support for Machine Learning in server-side expressions
  */
  mlExpressions?: boolean;
  /**
  * Expose some datasources as apiservers.
  */
  datasourceAPIServers?: boolean;
  /**
  * Register experimental APIs with the k8s API server, including all datasources
  */
  grafanaAPIServerWithExperimentalAPIs?: boolean;
  /**
  * Next generation provisioning... and git
  */
  provisioning?: boolean;
  /**
  * Start an additional https handler and write kubectl options
  */
  grafanaAPIServerEnsureKubectlAccess?: boolean;
  /**
  * Enable admin page for managing feature toggles from the Grafana front-end. Grafana Cloud only.
  */
  featureToggleAdminPage?: boolean;
  /**
  * Enable caching for async queries for Redshift and Athena. Requires that the datasource has caching and async query support enabled
  * @default true
  */
  awsAsyncQueryCaching?: boolean;
  /**
  * Alternative permission filter implementation that does not use subqueries for fetching the dashboard folder
  */
  permissionsFilterRemoveSubquery?: boolean;
  /**
  * Enable changing the scheduler base interval via configuration option unified_alerting.scheduler_tick_interval
  */
  configurableSchedulerTick?: boolean;
  /**
  * Display Angular warnings in dashboards and panels
  * @default true
  */
  angularDeprecationUI?: boolean;
  /**
  * Enable AI powered features in dashboards
  * @default true
  */
  dashgpt?: boolean;
  /**
  * Enable AI powered features for dashboards to auto-summary changes when saving
  */
  aiGeneratedDashboardChanges?: boolean;
  /**
  * Enables rendering retries for the reporting feature
  */
  reportingRetries?: boolean;
  /**
  * Send query to the same datasource in a single request when using server side expressions. The `cloudWatchBatchQueries` feature toggle should be enabled if this used with CloudWatch.
  */
  sseGroupByDatasource?: boolean;
  /**
  * Enables RBAC support for library panels
  */
  libraryPanelRBAC?: boolean;
  /**
  * Enables running Loki queries in parallel
  */
  lokiRunQueriesInParallel?: boolean;
  /**
  * Placeholder feature flag for internal testing
  */
  wargamesTesting?: boolean;
  /**
  * Show the new alerting insights landing page
  * @default true
  */
  alertingInsights?: boolean;
  /**
  * Allow core plugins to be loaded as external
  * @default true
  */
  externalCorePlugins?: boolean;
  /**
  * Automatic service account and token setup for plugins
  */
  externalServiceAccounts?: boolean;
  /**
  * Enables panel monitoring through logs and measurements
  * @default true
  */
  panelMonitoring?: boolean;
  /**
  * Enables native HTTP Histograms
  */
  enableNativeHTTPHistogram?: boolean;
  /**
  * Disables classic HTTP Histogram (use with enableNativeHTTPHistogram)
  */
  disableClassicHTTPHistogram?: boolean;
  /**
  * Enable format string transformer
  * @default true
  */
  formatString?: boolean;
  /**
  * Use the kubernetes API in the frontend for playlists, and route /api/playlist requests to k8s
  * @default true
  */
  kubernetesPlaylists?: boolean;
  /**
  * Routes snapshot requests from /api to the /apis endpoint
  */
  kubernetesSnapshots?: boolean;
  /**
  * Use the kubernetes API in the frontend for dashboards
  */
  kubernetesDashboards?: boolean;
  /**
  * Route the folder and dashboard service requests to k8s
  * @default true
  */
  kubernetesClientDashboardsFolders?: boolean;
  /**
  * Disable schema validation for dashboards/v1
  */
  dashboardDisableSchemaValidationV1?: boolean;
  /**
  * Disable schema validation for dashboards/v2
  */
  dashboardDisableSchemaValidationV2?: boolean;
  /**
  * Log schema validation errors so they can be analyzed later
  */
  dashboardSchemaValidationLogging?: boolean;
  /**
  * Show query type endpoints in datasource API servers (currently hardcoded for testdata, expressions, and prometheus)
  */
  datasourceQueryTypes?: boolean;
  /**
  * Register /apis/query.grafana.app/ -- will eventually replace /api/ds/query
  */
  queryService?: boolean;
  /**
  * Rewrite requests targeting /ds/query to the query service
  */
  queryServiceRewrite?: boolean;
  /**
  * Routes requests to the new query service
  */
  queryServiceFromUI?: boolean;
  /**
  * Routes explore requests to the new query service
  */
  queryServiceFromExplore?: boolean;
  /**
  * Runs CloudWatch metrics queries as separate batches
  */
  cloudWatchBatchQueries?: boolean;
  /**
  * Enables feature recovery threshold (aka hysteresis) for threshold server-side expression
  * @default true
  */
  recoveryThreshold?: boolean;
  /**
  * Enables the loki data source to request structured metadata from the Loki server
  * @default true
  */
  lokiStructuredMetadata?: boolean;
  /**
  * If enabled, the caching backend gradually serializes query responses for the cache, comparing against the configured `[caching]max_value_mb` value as it goes. This can can help prevent Grafana from running out of memory while attempting to cache very large query responses.
  */
  cachingOptimizeSerializationMemoryUsage?: boolean;
  /**
  * Enables search for metric names in Code Mode, to improve performance when working with an enormous number of metric names
  */
  prometheusCodeModeMetricNamesSearch?: boolean;
  /**
  * Add cumulative and window functions to the add field from calculation transformation
  * @default true
  */
  addFieldFromCalculationStatFunctions?: boolean;
  /**
  * Enable Grafana to sync configuration and state with a remote Alertmanager.
  */
  alertmanagerRemoteSecondary?: boolean;
  /**
  * Enable Grafana to have a remote Alertmanager instance as the primary Alertmanager.
  */
  alertmanagerRemotePrimary?: boolean;
  /**
  * Disable the internal Alertmanager and only use the external one defined.
  */
  alertmanagerRemoteOnly?: boolean;
  /**
  * Change the way annotation permissions work by scoping them to folders and dashboards.
  * @default true
  */
  annotationPermissionUpdate?: boolean;
  /**
  * Make sure extracted field names are unique in the dataframe
  */
  extractFieldsNameDeduplication?: boolean;
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
  * Enables experimental new dashboard layouts
  */
  dashboardNewLayouts?: boolean;
  /**
  * Enables use of the `systemPanelFilterVar` variable to filter panels in a dashboard
  */
  panelFilterVariable?: boolean;
  /**
  * Enables generating table data as PDF in reporting
  */
  pdfTables?: boolean;
  /**
  * Enables the SSO settings API and the OAuth configuration UIs in Grafana
  * @default true
  */
  ssoSettingsApi?: boolean;
  /**
  * Allow pan and zoom in canvas panel
  */
  canvasPanelPanZoom?: boolean;
  /**
  * Enables infinite scrolling for the Logs panel in Explore and Dashboards
  * @default true
  */
  logsInfiniteScrolling?: boolean;
  /**
  * Enables users to easily configure alert notifications by specifying a contact point directly when editing or creating an alert rule
  * @default true
  */
  alertingSimplifiedRouting?: boolean;
  /**
  * Enable filtering menu displayed when text of a log line is selected
  * @default true
  */
  logRowsPopoverMenu?: boolean;
  /**
  * Disables passing host environment variable to plugin processes
  */
  pluginsSkipHostEnvVars?: boolean;
  /**
  * Enables shared crosshair in table panel
  */
  tableSharedCrosshair?: boolean;
  /**
  * Enables regression analysis transformation
  */
  regressionTransformation?: boolean;
  /**
  * Enables query hints for Loki
  * @default true
  */
  lokiQueryHints?: boolean;
  /**
  * Use the kubernetes API for feature toggle management in the frontend
  */
  kubernetesFeatureToggles?: boolean;
  /**
  * Enabled grafana cloud specific RBAC roles
  */
  cloudRBACRoles?: boolean;
  /**
  * Optimizes eligible queries in order to reduce load on datasources
  * @default false
  */
  alertingQueryOptimization?: boolean;
  /**
  * Enables the nested folder picker without having nested folders enabled
  */
  newFolderPicker?: boolean;
  /**
  * Distributes alert rule evaluations more evenly over time, including spreading out rules within the same group. Disables sequential evaluation if enabled.
  */
  jitterAlertRulesWithinGroups?: boolean;
  /**
  * Enable the Grafana Migration Assistant, which helps you easily migrate various on-prem resources to your Grafana Cloud stack.
  * @default true
  */
  onPremToCloudMigrations?: boolean;
  /**
  * Enable the secrets management API and services under app platform
  */
  secretsManagementAppPlatform?: boolean;
  /**
  * Writes the state periodically to the database, asynchronous to rule evaluation
  */
  alertingSaveStatePeriodic?: boolean;
  /**
  * Enables the compressed protobuf-based alert state storage
  * @default false
  */
  alertingSaveStateCompressed?: boolean;
  /**
  * In-development feature flag for the scope api using the app platform.
  * @default false
  */
  scopeApi?: boolean;
  /**
  * In-development feature that will allow injection of labels into prometheus queries.
  * @default true
  */
  promQLScope?: boolean;
  /**
  * In-development feature that will allow injection of labels into loki queries.
  * @default false
  */
  logQLScope?: boolean;
  /**
  * Enables SQL Expressions, which can execute SQL queries against data source results.
  */
  sqlExpressions?: boolean;
  /**
  * Enables the group to nested table transformation
  * @default true
  */
  groupToNestedTableTransformation?: boolean;
  /**
  * New implementation for the dashboard-to-PDF rendering
  * @default true
  */
  newPDFRendering?: boolean;
  /**
  * Use TLS-enabled memcached in the enterprise caching feature
  * @default true
  */
  tlsMemcached?: boolean;
  /**
  * Enable grafana's embedded kube-aggregator
  */
  kubernetesAggregator?: boolean;
  /**
  * Enable new expression parser
  */
  expressionParser?: boolean;
  /**
  * Enable groupBy variable support in scenes dashboards
  */
  groupByVariable?: boolean;
  /**
  * Enables the use of scope filters in Grafana
  */
  scopeFilters?: boolean;
  /**
  * Use the new SSO Settings API to configure the SAML connector
  * @default true
  */
  ssoSettingsSAML?: boolean;
  /**
  * Require that sub claims is present in oauth tokens.
  */
  oauthRequireSubClaim?: boolean;
  /**
  * Enables filters and group by variables on all new dashboards. Variables are added only if default data source supports filtering.
  */
  newDashboardWithFiltersAndGroupBy?: boolean;
  /**
  * Updates CloudWatch label parsing to be more accurate
  * @default true
  */
  cloudWatchNewLabelParsing?: boolean;
  /**
  * In server-side expressions, disable the sorting of numeric-kind metrics by their metric name or labels.
  */
  disableNumericMetricsSortingInExpressions?: boolean;
  /**
  * Enables Grafana-managed recording rules.
  */
  grafanaManagedRecordingRules?: boolean;
  /**
  * Enables Query Library feature in Explore
  */
  queryLibrary?: boolean;
  /**
  * Sets the logs table as default visualisation in logs explore
  */
  logsExploreTableDefaultVisualization?: boolean;
  /**
  * Enables the new sharing drawer design
  * @default true
  */
  newDashboardSharingComponent?: boolean;
  /**
  * Enables the new alert list view design
  */
  alertingListViewV2?: boolean;
  /**
  * Disables the ability to send alerts to an external Alertmanager datasource.
  */
  alertingDisableSendAlertsExternal?: boolean;
  /**
  * Enables possibility to preserve dashboard variables and time range when navigating between dashboards
  */
  preserveDashboardStateWhenNavigating?: boolean;
  /**
  * Enables the new central alert history.
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
  * Enables pinning of nav items
  * @default true
  */
  pinNavItems?: boolean;
  /**
  * Enables the gRPC server for authorization
  */
  authZGRPCServer?: boolean;
  /**
  * Use the new SSO Settings API to configure LDAP
  */
  ssoSettingsLDAP?: boolean;
  /**
  * Throws an error if a data source has an invalid UIDs
  * @default true
  */
  failWrongDSUID?: boolean;
  /**
  * Use openFGA as authorization engine.
  */
  zanzana?: boolean;
  /**
  * Enables reload of dashboards on scopes, time range and variables changes
  */
  reloadDashboardsOnParamsChange?: boolean;
  /**
  * Enables the scopes usage in Metrics Explore
  */
  enableScopesInMetricsExplore?: boolean;
  /**
  * Register Alerting APIs with the K8s API server
  * @default true
  */
  alertingApiServer?: boolean;
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
  */
  alertingFilterV2?: boolean;
  /**
  * Enable grafana dataplane aggregator
  */
  dataplaneAggregator?: boolean;
  /**
  * Enables new combobox style UI for the Ad hoc filters variable in scenes architecture
  * @default true
  */
  newFiltersUI?: boolean;
  /**
  * Allows access to the new react-data-grid based table component.
  */
  tableNextGen?: boolean;
  /**
  * Send dashboard and panel names to Loki when querying
  */
  lokiSendDashboardPanelNames?: boolean;
  /**
  * Uses Prometheus rules as the primary source of truth for ruler-enabled data sources
  */
  alertingPrometheusRulesPrimary?: boolean;
  /**
  * Used in Logs Drilldown to split queries into multiple queries based on the number of shards
  */
  exploreLogsShardSplitting?: boolean;
  /**
  * Used in Logs Drilldown to query by aggregated metrics
  */
  exploreLogsAggregatedMetrics?: boolean;
  /**
  * Used in Logs Drilldown to limit the time range
  */
  exploreLogsLimitedTimeRange?: boolean;
  /**
  * Used in Home for users who want to return to the onboarding flow or quickly find popular config pages
  */
  homeSetupGuide?: boolean;
  /**
  * Enables the gRPC client to authenticate with the App Platform by using ID & access tokens
  */
  appPlatformGrpcClientAuth?: boolean;
  /**
  * Enable the groupsync extension for managing Group Attribute Sync feature
  */
  groupAttributeSync?: boolean;
  /**
  * Enables step mode for alerting queries and expressions
  * @default true
  */
  alertingQueryAndExpressionsStepMode?: boolean;
  /**
  * Enables improved support for OAuth external sessions. After enabling this feature, users might need to re-authenticate themselves.
  */
  improvedExternalSessionHandling?: boolean;
  /**
  * Use session storage for handling the redirection after login
  * @default true
  */
  useSessionStorageForRedirection?: boolean;
  /**
  * Enables the new role picker drawer design
  */
  rolePickerDrawer?: boolean;
  /**
  * Enable unified storage search
  */
  unifiedStorageSearch?: boolean;
  /**
  * Enable sprinkles on unified storage search
  */
  unifiedStorageSearchSprinkles?: boolean;
  /**
  * Enable permission filtering on unified storage search
  * @default true
  */
  unifiedStorageSearchPermissionFiltering?: boolean;
  /**
  * Pick the dual write mode from database configs
  */
  managedDualWriter?: boolean;
  /**
  * Enables SRI checks for plugin assets
  * @default false
  */
  pluginsSriChecks?: boolean;
  /**
  * Enables to save big objects in blob storage
  */
  unifiedStorageBigObjectsSupport?: boolean;
  /**
  * Enables time pickers sync
  */
  timeRangeProvider?: boolean;
  /**
  * Use new **Combobox** component for Prometheus query editor
  * @default true
  */
  prometheusUsesCombobox?: boolean;
  /**
  * Disables the log limit restriction for Azure Monitor when true. The limit is enabled by default.
  * @default false
  */
  azureMonitorDisableLogLimit?: boolean;
  /**
  * Enables automatic updates for pre-installed plugins
  * @default true
  */
  preinstallAutoUpdate?: boolean;
  /**
  * Enables experimental reconciler for playlists
  */
  playlistsReconciler?: boolean;
  /**
  * Enable passwordless login via magic link authentication
  */
  passwordlessMagicLinkAuthentication?: boolean;
  /**
  * Display Related Logs in Grafana Metrics Drilldown
  */
  exploreMetricsRelatedLogs?: boolean;
  /**
  * Adds support for quotes and special characters in label values for Prometheus queries
  */
  prometheusSpecialCharsInLabelValues?: boolean;
  /**
  * Enables the extension admin page regardless of development mode
  */
  enableExtensionsAdminPage?: boolean;
  /**
  * Enables SCIM support for user and group management
  */
  enableSCIM?: boolean;
  /**
  * Enables browser crash detection reporting to Faro.
  */
  crashDetection?: boolean;
  /**
  * Enables querying the Jaeger data source without the proxy
  */
  jaegerBackendMigration?: boolean;
  /**
  * Uses the original report or dashboard time range instead of making an absolute transformation
  * @default true
  */
  reportingUseRawTimeRange?: boolean;
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
  * Enables simplified step mode in the notifications section
  * @default true
  */
  alertingNotificationsStepMode?: boolean;
  /**
  * Enables a button to send feedback from the Grafana UI
  */
  feedbackButton?: boolean;
  /**
  * Enable unified storage search UI
  */
  unifiedStorageSearchUI?: boolean;
  /**
  * Enables cross cluster search in the Elasticsearch datasource
  */
  elasticsearchCrossClusterSearch?: boolean;
  /**
  * Displays the navigation history so the user can navigate back to previous pages
  */
  unifiedHistory?: boolean;
  /**
  * Defaults to using the Loki `/labels` API instead of `/series`
  * @default true
  */
  lokiLabelNamesQueryApi?: boolean;
  /**
  * Enable the investigations backend API
  * @default false
  */
  investigationsBackend?: boolean;
  /**
  * Enable folder's api server counts
  * @default false
  */
  k8SFolderCounts?: boolean;
  /**
  * Enable folder's api server move
  * @default false
  */
  k8SFolderMove?: boolean;
  /**
  * Enables improved support for SAML external sessions. Ensure the NameID format is correctly configured in Grafana for SAML Single Logout to function properly.
  */
  improvedExternalSessionHandlingSAML?: boolean;
  /**
  * Enables LBAC for datasources for Mimir to apply LBAC filtering of metrics to the client requests for users in teams
  */
  teamHttpHeadersMimir?: boolean;
  /**
  * Test feature toggle to see how cohorts could be set up AB testing
  * @default false
  */
  ABTestFeatureToggleA?: boolean;
  /**
  * Use new **Combobox** component for template variables
  */
  templateVariablesUsesCombobox?: boolean;
  /**
  * Test feature toggle to see how cohorts could be set up AB testing
  * @default false
  */
  ABTestFeatureToggleB?: boolean;
  /**
  * Enables Advisor app
  */
  grafanaAdvisor?: boolean;
  /**
  * Enables less memory intensive Elasticsearch result parsing
  */
  elasticsearchImprovedParsing?: boolean;
  /**
  * Shows defined connections for a data source in the plugins detail page
  */
  datasourceConnectionsTab?: boolean;
  /**
  * Use a POST request to list rules by passing down the namespaces user has access to
  */
  fetchRulesUsingPost?: boolean;
  /**
  * Enables the new logs panel in Explore
  */
  newLogsPanel?: boolean;
  /**
  * Enables the temporary themes for GrafanaCon
  * @default true
  */
  grafanaconThemes?: boolean;
  /**
  * Loads plugins from CDN synchronously
  */
  pluginsCDNSyncLoader?: boolean;
  /**
  * Enables the new Jira integration for contact points in cloud alert managers.
  */
  alertingJiraIntegration?: boolean;
  /**
  * Use the scopes navigation endpoint instead of the dashboardbindings endpoint
  */
  useScopesNavigationEndpoint?: boolean;
  /**
  * Enable scope search to include all levels of the scope node tree
  */
  scopeSearchAllLevels?: boolean;
  /**
  * Enables the alert rule version history restore feature
  * @default true
  */
  alertingRuleVersionHistoryRestore?: boolean;
  /**
  * Enables the report creation drawer in a dashboard
  */
  newShareReportDrawer?: boolean;
  /**
  * Disable pre-loading app plugins when the request is coming from the renderer
  */
  rendererDisableAppPluginsPreload?: boolean;
  /**
  * Enables SRI checks for Grafana JavaScript assets
  */
  assetSriChecks?: boolean;
  /**
  * Enables the alert rule restore feature
  * @default true
  */
  alertRuleRestore?: boolean;
  /**
  * Enables writing to data sources for Grafana-managed recording rules.
  */
  grafanaManagedRecordingRulesDatasources?: boolean;
  /**
  * Enables running Infinity queries in parallel
  */
  infinityRunQueriesInParallel?: boolean;
  /**
  * Renders invite user button along the app
  */
  inviteUserExperimental?: boolean;
  /**
  * Enables the alerting migration UI, to migrate datasource-managed rules to Grafana-managed rules
  */
  alertingMigrationUI?: boolean;
  /**
  * Enables the unified storage history pruner
  */
  unifiedStorageHistoryPruner?: boolean;
  /**
  * Enables the logs builder mode for the Azure Monitor data source
  * @default false
  */
  azureMonitorLogsBuilderEditor?: boolean;
  /**
  * Specifies the locale so the correct format for numbers and dates can be shown
  */
  localeFormatPreference?: boolean;
  /**
  * Enables the unified storage grpc connection pool
  */
  unifiedStorageGrpcConnectionPool?: boolean;
  /**
  * Enables the extension sidebar
  */
  extensionSidebar?: boolean;
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
  * Support Application Signals queries in the X-Ray datasource
  */
  xrayApplicationSignals?: boolean;
  /**
  * use multi-tenant path for awsTempCredentials
  */
  multiTenantTempCredentials?: boolean;
  /**
  * Enables localization for plugins
  */
  localizationForPlugins?: boolean;
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
  */
  metricsFromProfiles?: boolean;
}
