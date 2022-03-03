import { DataQuery } from '@grafana/data';

import {
  AzureLogsQuery,
  AzureMetricQuery,
  AzureQueryType,
  AzureResourceGraphQuery,
  DeprecatedAzureQueryType,
} from '../../../types';
import { GrafanaTemplateVariableQuery } from '../../../types/templateVariables';

export interface DeprecatedAzureMonitorQuery extends DataQuery {
  queryType?: AzureQueryType | DeprecatedAzureQueryType;

  subscription?: string;

  /** ARG uses multiple subscriptions */
  subscriptions?: string[];

  azureMonitor?: AzureMetricQuery;
  azureLogAnalytics?: AzureLogsQuery;
  azureResourceGraph?: AzureResourceGraphQuery;
  grafanaTemplateVariableFn?: GrafanaTemplateVariableQuery;

  /** @deprecated App Insights/Insights Analytics deprecated in v8 */
  appInsights?: ApplicationInsightsQuery;

  /** @deprecated App Insights/Insights Analytics deprecated in v8 */
  insightsAnalytics?: InsightsAnalyticsQuery;
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

  /** @deprecated Migrated to Insights Analytics query  */
  rawQuery?: string;
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
