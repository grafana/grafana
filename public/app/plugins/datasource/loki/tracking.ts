import { CoreApp, DashboardLoadedEvent, DataQueryRequest, DataQueryResponse } from '@grafana/data';
import { QueryEditorMode } from '@grafana/plugin-ui';
import { reportInteraction, config } from '@grafana/runtime';

import {
  REF_ID_STARTER_ANNOTATION,
  REF_ID_DATA_SAMPLES,
  REF_ID_STARTER_LOG_ROW_CONTEXT,
  REF_ID_STARTER_LOG_VOLUME,
  REF_ID_STARTER_LOG_SAMPLE,
} from './datasource';
import pluginJson from './plugin.json';
import { getNormalizedLokiQuery, isLogsQuery, obfuscate } from './queryUtils';
import { variableRegex } from './querybuilder/parsingUtils';
import { LokiGroupedRequest, LokiQuery, LokiQueryType } from './types';

type LokiOnDashboardLoadedTrackingEvent = {
  grafana_version?: string;
  dashboard_id?: string;
  org_id?: number;

  /* The number of Loki queries present in the dashboard*/
  queries_count: number;

  /* The number of Loki logs queries present in the dashboard*/
  logs_queries_count: number;

  /* The number of Loki metric queries present in the dashboard*/
  metric_queries_count: number;

  /* The number of Loki instant queries present in the dashboard*/
  instant_queries_count: number;

  /* The number of Loki range queries present in the dashboard*/
  range_queries_count: number;

  /* The number of Loki queries created in builder mode present in the dashboard*/
  builder_mode_queries_count: number;

  /* The number of Loki queries created in code mode present in the dashboard*/
  code_mode_queries_count: number;

  /* The number of Loki queries with used template variables present in the dashboard*/
  queries_with_template_variables_count: number;

  /* The number of Loki queries with changed resolution present in the dashboard*/
  queries_with_changed_resolution_count: number;

  /* The number of Loki queries with changed line limit present in the dashboard*/
  queries_with_changed_line_limit_count: number;

  /* The number of Loki queries with changed legend present in the dashboard*/
  queries_with_changed_legend_count: number;
};

export const onDashboardLoadedHandler = ({
  payload: { dashboardId, orgId, grafanaVersion, queries },
}: DashboardLoadedEvent<LokiQuery>) => {
  try {
    // We only want to track visible Loki queries
    const lokiQueries = queries[pluginJson.id]
      ?.filter((query) => !query.hide)
      ?.map((query) => getNormalizedLokiQuery(query));

    if (!lokiQueries?.length) {
      return;
    }

    const logsQueries = lokiQueries.filter((query) => isLogsQuery(query.expr));
    const metricQueries = lokiQueries.filter((query) => !isLogsQuery(query.expr));
    const instantQueries = lokiQueries.filter((query) => query.queryType === LokiQueryType.Instant);
    const rangeQueries = lokiQueries.filter((query) => query.queryType === LokiQueryType.Range);
    const builderModeQueries = lokiQueries.filter((query) => query.editorMode === QueryEditorMode.Builder);
    const codeModeQueries = lokiQueries.filter((query) => query.editorMode === QueryEditorMode.Code);
    const queriesWithTemplateVariables = lokiQueries.filter(isQueryWithTemplateVariables);
    const queriesWithChangedResolution = lokiQueries.filter(isQueryWithChangedResolution);
    const queriesWithChangedLineLimit = lokiQueries.filter(isQueryWithChangedLineLimit);
    const queriesWithChangedLegend = lokiQueries.filter(isQueryWithChangedLegend);

    const event: LokiOnDashboardLoadedTrackingEvent = {
      grafana_version: grafanaVersion,
      dashboard_id: dashboardId,
      org_id: orgId,
      queries_count: lokiQueries.length,
      logs_queries_count: logsQueries.length,
      metric_queries_count: metricQueries.length,
      instant_queries_count: instantQueries.length,
      range_queries_count: rangeQueries.length,
      builder_mode_queries_count: builderModeQueries.length,
      code_mode_queries_count: codeModeQueries.length,
      queries_with_template_variables_count: queriesWithTemplateVariables.length,
      queries_with_changed_resolution_count: queriesWithChangedResolution.length,
      queries_with_changed_line_limit_count: queriesWithChangedLineLimit.length,
      queries_with_changed_legend_count: queriesWithChangedLegend.length,
    };

    reportInteraction('grafana_loki_dashboard_loaded', event);
  } catch (error) {
    console.error('error in loki tracking handler', error);
  }
};

const isQueryWithTemplateVariables = (query: LokiQuery): boolean => {
  return variableRegex.test(query.expr);
};

const isQueryWithChangedResolution = (query: LokiQuery): boolean => {
  if (!query.resolution) {
    return false;
  }
  // 1 is the default resolution
  return query.resolution !== 1;
};

const isQueryWithChangedLineLimit = (query: LokiQuery): boolean => {
  return query.maxLines !== null && query.maxLines !== undefined;
};

const isQueryWithChangedLegend = (query: LokiQuery): boolean => {
  if (!query.legendFormat) {
    return false;
  }
  return query.legendFormat !== '';
};

const shouldNotReportBasedOnRefId = (refId: string): boolean => {
  const starters = [
    REF_ID_STARTER_ANNOTATION,
    REF_ID_STARTER_LOG_ROW_CONTEXT,
    REF_ID_STARTER_LOG_VOLUME,
    REF_ID_STARTER_LOG_SAMPLE,
    REF_ID_DATA_SAMPLES,
  ];

  if (starters.some((starter) => refId.startsWith(starter))) {
    return true;
  }
  return false;
};

const calculateTotalBytes = (response: DataQueryResponse): number => {
  let totalBytes = 0;
  for (const frame of response.data) {
    const byteKey = frame.meta?.custom?.lokiQueryStatKey;
    if (byteKey) {
      totalBytes +=
        frame.meta?.stats?.find((stat: { displayName: string }) => stat.displayName === byteKey)?.value ?? 0;
    }
  }
  return totalBytes;
};

export function trackQuery(
  response: DataQueryResponse,
  request: DataQueryRequest<LokiQuery>,
  startTime: Date,
  extraPayload: Record<string, unknown> = {}
): void {
  // We only want to track usage for these specific apps
  const { app, targets: queries } = request;

  if (app !== CoreApp.Explore) {
    return;
  }

  let totalBytes = calculateTotalBytes(response);

  for (const query of queries) {
    if (shouldNotReportBasedOnRefId(query.refId)) {
      return;
    }

    reportInteraction('grafana_explore_loki_query_executed', {
      grafana_version: config.buildInfo.version,
      editor_mode: query.editorMode,
      has_data: response.data.some((frame) => frame.length > 0),
      has_error: response.error !== undefined,
      legend: query.legendFormat,
      line_limit: query.maxLines,
      obfuscated_query: obfuscate(query.expr),
      query_type: isLogsQuery(query.expr) ? 'logs' : 'metric',
      query_vector_type: query.queryType,
      resolution: query.resolution,
      simultaneously_executed_query_count: queries.filter((query) => !query.hide).length,
      simultaneously_hidden_query_count: queries.filter((query) => query.hide).length,
      time_range_from: request?.range?.from?.toISOString(),
      time_range_to: request?.range?.to?.toISOString(),
      time_taken: Date.now() - startTime.getTime(),
      bytes_processed: totalBytes,
      is_split: false,
      ...extraPayload,
    });
  }
}

export function trackGroupedQueries(
  response: DataQueryResponse,
  groupedRequests: LokiGroupedRequest[],
  originalRequest: DataQueryRequest<LokiQuery>,
  startTime: Date
): void {
  const splittingPayload = {
    split_query_group_count: groupedRequests.length,
    split_query_largest_partition_size: Math.max(...groupedRequests.map(({ partition }) => partition.length)),
    split_query_total_request_count: groupedRequests.reduce((total, { partition }) => total + partition.length, 0),
    is_split: true,
    simultaneously_executed_query_count: originalRequest.targets.filter((query) => !query.hide).length,
    simultaneously_hidden_query_count: originalRequest.targets.filter((query) => query.hide).length,
  };

  for (const group of groupedRequests) {
    const split_query_partition_size = group.partition.length;
    trackQuery(response, group.request, startTime, {
      ...splittingPayload,
      split_query_partition_size,
    });
  }
}
