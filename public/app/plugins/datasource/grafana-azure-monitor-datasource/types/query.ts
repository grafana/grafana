import { DataQuery } from '@grafana/data';

export enum AzureQueryType {
  AzureMonitor = 'Azure Monitor',
  ApplicationInsights = 'Application Insights',
  InsightsAnalytics = 'Insights Analytics',
  LogAnalytics = 'Azure Log Analytics',
  AzureResourceGraph = 'Azure Resource Graph',
}

/**
 * Represents the query as it moves through the frontend query editor and datasource files.
 * It can represent new queries that are still being edited, so all properties are optional
 */
export interface AzureMonitorQuery extends DataQuery {
  queryType?: AzureQueryType;

  subscription?: string;

  /** ARG uses multiple subscriptions */
  subscriptions?: string[];

  azureMonitor?: AzureMetricQuery;
  azureLogAnalytics?: AzureLogsQuery;
  azureResourceGraph?: AzureResourceGraphQuery;

  /** @deprecated App Insights/Insights Analytics deprecated in v8 */
  appInsights?: ApplicationInsightsQuery;

  /** @deprecated App Insights/Insights Analytics deprecated in v8 */
  insightsAnalytics?: InsightsAnalyticsQuery;
}

/**
 * Azure Monitor Metrics sub-query properties
 */
export interface AzureMetricQuery {
  resourceGroup?: string;
  resourceName?: string;
  metricDefinition?: string;
  metricNamespace?: string;
  metricName?: string;
  timeGrain?: string;
  aggregation?: string;
  dimensionFilters?: AzureMetricDimension[];
  alias?: string;
  top?: string;

  /** @deprecated */
  timeGrainUnit?: string;

  /** @deprecated Remove this once angular is removed */
  allowedTimeGrainsMs?: number[];
}

/**
 * Azure Monitor Logs sub-query properties
 */
export interface AzureLogsQuery {
  query?: string;
  resultFormat?: string;
  resource?: string;

  workspace?: string;
}

/**
 * Azure Monitor ARG sub-query properties
 */
export interface AzureResourceGraphQuery {
  query?: string;
  resultFormat?: string;
}

/**
 * Azure Monitor App Insights sub-query properties
 * @deprecated App Insights deprecated in v8 in favor of Metrics queries
 */
export interface ApplicationInsightsQuery {
  metricName?: string;
  timeGrain?: string;
  timeGrainCount?: string;
  timeGrainType?: string;
  timeGrainUnit?: string;
  aggregation?: string;
  dimension?: string[]; // Was string before 7.1
  dimensionFilter?: string;
  alias?: string;
}

/**
 * Azure Monitor Insights Analytics sub-query properties
 * @deprecated Insights Analytics deprecated in v8 in favor of Logs queries
 */
export interface InsightsAnalyticsQuery {
  query?: string;
  resultFormat?: string;

  /** @deprecated Migrate field to query  */
  rawQueryString?: string;
}

export interface AzureMetricDimension {
  dimension: string;
  operator: string;
  filter?: string;
}
