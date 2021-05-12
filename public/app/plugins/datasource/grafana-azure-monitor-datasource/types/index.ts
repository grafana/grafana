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

export type ConcealedSecret = symbol;

export interface AzureCredentials {
  azureCloud?: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string | ConcealedSecret;
}

export interface AzureDataSourceJsonData extends DataSourceJsonData {
  cloudName: string;

  // monitor
  tenantId?: string;
  clientId?: string;
  subscriptionId: string;

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
  workspace: string;
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
