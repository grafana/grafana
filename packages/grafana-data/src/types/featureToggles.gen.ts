// NOTE: This file was auto generated.  DO NOT EDIT DIRECTLY!
// To change feature toggles, edit:
//  pkg/services/featuremgmt/registry_{squad}.go
// Then run tests in:
//  pkg/services/featuremgmt/toggles_gen_test.go


/**
 * Describes available feature toggles in Grafana. These can be configured via
 * conf/custom.ini to enable features under development or not yet available in
 * stable version.
 *
 * Only enabled values will be returned in this interface
 *
 * @public
 */
export interface FeatureToggles {
  [name: string]: boolean | undefined; // support any string value

  accessControlOnCall?: boolean;
  accessTokenExpirationCheck?: boolean;
  alertingBacktesting?: boolean;
  alertingBigTransactions?: boolean;
  alertingNoNormalState?: boolean;
  annotationComments?: boolean;
  athenaAsyncQueryDataSupport?: boolean;
  authnService?: boolean;
  autoMigrateGraphPanels?: boolean;
  canvasPanelNesting?: boolean;
  cloudWatchCrossAccountQuerying?: boolean;
  cloudWatchDynamicLabels?: boolean;
  correlations?: boolean;
  dashboardComments?: boolean;
  dashboardPreviews?: boolean;
  dashboardsFromStorage?: boolean;
  dataConnectionsConsole?: boolean;
  database_metrics?: boolean;
  datasourceOnboarding?: boolean;
  datasourceQueryMultiStatus?: boolean;
  disableEnvelopeEncryption?: boolean;
  disablePrometheusExemplarSampling?: boolean;
  disableSecretsCompatibility?: boolean;
  drawerDataSourcePicker?: boolean;
  editPanelCSVDragAndDrop?: boolean;
  elasticsearchBackendMigration?: boolean;
  entityStore?: boolean;
  exploreMixedDatasource?: boolean;
  featureHighlights?: boolean;
  grpcServer?: boolean;
  individualCookiePreferences?: boolean;
  internationalization?: boolean;
  k8s?: boolean;
  ['live-pipeline']?: boolean;
  ['live-service-web-worker']?: boolean;
  logRequestsInstrumentedAsUnknown?: boolean;
  logsContextDatasourceUi?: boolean;
  logsSampleInExplore?: boolean;
  lokiDataframeApi?: boolean;
  lokiLive?: boolean;
  lokiQuerySplitting?: boolean;
  migrationLocking?: boolean;
  mysqlAnsiQuotes?: boolean;
  nestedFolders?: boolean;
  newDBLibrary?: boolean;
  newPanelChromeUI?: boolean;
  newTraceView?: boolean;
  panelTitleSearch?: boolean;
  prometheusAzureOverrideAudience?: boolean;
  prometheusWideSeries?: boolean;
  publicDashboards?: boolean;
  publicDashboardsEmailSharing?: boolean;
  queryLibrary?: boolean;
  queryOverLive?: boolean;
  redshiftAsyncQueryDataSupport?: boolean;
  scenes?: boolean;
  secureSocksDatasourceProxy?: boolean;
  showDashboardValidationWarnings?: boolean;
  storage?: boolean;
  topnav?: boolean;
  traceToMetrics?: boolean;
  tracing?: boolean;
  trimDefaults?: boolean;
  validateDashboardsOnSave?: boolean;
}
