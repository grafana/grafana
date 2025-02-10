import { DashboardLoadedEvent } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';

import { isCloudWatchLogsQuery, isCloudWatchMetricsQuery } from './guards';
import { migrateMetricQuery } from './migrations/metricQueryMigrations';
import pluginJson from './plugin.json';
import {
  CloudWatchLogsQuery,
  CloudWatchMetricsQuery,
  CloudWatchQuery,
  LogsQueryLanguage,
  MetricEditorMode,
  MetricQueryType,
} from './types';
import { filterMetricsQuery } from './utils/utils';

type CloudWatchOnDashboardLoadedTrackingEvent = {
  grafana_version?: string;
  dashboard_id?: string;
  org_id?: number;

  /* The number of CloudWatch logs queries present in the dashboard*/
  logs_queries_count: number;

  /* The number of Logs queries that use Logs Insights query language */
  logs_cwli_queries_count: number;

  /* The number of Logs queries that use SQL language */
  logs_sql_queries_count: number;

  /* The number of Logs queries that use PPL language */
  logs_ppl_queries_count: number;

  /* The number of CloudWatch metrics queries present in the dashboard*/
  metrics_queries_count: number;

  /* The number of queries using the "Search" mode. 
  Should be measured in relation to metrics_queries_count, e.g metrics_search_count + metrics_query_count = metrics_queries_count */
  metrics_search_count: number;

  /* The number of search queries that are using the builder mode. 
  Should be measured in relation to metrics_search_count, e.g metrics_search_builder_count + metrics_search_code_count = metrics_search_count */
  metrics_search_builder_count: number;

  /* The number of search queries that are using the code mode. 
  Should be measured in relation to metrics_search_count, e.g metrics_search_builder_count + metrics_search_code_count = metrics_search_count */
  metrics_search_code_count: number;

  /* The number of search queries that have enabled the `match exact` toggle in the builder mode. 
  Should be measured in relation to metrics_search_builder_count. 
  E.g 'Out of 5 metric seach queries (metrics_search_builder_count), 2 had match exact toggle (metrics_search_match_exact_count) enabled */
  metrics_search_match_exact_count: number;

  /* The number of queries using the "Query" mode (AKA Metric Insights). 
  Should be measured in relation to metrics_queries_count, e.g metrics_search_count + metrics_query_count = metrics_queries_count */
  metrics_query_count: number;

  /* The number of "Insights" queries that are using the builder mode. 
  Should be measured in relation to metrics_query_count, e.g metrics_query_builder_count + metrics_query_code_count = metrics_query_count */
  metrics_query_builder_count: number;

  /* The number of "Insights" queries that are using the code mode. 
  Should be measured in relation to metrics_query_count, e.g metrics_query_builder_count + metrics_query_code_count = metrics_query_count */
  metrics_query_code_count: number;

  /* The number of CloudWatch metrics queries that have specified an account in its cross account metric stat query */
  metrics_queries_with_account_count: number;
};

export const onDashboardLoadedHandler = ({
  payload: { dashboardId, orgId, grafanaVersion, queries },
}: DashboardLoadedEvent<CloudWatchQuery>) => {
  try {
    const cloudWatchQueries = queries[pluginJson.id];

    if (!cloudWatchQueries?.length) {
      return;
    }

    let logsQueries: CloudWatchLogsQuery[] = [];
    let metricsQueries: CloudWatchMetricsQuery[] = [];

    for (const query of cloudWatchQueries) {
      if (query.hide) {
        continue;
      }

      if (isCloudWatchLogsQuery(query)) {
        query.logGroupNames?.length && logsQueries.push(query);
      } else if (isCloudWatchMetricsQuery(query)) {
        const migratedQuery = migrateMetricQuery(query);
        filterMetricsQuery(migratedQuery) && metricsQueries.push(query);
      }
    }

    const e: CloudWatchOnDashboardLoadedTrackingEvent = {
      grafana_version: grafanaVersion,
      dashboard_id: dashboardId,
      org_id: orgId,
      logs_queries_count: logsQueries?.length,
      logs_cwli_queries_count: logsQueries?.filter(
        (q) => !q.queryLanguage || q.queryLanguage === LogsQueryLanguage.CWLI
      ).length,
      logs_sql_queries_count: logsQueries?.filter((q) => q.queryLanguage === LogsQueryLanguage.SQL).length,
      logs_ppl_queries_count: logsQueries?.filter((q) => q.queryLanguage === LogsQueryLanguage.PPL).length,
      metrics_queries_count: metricsQueries?.length,
      metrics_search_count: 0,
      metrics_search_builder_count: 0,
      metrics_search_code_count: 0,
      metrics_search_match_exact_count: 0,
      metrics_query_count: 0,
      metrics_query_builder_count: 0,
      metrics_query_code_count: 0,
      metrics_queries_with_account_count: 0,
    };

    for (const q of metricsQueries) {
      e.metrics_search_count += +Boolean(q.metricQueryType === MetricQueryType.Search);
      e.metrics_search_builder_count += +isMetricSearchBuilder(q);
      e.metrics_search_code_count += +Boolean(
        q.metricQueryType === MetricQueryType.Search && q.metricEditorMode === MetricEditorMode.Code
      );
      e.metrics_search_match_exact_count += +Boolean(isMetricSearchBuilder(q) && q.matchExact);
      e.metrics_query_count += +Boolean(q.metricQueryType === MetricQueryType.Insights);
      e.metrics_query_builder_count += +Boolean(
        q.metricQueryType === MetricQueryType.Insights && q.metricEditorMode === MetricEditorMode.Builder
      );
      e.metrics_query_code_count += +Boolean(
        q.metricQueryType === MetricQueryType.Insights && q.metricEditorMode === MetricEditorMode.Code
      );
      e.metrics_queries_with_account_count += +Boolean(
        config.featureToggles.cloudWatchCrossAccountQuerying && isMetricSearchBuilder(q) && q.accountId
      );
    }

    reportInteraction('grafana_ds_cloudwatch_dashboard_loaded', e);
  } catch (error) {
    console.error('error in cloudwatch tracking handler', error);
  }
};

type SampleQueryTrackingEvent = {
  queryLanguage: LogsQueryLanguage;
  queryCategory: string;
};

export const trackSampleQuerySelection = (props: SampleQueryTrackingEvent) => {
  const { queryLanguage, queryCategory } = props;
  reportInteraction('cloudwatch-logs-cheat-sheet-query-clicked', { queryLanguage, queryCategory });
};

const isMetricSearchBuilder = (q: CloudWatchMetricsQuery) =>
  Boolean(q.metricQueryType === MetricQueryType.Search && q.metricEditorMode === MetricEditorMode.Builder);
