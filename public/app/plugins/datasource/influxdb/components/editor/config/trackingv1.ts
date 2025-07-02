import { reportInteraction } from '@grafana/runtime';

export const trackInfluxDBConfigV1QueryLanguageSelection = (props: { version: string }) => {
  reportInteraction('influxdb-configv1-query-language-dropdown', props);
};

// Flux Database Fields
export const trackInfluxDBConfigV1FluxOrgInputField = () => {
  reportInteraction('influxdb-configv1-flux-dbdetails-organization-input-field');
};

export const trackInfluxDBConfigV1FluxTokenInputField = () => {
  reportInteraction('influxdb-configv1-flux-dbdetails-token-input-field');
};

export const trackInfluxDBConfigV1FluxDefaultBucketInputField = () => {
  reportInteraction('influxdb-configv1-flux-dbdetails-default-bucket-input-field');
};

// InfluxQL Database Fields
export const trackInfluxDBConfigV1InfluxQLDatabaseInputField = () => {
  reportInteraction('influxdb-configv1-influxql-dbdetails-database-input-field');
};

export const trackInfluxDBConfigV1InfluxQLUserInputField = () => {
  reportInteraction('influxdb-configv1-influxql-dbdetails-user-input-field');
};

export const trackInfluxDBConfigV1InfluxQLPasswordInputField = () => {
  reportInteraction('influxdb-configv1-influxql-dbdetails-password-input-field');
};

// SQL Database Fields
export const trackInfluxDBConfigV1SQLDatabaseInputField = () => {
  reportInteraction('influxdb-configv1-sql-dbdetails-database-input-field');
};

export const trackInfluxDBConfigV1SQLTokenInputField = () => {
  reportInteraction('influxdb-configv1-sql-dbdetails-token-input-field');
};
