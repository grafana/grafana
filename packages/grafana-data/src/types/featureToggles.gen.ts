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
  disableEnvelopeEncryption?: boolean;
  ['live-service-web-worker']?: boolean;
  queryOverLive?: boolean;
  panelTitleSearch?: boolean;
  publicDashboards?: boolean;
  publicDashboardsEmailSharing?: boolean;
  lokiExperimentalStreaming?: boolean;
  featureHighlights?: boolean;
  migrationLocking?: boolean;
  storage?: boolean;
  correlations?: boolean;
  exploreContentOutline?: boolean;
  datasourceQueryMultiStatus?: boolean;
  traceToMetrics?: boolean;
  autoMigrateOldPanels?: boolean;
  disableAngular?: boolean;
  canvasPanelNesting?: boolean;
  newVizTooltips?: boolean;
  scenes?: boolean;
  disableSecretsCompatibility?: boolean;
  logRequestsInstrumentedAsUnknown?: boolean;
  dataConnectionsConsole?: boolean;
  topnav?: boolean;
  dockedMegaMenu?: boolean;
  grpcServer?: boolean;
  unifiedStorage?: boolean;
  cloudWatchCrossAccountQuerying?: boolean;
  redshiftAsyncQueryDataSupport?: boolean;
  athenaAsyncQueryDataSupport?: boolean;
  cloudwatchNewRegionsHandler?: boolean;
  showDashboardValidationWarnings?: boolean;
  mysqlAnsiQuotes?: boolean;
  accessControlOnCall?: boolean;
  nestedFolders?: boolean;
  nestedFolderPicker?: boolean;
  accessTokenExpirationCheck?: boolean;
  emptyDashboardPage?: boolean;
  disablePrometheusExemplarSampling?: boolean;
  alertingBacktesting?: boolean;
  editPanelCSVDragAndDrop?: boolean;
  alertingNoNormalState?: boolean;
  logsContextDatasourceUi?: boolean;
  lokiQuerySplitting?: boolean;
  lokiQuerySplittingConfig?: boolean;
  individualCookiePreferences?: boolean;
  prometheusMetricEncyclopedia?: boolean;
  influxdbBackendMigration?: boolean;
  influxqlStreamingParser?: boolean;
  clientTokenRotation?: boolean;
  prometheusDataplane?: boolean;
  lokiMetricDataplane?: boolean;
  lokiLogsDataplane?: boolean;
  dataplaneFrontendFallback?: boolean;
  disableSSEDataplane?: boolean;
  alertStateHistoryLokiSecondary?: boolean;
  alertStateHistoryLokiPrimary?: boolean;
  alertStateHistoryLokiOnly?: boolean;
  unifiedRequestLog?: boolean;
  renderAuthJWT?: boolean;
  externalServiceAuth?: boolean;
  refactorVariablesTimeRange?: boolean;
  useCachingService?: boolean;
  enableElasticsearchBackendQuerying?: boolean;
  advancedDataSourcePicker?: boolean;
  faroDatasourceSelector?: boolean;
  enableDatagridEditing?: boolean;
  extraThemes?: boolean;
  lokiPredefinedOperations?: boolean;
  pluginsFrontendSandbox?: boolean;
  dashboardEmbed?: boolean;
  frontendSandboxMonitorOnly?: boolean;
  sqlDatasourceDatabaseSelection?: boolean;
  lokiFormatQuery?: boolean;
  cloudWatchLogsMonacoEditor?: boolean;
  exploreScrollableLogsContainer?: boolean;
  recordedQueriesMulti?: boolean;
  pluginsDynamicAngularDetectionPatterns?: boolean;
  vizAndWidgetSplit?: boolean;
  prometheusIncrementalQueryInstrumentation?: boolean;
  logsExploreTableVisualisation?: boolean;
  awsDatasourcesTempCredentials?: boolean;
  transformationsRedesign?: boolean;
  mlExpressions?: boolean;
  traceQLStreaming?: boolean;
  metricsSummary?: boolean;
  grafanaAPIServer?: boolean;
  grafanaAPIServerWithExperimentalAPIs?: boolean;
  grafanaAPIServerEnsureKubectlAccess?: boolean;
  featureToggleAdminPage?: boolean;
  awsAsyncQueryCaching?: boolean;
  splitScopes?: boolean;
  traceToProfiles?: boolean;
  tracesEmbeddedFlameGraph?: boolean;
  permissionsFilterRemoveSubquery?: boolean;
  prometheusConfigOverhaulAuth?: boolean;
  configurableSchedulerTick?: boolean;
  influxdbSqlSupport?: boolean;
  alertingNoDataErrorExecution?: boolean;
  angularDeprecationUI?: boolean;
  dashgpt?: boolean;
  reportingRetries?: boolean;
  sseGroupByDatasource?: boolean;
  requestInstrumentationStatusSource?: boolean;
  libraryPanelRBAC?: boolean;
  lokiRunQueriesInParallel?: boolean;
  wargamesTesting?: boolean;
  alertingInsights?: boolean;
  externalCorePlugins?: boolean;
  pluginsAPIMetrics?: boolean;
  httpSLOLevels?: boolean;
  idForwarding?: boolean;
  cloudWatchWildCardDimensionValues?: boolean;
  externalServiceAccounts?: boolean;
  panelMonitoring?: boolean;
  enableNativeHTTPHistogram?: boolean;
  formatString?: boolean;
  transformationsVariableSupport?: boolean;
  kubernetesPlaylists?: boolean;
  kubernetesSnapshots?: boolean;
  cloudWatchBatchQueries?: boolean;
  recoveryThreshold?: boolean;
  lokiStructuredMetadata?: boolean;
  teamHttpHeaders?: boolean;
  awsDatasourcesNewFormStyling?: boolean;
  cachingOptimizeSerializationMemoryUsage?: boolean;
  panelTitleSearchInV1?: boolean;
  pluginsInstrumentationStatusSource?: boolean;
  costManagementUi?: boolean;
  managedPluginsInstall?: boolean;
  prometheusPromQAIL?: boolean;
  addFieldFromCalculationStatFunctions?: boolean;
  alertmanagerRemoteSecondary?: boolean;
  alertmanagerRemotePrimary?: boolean;
  alertmanagerRemoteOnly?: boolean;
  annotationPermissionUpdate?: boolean;
  extractFieldsNameDeduplication?: boolean;
  dashboardSceneForViewers?: boolean;
  dashboardScene?: boolean;
  panelFilterVariable?: boolean;
  pdfTables?: boolean;
  ssoSettingsApi?: boolean;
  logsInfiniteScrolling?: boolean;
  flameGraphItemCollapsing?: boolean;
  alertingDetailsViewV2?: boolean;
  datatrails?: boolean;
  alertingSimplifiedRouting?: boolean;
  logRowsPopoverMenu?: boolean;
  pluginsSkipHostEnvVars?: boolean;
  regressionTransformation?: boolean;
  displayAnonymousStats?: boolean;
  newFolderPicker?: boolean;
  jitterAlertRules?: boolean;
  jitterAlertRulesWithinGroups?: boolean;
}
