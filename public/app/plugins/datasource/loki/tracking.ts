import { DashboardLoadedEvent } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { variableRegex } from 'app/features/variables/utils';

import { QueryEditorMode } from '../prometheus/querybuilder/shared/types';

import pluginJson from './plugin.json';
import { getNormalizedLokiQuery, isLogsQuery } from './queryUtils';
import { LokiQuery, LokiQueryType } from './types';

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
      .filter((query) => !query.hide)
      .map((query) => getNormalizedLokiQuery(query));

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
  return query.maxLines !== null || query.maxLines !== undefined;
};

const isQueryWithChangedLegend = (query: LokiQuery): boolean => {
  if (!query.legendFormat) {
    return false;
  }
  return query.legendFormat !== '';
};
