import { DataQuery, DataSourceJsonData, DataSourceSettings } from '@grafana/data';

export type AzureDataSourceSettings = DataSourceSettings<AzureDataSourceJsonData, AzureDataSourceSecureJsonData>;

export interface AzureMonitorQuery extends DataQuery {
  format: string;
  subscription: string;
  azureMonitor: AzureMetricQuery;
  azureLogAnalytics: AzureLogsQuery;
  appInsights: ApplicationInsightsQuery;
}

export interface AzureDataSourceJsonData extends DataSourceJsonData {
  subscriptionId: string;
  cloudName: string;

  // monitor
  tenantId?: string;
  clientId?: string;

  // logs
  logAnalyticsSubscriptionId?: string;
  logAnalyticsTenantId?: string;
  logAnalyticsClientId?: string;
  azureLogAnalyticsSameAs?: boolean;
  logAnalyticsDefaultWorkspace?: string;

  // App Insights
  appInsightsAppId?: string;
}

export interface AzureDataSourceSecureJsonData {
  clientSecret?: string;
  logAnalyticsClientSecret?: string;
  appInsightsApiKey?: string;
}

export interface AzureMetricQuery {
  resourceGroup: string;
  resourceName: string;
  metricDefinition: string;
  metricNamespace: string;
  metricName: string;
  timeGrainUnit: string;
  timeGrain: string;
  allowedTimeGrainsMs: number[];
  aggregation: string;
  dimension: string;
  dimensionFilter: string;
  alias: string;
  top: string;
}

export interface AzureLogsQuery {
  query: string;
  resultFormat: string;
  workspace: string;
}

export interface ApplicationInsightsQuery {
  rawQuery: boolean;
  rawQueryString: any;
  metricName: string;
  timeGrainUnit: string;
  timeGrain: string;
  allowedTimeGrainsMs: number[];
  aggregation: string;
  dimension: string;
  dimensionFilter: string;
  alias: string;
}

// Azure Monitor API Types

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

// Azure Log Analytics types
export interface KustoSchema {
  Databases: { [key: string]: KustoDatabase };
  Plugins: any[];
}
export interface KustoDatabase {
  Name: string;
  Tables: { [key: string]: KustoTable };
  Functions: { [key: string]: KustoFunction };
}

export interface KustoTable {
  Name: string;
  OrderedColumns: KustoColumn[];
}

export interface KustoColumn {
  Name: string;
  Type: string;
}

export interface KustoFunction {
  Name: string;
  DocString: string;
  Body: string;
  Folder: string;
  FunctionKind: string;
  InputParameters: any[];
  OutputColumns: any[];
}

export interface AzureLogsVariable {
  text: string;
  value: string;
}

export interface AzureLogsTableData {
  columns: AzureLogsTableColumn[];
  rows: any[];
  type: string;
  refId: string;
  meta: {
    query: string;
  };
}

export interface AzureLogsTableColumn {
  text: string;
  type: string;
}
