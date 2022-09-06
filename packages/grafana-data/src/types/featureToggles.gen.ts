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
  swaggerUi?: boolean;
  featureHighlights?: boolean;
  dashboardComments?: boolean;
  annotationComments?: boolean;
  migrationLocking?: boolean;
  storage?: boolean;
  dashboardsFromStorage?: boolean;
  export?: boolean;
  azureMonitorResourcePickerForMetrics?: boolean;
  explore2Dashboard?: boolean;
  exploreMixedDatasource?: boolean;
  tracing?: boolean;
  commandPalette?: boolean;
  cloudWatchDynamicLabels?: boolean;
  datasourceQueryMultiStatus?: boolean;
  traceToMetrics?: boolean;
  prometheusStreamingJSONParser?: boolean;
  prometheusStreamingJSONParserTest?: boolean;
  validateDashboardsOnSave?: boolean;
  autoMigrateGraphPanels?: boolean;
  prometheusWideSeries?: boolean;
  canvasPanelNesting?: boolean;
  scenes?: boolean;
  useLegacyHeatmapPanel?: boolean;
  cloudMonitoringExperimentalUI?: boolean;
  disableSecretsCompatibility?: boolean;
  logRequestsInstrumentedAsUnknown?: boolean;
  dataConnectionsConsole?: boolean;
  internationalization?: boolean;
  topnav?: boolean;
  customBranding?: boolean;
  traceqlEditor?: boolean;
  redshiftAsyncQueryDataSupport?: boolean;
  athenaAsyncQueryDataSupport?: boolean;
}
