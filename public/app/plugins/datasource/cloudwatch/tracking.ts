import { DashboardLoadedEvent } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';

import { isCloudWatchLogsQuery, isCloudWatchMetricsQuery, isCloudWatchQuery } from './guards';
import pluginJson from './plugin.json';
import { CloudWatchMetricsQuery, MetricEditorMode, MetricQueryType } from './types';

interface CloudWatchOnDashboardLoadedTrackingEvent {
  grafana_version?: string;
  dashboard_id?: string;
  org_id?: number;
  user_id?: number;
  grafanaVersion?: string;

  /* The number of CloudWatch logs queries present in the dashboard*/
  logs_queries_count?: number;

  /* The number of CloudWatch CW metrics queries present in the dashboard*/
  metrics_queries_count: number;

  /* The number of queries using the "Search" mode. Should be measured in relation to metrics_queries_count */
  metrics_search_count: number;

  /* The number of search queries that are using the builder mode. Should be measured in relation to metrics_search_count */
  metrics_search_builder_count: number;

  /* The number of search queries that are using the code mode. Should be measured in relation to metrics_search_count */
  metrics_search_code_count: number;

  /* The number of search queries that have enabled the `match exact` toggle in the builder mode. Should be measured in relation to metrics_search_builder_count */
  metrics_search_match_exact_count: number;

  /* The number of queries using the "Query" mode (AKA Metric Insights). Should be measured in relation to metrics_queries_count */
  metrics_query_count: number;

  /* The number of "Insights" queries that are using the builder mode. Should be measured in relation to metrics_query_count */
  metrics_query_builder_count: number;

  /* The number of "Insights" queries that are using the code mode. Should be measured in relation to metrics_query_count */
  metrics_query_code_count: number;
}

export const onDashboardLoadedHandler = ({
  payload: { dashboardId, orgId, userId, grafanaVersion, queries },
}: DashboardLoadedEvent) => {
  try {
    const dataQueries = queries[pluginJson.id];
    const cloudWatchQueries = dataQueries && dataQueries.filter(isCloudWatchQuery);
    if (cloudWatchQueries?.length) {
      const logsQueries = cloudWatchQueries.filter(isCloudWatchLogsQuery);
      const metricsQueries = cloudWatchQueries.filter(isCloudWatchMetricsQuery);

      const e: CloudWatchOnDashboardLoadedTrackingEvent = {
        grafana_version: grafanaVersion,
        dashboard_id: dashboardId,
        org_id: orgId,
        user_id: userId,
        logs_queries_count: logsQueries?.length,
        metrics_queries_count: metricsQueries?.length,
        metrics_search_count: 0,
        metrics_search_builder_count: 0,
        metrics_search_code_count: 0,
        metrics_search_match_exact_count: 0,
        metrics_query_count: 0,
        metrics_query_builder_count: 0,
        metrics_query_code_count: 0,
      };

      for (const q of metricsQueries) {
        e.metrics_search_count += +Boolean(q.metricQueryType === MetricQueryType.Search);
        e.metrics_search_builder_count += +isMetricSearchBuilder(q);
        e.metrics_search_code_count += +Boolean(
          q.metricQueryType === MetricQueryType.Search && q.metricEditorMode === MetricEditorMode.Code
        );
        e.metrics_search_match_exact_count += +Boolean(isMetricSearchBuilder(q) && q.matchExact);
        e.metrics_query_count += +Boolean(q.metricQueryType === MetricQueryType.Query);
        e.metrics_query_builder_count += +Boolean(
          q.metricQueryType === MetricQueryType.Query && q.metricEditorMode === MetricEditorMode.Builder
        );
        e.metrics_query_code_count += +Boolean(
          q.metricQueryType === MetricQueryType.Query && q.metricEditorMode === MetricEditorMode.Code
        );
      }

      reportInteraction('grafana_ds_cloudwatch_dashboard_loaded', e);
    }
  } catch (error) {
    console.error('error in cloudwatch tracking handler', error);
  }
};

const isMetricSearchBuilder = (q: CloudWatchMetricsQuery) =>
  Boolean(q.metricQueryType === MetricQueryType.Search && q.metricEditorMode === MetricEditorMode.Builder);
