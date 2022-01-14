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

  recordedQueries?: boolean;
  teamsync?: boolean;
  ldapsync?: boolean;
  caching?: boolean;
  dspermissions?: boolean;
  analytics?: boolean;
  ['enterprise.plugins']?: boolean;
  trimDefaults?: boolean;
  envelopeEncryption?: boolean;
  httpclientprovider_azure_auth?: boolean;
  ['service-accounts']?: boolean;
  database_metrics?: boolean;
  dashboardPreviews?: boolean;
  ['live-config']?: boolean;
  ['live-pipeline']?: boolean;
  ['live-service-web-worker']?: boolean;
  queryOverLive?: boolean;
  tempoSearch?: boolean;
  tempoBackendSearch?: boolean;
  tempoServiceGraph?: boolean;
  fullRangeLogsVolume?: boolean;
  accesscontrol?: boolean;
  prometheus_azure_auth?: boolean;
  newNavigation?: boolean;
  showFeatureFlagsInUI?: boolean;
  disable_http_request_histogram?: boolean;
}
