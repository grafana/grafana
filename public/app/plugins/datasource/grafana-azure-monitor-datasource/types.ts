import { DataQuery, DataSourceJsonData } from '@grafana/ui/src/types';

export interface AzureMonitorQuery extends DataQuery {
  format: string;
  subscription: string;
  azureMonitor: AzureMetricQuery;
  azureLogAnalytics: AzureLogsQuery;
  //   appInsights: any;
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
  azureLogAnalyticsSameAs?: string;
  logAnalyticsDefaultWorkspace?: string;

  // App Insights
  appInsightsAppId?: string;
}

export interface AzureMetricQuery {
  resourceGroup: string;
  resourceName: string;
  metricDefinition: string;
  metricName: string;
  timeGrainUnit: string;
  timeGrain: string;
  timeGrains: string[];
  aggregation: string;
  dimension: string;
  dimensionFilter: string;
  alias: string;
}

export interface AzureLogsQuery {
  query: string;
  resultFormat: string;
  workspace: string;
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
