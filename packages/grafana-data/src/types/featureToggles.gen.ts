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
  trimDefaults?: boolean;
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
  datasourceQueryMultiStatus?: boolean;
  traceToMetrics?: boolean;
  newDBLibrary?: boolean;
  validateDashboardsOnSave?: boolean;
  autoMigrateOldPanels?: boolean;
  disableAngular?: boolean;
  prometheusWideSeries?: boolean;
  canvasPanelNesting?: boolean;
  scenes?: boolean;
  disableSecretsCompatibility?: boolean;
  logRequestsInstrumentedAsUnknown?: boolean;
  dataConnectionsConsole?: boolean;
  topnav?: boolean;
  grpcServer?: boolean;
  entityStore?: boolean;
  cloudWatchCrossAccountQuerying?: boolean;
  redshiftAsyncQueryDataSupport?: boolean;
  athenaAsyncQueryDataSupport?: boolean;
  newPanelChromeUI?: boolean;
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
  gcomOnlyExternalOrgRoleSync?: boolean;
  prometheusMetricEncyclopedia?: boolean;
  timeSeriesTable?: boolean;
  prometheusResourceBrowserCache?: boolean;
  influxdbBackendMigration?: boolean;
  clientTokenRotation?: boolean;
  prometheusDataplane?: boolean;
  lokiMetricDataplane?: boolean;
  lokiLogsDataplane?: boolean;
  dataplaneFrontendFallback?: boolean;
  disableSSEDataplane?: boolean;
  alertStateHistoryLokiSecondary?: boolean;
  alertingNotificationsPoliciesMatchingInstances?: boolean;
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
  dataSourcePageHeader?: boolean;
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
  alertingLokiRangeToInstant?: boolean;
  vizAndWidgetSplit?: boolean;
  prometheusIncrementalQueryInstrumentation?: boolean;
  logsExploreTableVisualisation?: boolean;
  awsDatasourcesTempCredentials?: boolean;
  transformationsRedesign?: boolean;
  toggleLabelsInLogsUI?: boolean;
  mlExpressions?: boolean;
  traceQLStreaming?: boolean;
  grafanaAPIServer?: boolean;
  featureToggleAdminPage?: boolean;
  awsAsyncQueryCaching?: boolean;
  splitScopes?: boolean;
  azureMonitorDataplane?: boolean;
  permissionsFilterRemoveSubquery?: boolean;
  prometheusConfigOverhaulAuth?: boolean;
  configurableSchedulerTick?: boolean;
}
