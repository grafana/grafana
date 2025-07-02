import { reportInteraction } from '@grafana/runtime';

export const trackInfluxDBConfigV1QueryLanguageSelection = (props: { version: string }) => {
  reportInteraction('influxdb_configv1_query_language_dropdown', props);
};

// Flux Database Fields
export const trackInfluxDBConfigV1FluxOrgInputField = () => {
  reportInteraction('influxdb_configv1_flux_dbdetails_organization_input_field');
};

export const trackInfluxDBConfigV1FluxTokenInputField = () => {
  reportInteraction('influxdb_configv1_flux_dbdetails_token_input_field');
};

export const trackInfluxDBConfigV1FluxDefaultBucketInputField = () => {
  reportInteraction('influxdb_configv1_flux_dbdetails_default_bucket_input_field');
};

// InfluxQL Database Fields
export const trackInfluxDBConfigV1InfluxQLDatabaseInputField = () => {
  reportInteraction('influxdb_configv1_influxql_dbdetails_database_input_field');
};

export const trackInfluxDBConfigV1InfluxQLUserInputField = () => {
  reportInteraction('influxdb_configv1_influxql_dbdetails_user_input_field');
};

export const trackInfluxDBConfigV1InfluxQLPasswordInputField = () => {
  reportInteraction('influxdb_configv1_influxql_dbdetails_password_input_field');
};

// SQL Database Fields
export const trackInfluxDBConfigV1SQLDatabaseInputField = () => {
  reportInteraction('influxdb_configv1_sql_dbdetails_database_input_field');
};

export const trackInfluxDBConfigV1SQLTokenInputField = () => {
  reportInteraction('influxdb_configv1_sql_dbdetails_token_input_field');
};
