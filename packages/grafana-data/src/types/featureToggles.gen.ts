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
 * Only enabled values will be returned in this interface
 *
 * @public
 */
export interface FeatureToggles {
  [name: string]: boolean | undefined; // support any string value

  returnUnameHeader?: boolean;
  alertingBigTransactions?: boolean;
  promQueryBuilder?: boolean;
  trimDefaults?: boolean;
  disableEnvelopeEncryption?: boolean;
  database_metrics?: boolean;
  dashboardPreviews?: boolean;
  dashboardPreviewsAdmin?: boolean;
  ['live-config']?: boolean;
  ['live-pipeline']?: boolean;
  ['live-service-web-worker']?: boolean;
  queryOverLive?: boolean;
  panelTitleSearch?: boolean;
  tempoApmTable?: boolean;
  prometheusAzureOverrideAudience?: boolean;
  influxdbBackendMigration?: boolean;
  showFeatureFlagsInUI?: boolean;
  publicDashboards?: boolean;
  lokiLive?: boolean;
  lokiDataframeApi?: boolean;
  lokiMonacoEditor?: boolean;
  swaggerUi?: boolean;
  featureHighlights?: boolean;
  dashboardComments?: boolean;
  annotationComments?: boolean;
  migrationLocking?: boolean;
  storage?: boolean;
  dashboardsFromStorage?: boolean;
  export?: boolean;
  azureMonitorResourcePickerForMetrics?: boolean;
  exploreMixedDatasource?: boolean;
  tracing?: boolean;
  commandPalette?: boolean;
  correlations?: boolean;
  cloudWatchDynamicLabels?: boolean;
  datasourceQueryMultiStatus?: boolean;
  traceToMetrics?: boolean;
  prometheusBufferedClient?: boolean;
  newDBLibrary?: boolean;
  validateDashboardsOnSave?: boolean;
  autoMigrateGraphPanels?: boolean;
  prometheusWideSeries?: boolean;
  canvasPanelNesting?: boolean;
  scenes?: boolean;
  useLegacyHeatmapPanel?: boolean;
  disableSecretsCompatibility?: boolean;
  logRequestsInstrumentedAsUnknown?: boolean;
  dataConnectionsConsole?: boolean;
  internationalization?: boolean;
  topnav?: boolean;
  grpcServer?: boolean;
  objectStore?: boolean;
  traceqlEditor?: boolean;
  flameGraph?: boolean;
  cloudWatchCrossAccountQuerying?: boolean;
  redshiftAsyncQueryDataSupport?: boolean;
  athenaAsyncQueryDataSupport?: boolean;
  increaseInMemDatabaseQueryCache?: boolean;
  interFont?: boolean;
  newPanelChromeUI?: boolean;
  queryLibrary?: boolean;
  showDashboardValidationWarnings?: boolean;
  mysqlAnsiQuotes?: boolean;
  userRemoteCache?: boolean;
  datasourceLogger?: boolean;
  accessControlOnCall?: boolean;
  nestedFolders?: boolean;
  accessTokenExpirationCheck?: boolean;
  elasticsearchBackendMigration?: boolean;
  sessionRemoteCache?: boolean;
  secureSocksDatasourceProxy?: boolean;
}
