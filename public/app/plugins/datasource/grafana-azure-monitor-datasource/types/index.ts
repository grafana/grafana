import {
  DataQuery,
  DataSourceInstanceSettings,
  DataSourceJsonData,
  DataSourceSettings,
  TableData,
} from '@grafana/data';
import Datasource from '../datasource';

export type AzureDataSourceSettings = DataSourceSettings<AzureDataSourceJsonData, AzureDataSourceSecureJsonData>;
export type AzureDataSourceInstanceSettings = DataSourceInstanceSettings<AzureDataSourceJsonData>;

export interface DatasourceValidationResult {
  status: 'success' | 'error';
  message: string;
  title?: string;
}

export type AzureResultFormat = 'time_series' | 'table';

export enum AzureQueryType {
  AzureMonitor = 'Azure Monitor',
  ApplicationInsights = 'Application Insights',
  InsightsAnalytics = 'Insights Analytics',
  LogAnalytics = 'Azure Log Analytics',
  AzureResourceGraph = 'Azure Resource Graph',
}

export interface AzureMonitorQuery extends DataQuery {
  queryType: AzureQueryType;
  format: string;
  subscription: string;
  subscriptions: string[];

  azureMonitor: AzureMetricQuery;
  azureLogAnalytics: AzureLogsQuery;
  appInsights?: ApplicationInsightsQuery;
  insightsAnalytics: InsightsAnalyticsQuery;
  azureResourceGraph: AzureResourceGraphQuery;
}

/**
 * Azure clouds known to Azure Monitor.
 */
export enum AzureCloud {
  Public = 'AzureCloud',
  China = 'AzureChinaCloud',
  USGovernment = 'AzureUSGovernment',
  Germany = 'AzureGermanCloud',
  None = '',
}

export type AzureAuthType = 'msi' | 'clientsecret';

export type ConcealedSecret = symbol;

interface AzureCredentialsBase {
  authType: AzureAuthType;
  defaultSubscriptionId?: string;
}

export interface AzureManagedIdentityCredentials extends AzureCredentialsBase {
  authType: 'msi';
}

export interface AzureClientSecretCredentials extends AzureCredentialsBase {
  authType: 'clientsecret';
  azureCloud?: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string | ConcealedSecret;
}

export type AzureCredentials = AzureManagedIdentityCredentials | AzureClientSecretCredentials;

export interface AzureDataSourceJsonData extends DataSourceJsonData {
  cloudName: string;
  azureAuthType?: AzureAuthType;

  // monitor
  tenantId?: string;
  clientId?: string;
  subscriptionId?: string;

  // logs
  azureLogAnalyticsSameAs?: boolean;
  logAnalyticsTenantId?: string;
  logAnalyticsClientId?: string;
  logAnalyticsSubscriptionId?: string;
  logAnalyticsDefaultWorkspace?: string;

  // App Insights
  appInsightsAppId?: string;
}

export interface AzureDataSourceSecureJsonData {
  clientSecret?: string;
  logAnalyticsClientSecret?: string;
  appInsightsApiKey?: string;
}

export interface AzureMetricDimension {
  dimension: string;
  operator: 'eq'; // future proof
  filter?: string; // *
}

export interface AzureMetricQuery {
  resourceGroup: string | undefined;
  resourceName: string | undefined;
  metricDefinition: string | undefined;
  metricNamespace: string | undefined;
  metricName: string | undefined;
  timeGrainUnit?: string;
  timeGrain: string;
  allowedTimeGrainsMs: number[];
  aggregation: string | undefined;
  dimensionFilters: AzureMetricDimension[];
  alias: string;
  top: string;
}

export interface AzureLogsQuery {
  query: string;
  resultFormat: string;
  resource?: string;

  /** @deprecated Queries should be migrated to use Resource instead */
  workspace?: string;
}

export interface AzureResourceGraphQuery {
  query: string;
  resultFormat: string;
}

export interface ApplicationInsightsQuery {
  metricName: string;
  timeGrain: string;
  timeGrainCount: string;
  timeGrainType: string;
  timeGrainUnit: string;
  aggregation: string;
  dimension: string[]; // Was string before 7.1
  // dimensions: string[]; why is this metadata stored on the object!
  dimensionFilter: string;
  alias: string;
}

export interface InsightsAnalyticsQuery {
  query: string;
  resultFormat: string;
}

// Represents an errors that come back from frontend requests.
// Not totally sure how accurate this type is.
export type AzureMonitorErrorish = Error;

// Azure Monitor API Types

export interface AzureMonitorMetricsMetadataResponse {
  value: AzureMonitorMetricMetadataItem[];
}

export interface AzureMonitorMetricMetadataItem {
  id: string;
  resourceId: string;
  primaryAggregationType: string;
  supportedAggregationTypes: string[];
  name: AzureMonitorLocalizedValue;
  dimensions?: AzureMonitorLocalizedValue[];
  metricAvailabilities?: AzureMonitorMetricAvailabilityMetadata[];
}

export interface AzureMonitorMetricAvailabilityMetadata {
  timeGrain: string;
  retention: string;
}

export interface AzureMonitorLocalizedValue {
  value: string;
  localizedValue: string;
}

export interface AzureMonitorMetricDefinitionsResponse {
  data: {
    value: Array<{ name: string; type: string; location?: string }>;
  };
  status: number;
  statusText: string;
}

export interface AzureMonitorResourceGroupsResponse {
  data: {
    value: Array<{ name: string }>;
  };
  status: number;
  statusText: string;
}

export interface AzureLogsVariable {
  text: string;
  value: string;
}

export interface AzureLogsTableData extends TableData {
  columns: AzureLogsTableColumn[];
  rows: any[];
  type: string;
}

export interface AzureLogsTableColumn {
  text: string;
  type: string;
}

export interface AzureMonitorOption<T = string> {
  label: string;
  value: T;
}

export interface AzureQueryEditorFieldProps {
  query: AzureMonitorQuery;
  datasource: Datasource;
  subscriptionId: string;
  variableOptionGroup: { label: string; options: AzureMonitorOption[] };

  onQueryChange: (newQuery: AzureMonitorQuery) => void;
  setError: (source: string, error: AzureMonitorErrorish | undefined) => void;
}

export interface AzureResourceSummaryItem {
  id: string;
  name: string;
  subscriptionName: string;
  resourceGroupName: string;
}

export interface RawAzureResourceGroupItem {
  subscriptionURI: string;
  subscriptionName: string;

  resourceGroupURI: string;
  resourceGroupName: string;
}

export interface RawAzureResourceItem {
  id: string;
  name: string;
  subscriptionId: string;
  resourceGroup: string;
  type: string;
  location: string;
}

export interface AzureGraphResponse<T = unknown> {
  data: T;
}
