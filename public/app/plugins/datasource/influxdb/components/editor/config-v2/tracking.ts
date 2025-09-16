import { reportInteraction } from '@grafana/runtime';

// Config Section
export const trackInfluxDBConfigV2FeedbackButtonClicked = () => {
  reportInteraction('influxdb-config-v2-feedback-button-clicked');
};

// URL and Auth Section
export const trackInfluxDBConfigV2URLInputField = () => {
  reportInteraction('influxdb-config-v2-url-input-field');
};

export const trackInfluxDBConfigV2QueryLanguageSelected = (props: { version: string }) => {
  reportInteraction('influxdb-config-v2-query-language-dropdown', props);
};

export const trackInfluxDBConfigV2ProductSelected = (props: { product: string }) => {
  reportInteraction('influxdb-config-v2-product-selection-dropdown', props);
};

// Flux Database Details Fields
export const trackInfluxDBConfigV2FluxDBDetailsOrgInputField = () => {
  reportInteraction('influxdb-config-v2-flux-dbdetails-org-input-field');
};

export const trackInfluxDBConfigV2FluxDBDetailsDefaultBucketInputField = () => {
  reportInteraction('influxdb-config-v2-flux-dbdetails-default-bucket-input-field');
};

export const trackInfluxDBConfigV2FluxDBDetailsTokenInputField = () => {
  reportInteraction('influxdb-config-v2-flux-dbdetails-token-input-field');
};

// InfluxQL Database Details Fields
export const trackInfluxDBConfigV2InfluxQLDBDetailsDatabaseInputField = () => {
  reportInteraction('influxdb-config-v2-influxql-dbdetails-database-input-field');
};

export const trackInfluxDBConfigV2InfluxQLDBDetailsUserInputField = () => {
  reportInteraction('influxdb-config-v2-influxql-dbdetails-user-input-field');
};

export const trackInfluxDBConfigV2InfluxQLDBDetailsPasswordInputField = () => {
  reportInteraction('influxdb-config-v2-influxql-dbdetails-password-input-field');
};

// SQL Database Details Fields
export const trackInfluxDBConfigV2SQLDBDetailsDatabaseInputField = () => {
  reportInteraction('influxdb-config-v2-sql-dbdetails-database-input-field');
};

export const trackInfluxDBConfigV2SQLDBDetailsTokenInputField = () => {
  reportInteraction('influxdb-config-v2-sql-dbdetails-token-input-field');
};

// Advanced DB Connection Settings
export const trackInfluxDBConfigV2AdvancedDbConnectionSettingsToggleClicked = () => {
  reportInteraction('influxdb-config-v2-advanceddb-settings-toggle-clicked');
};

export const trackInfluxDBConfigV2AdvancedDbConnectionSettingsHTTPMethodClicked = () => {
  reportInteraction('influxdb-config-v2-advanceddb-settings-http-method-clicked');
};

export const trackInfluxDBConfigV2AdvancedDbConnectionSettingsInsecureConnectClicked = () => {
  reportInteraction('influxdb-config-v2-advanceddb-settings-insecure-connection-clicked');
};

export const trackInfluxDBConfigV2AdvancedDbConnectionSettingsMinTimeClicked = () => {
  reportInteraction('influxdb-config-v2-advanceddb-settings-min-time-clicked');
};

export const trackInfluxDBConfigV2AdvancedDbConnectionSettingsAutocompleteClicked = () => {
  reportInteraction('influxdb-config-v2-advanceddb-settings-autocomplete-range-clicked');
};

export const trackInfluxDBConfigV2AdvancedDbConnectionSettingsMaxSeriesClicked = () => {
  reportInteraction('influxdb-config-v2-advanceddb-settings-max-series-clicked');
};

// Advanced HTTP Settings
export const trackInfluxDBConfigV2AdvancedHTTPSettingsToggleClicked = () => {
  reportInteraction('influxdb-config-v2-advanced-http-settings-toggle-clicked');
};

export const trackInfluxDBConfigV2AdvancedHTTPSettingsTimeoutField = () => {
  reportInteraction('influxdb-config-v2-advanced-http-settings-timeout-field');
};

// Auth Settings
export const trackInfluxDBConfigV2AuthSettingsToggleClicked = () => {
  reportInteraction('influxdb-config-v2-auth-settings-toggle-clicked');
};

export const trackInfluxDBConfigV2AuthSettingsAuthMethodSelected = (props: { authMethod: string }) => {
  reportInteraction('influxdb-config-v2-advanced-http-settings-timeout-field', props);
};
