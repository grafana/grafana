import { DataQuery } from '@grafana/data';

import { GrafanaTemplateVariableQuery } from './templateVariables';

export enum AzureQueryType {
  AzureMonitor = 'Azure Monitor',
  LogAnalytics = 'Azure Log Analytics',
  AzureResourceGraph = 'Azure Resource Graph',
  SubscriptionsQuery = 'Azure Subscriptions',
  ResourceGroupsQuery = 'Azure Resource Groups',
  NamespacesQuery = 'Azure Namespaces',
  ResourceNamesQuery = 'Azure Resource Names',
  MetricNamesQuery = 'Azure Metric Names',
  WorkspacesQuery = 'Azure Workspaces',
  /** Deprecated */
  GrafanaTemplateVariableFn = 'Grafana Template Variable Function',
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
  grafanaTemplateVariableFn?: GrafanaTemplateVariableQuery;

  /** Template variables params */
  resourceGroup?: string;
  namespace?: string;
  resource?: string;
}

/**
 * Azure Monitor Metrics sub-query properties
 */
export interface AzureMetricQuery {
  resourceGroup?: string;
  resourceName?: string;
  /** metricNamespace is used as the resource type (or resource namespace).
   * It's usually equal to the target metric namespace.
   * Kept the name of the variable as metricNamespace to avoid backward incompatibility issues.
   */
  metricNamespace?: string;
  /** used as the value for the metricNamespace param when different from the resource namespace */
  customNamespace?: string;
  metricName?: string;
  timeGrain?: string;
  aggregation?: string;
  dimensionFilters?: AzureMetricDimension[];
  alias?: string;
  top?: string;
  allowedTimeGrainsMs?: number[];

  /** @deprecated */
  timeGrainUnit?: string;

  /** @deprecated This property was migrated to dimensionFilters and should only be accessed in the migration */
  dimension?: string;

  /** @deprecated This property was migrated to dimensionFilters and should only be accessed in the migration */
  dimensionFilter?: string;

  /** @deprecated Use metricNamespace instead */
  metricDefinition?: string;

  /** @deprecated Use resourceGroup, resourceName and metricNamespace instead */
  resourceUri?: string;
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

export interface AzureMetricDimension {
  dimension: string;
  operator: string;
  filters?: string[];
  /**
   * @deprecated filter is deprecated in favour of filters to support multiselect
   */
  filter?: string;
}

export interface AzureMetricResource {
  subscription?: string;
  resourceGroup?: string;
  resourceName?: string;
  metricNamespace?: string;
}
