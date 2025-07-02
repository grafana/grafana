import { reportInteraction } from '@grafana/runtime';

// Config Section
export const trackInfluxDBConfigV2FeedbackButtonClicked = () => {
  console.log('hello');
  reportInteraction('influxdb_config_v2_feedback_button_clicked');
};

// URL and Auth Section
export const trackInfluxDBConfigV2URLInputField = () => {
  reportInteraction('influxdb_config_v2_url_input_field');
};

export const trackInfluxDBConfigV2QueryLanguageSelected = (props: { version: string }) => {
  reportInteraction('influxdb_config_v2_query_language_dropdown', props);
};

export const trackInfluxDBConfigV2ProductSelected = (props: { product: string }) => {
  reportInteraction('influxdb_config_v2_product_selection_dropdown', props);
};

// Flux Database Details Fields
export const trackInfluxDBConfigV2FluxDBDetailsOrgInputField = () => {
  reportInteraction('influxdb_config_v2_flux_dbdetails_org_input_field');
};

export const trackInfluxDBConfigV2FluxDBDetailsDefaultBucketInputField = () => {
  reportInteraction('influxdb_config_v2_flux_dbdetails_default_bucket_input_field');
};

export const trackInfluxDBConfigV2FluxDBDetailsTokenInputField = () => {
  reportInteraction('influxdb_config_v2_flux_dbdetails_token_input_field');
};

// InfluxQL Database Details Fields
export const trackInfluxDBConfigV2InfluxQLDBDetailsDatabaseInputField = () => {
  reportInteraction('influxdb_config_v2_influxql_dbdetails_database_input_field');
};

export const trackInfluxDBConfigV2InfluxQLDBDetailsUserInputField = () => {
  reportInteraction('influxdb_config_v2_influxql_dbdetails_user_input_field');
};

export const trackInfluxDBConfigV2InfluxQLDBDetailsPasswordInputField = () => {
  reportInteraction('influxdb_config_v2_influxql_dbdetails_password_input_field');
};

// SQL Database Details Fields
export const trackInfluxDBConfigV2SQLDBDetailsDatabaseInputField = () => {
  reportInteraction('influxdb_config_v2_sql_dbdetails_database_input_field');
};

export const trackInfluxDBConfigV2SQLDBDetailsTokenInputField = () => {
  reportInteraction('influxdb_config_v2_sql_dbdetails_token_input_field');
};

// Advanced DB Connection Settings
export const trackInfluxDBConfigV2AdvancedDbConnectionSettingsToggleClicked = () => {
  reportInteraction('influxdb_config_v2_advanceddb_settings_toggle_clicked');
};

export const trackInfluxDBConfigV2AdvancedDbConnectionSettingsHTTPMethodClicked = () => {
  reportInteraction('influxdb_config_v2_advanceddb_settings_http_method_clicked');
};

export const trackInfluxDBConfigV2AdvancedDbConnectionSettingsInsecureConnectClicked = () => {
  reportInteraction('influxdb_config_v2_advanceddb_settings_insecure_connection_clicked');
};

export const trackInfluxDBConfigV2AdvancedDbConnectionSettingsMinTimeClicked = () => {
  reportInteraction('influxdb_config_v2_advanceddb_settings_min_time_clicked');
};

// Advanced HTTP Settings
export const trackInfluxDBConfigV2AdvancedHTTPSettingsToggleClicked = () => {
  reportInteraction('influxdb_config_v2_advanced_http_settings_toggle_clicked');
};

export const trackInfluxDBConfigV2AdvancedHTTPSettingsTimeoutField = () => {
  reportInteraction('influxdb_config_v2_advanced_http_settings_timeout_field');
};

// Auth Settings
export const trackInfluxDBConfigV2AuthSettingsToggleClicked = () => {
  reportInteraction('influxdb_config_v2_auth_settings_toggle_clicked');
};

export const trackInfluxDBConfigV2AuthSettingsAuthMethodSelected = (props: { authMethod: string }) => {
  reportInteraction('influxdb_config_v2_advanced_http_settings_timeout_field', props);
};
