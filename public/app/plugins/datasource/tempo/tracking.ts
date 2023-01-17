import { DashboardLoadedEvent } from '@grafana/data';
import { getTemplateSrv, reportInteraction } from '@grafana/runtime';

import pluginJson from './plugin.json';
import { TempoQuery } from './types';

type TempoOnDashboardLoadedTrackingEvent = {
  grafana_version?: string;
  dashboard_id?: string;
  org_id?: number;
  native_search_query_count: number;
  search_query_count: number;
  service_map_query_count: number;
  traceql_query_count: number;
  upload_query_count: number;
  native_search_queries_with_template_variables_count: number;
  search_queries_with_template_variables_count: number;
  service_map_queries_with_template_variables_count: number;
  traceql_queries_with_template_variables_count: number;
};

export const onDashboardLoadedHandler = ({
  payload: { dashboardId, orgId, grafanaVersion, queries },
}: DashboardLoadedEvent<TempoQuery>) => {
  try {
    const tempoQueries = queries[pluginJson.id];

    if (!tempoQueries?.length) {
      return;
    }

    let stats: TempoOnDashboardLoadedTrackingEvent = {
      grafana_version: grafanaVersion,
      dashboard_id: dashboardId,
      org_id: orgId,
      native_search_query_count: 0,
      search_query_count: 0,
      service_map_query_count: 0,
      traceql_query_count: 0,
      upload_query_count: 0,
      native_search_queries_with_template_variables_count: 0,
      search_queries_with_template_variables_count: 0,
      service_map_queries_with_template_variables_count: 0,
      traceql_queries_with_template_variables_count: 0,
    };

    for (const query of tempoQueries) {
      if (query.hide) {
        continue;
      }

      if (query.queryType === 'nativeSearch') {
        stats.native_search_query_count++;
        if (
          (query.serviceName && hasTemplateVariables(query.serviceName)) ||
          (query.spanName && hasTemplateVariables(query.spanName)) ||
          (query.search && hasTemplateVariables(query.search)) ||
          (query.minDuration && hasTemplateVariables(query.minDuration)) ||
          (query.maxDuration && hasTemplateVariables(query.maxDuration))
        ) {
          stats.native_search_queries_with_template_variables_count++;
        }
      } else if (query.queryType === 'search') {
        stats.search_query_count++;
        if (query.linkedQuery && query.linkedQuery.expr && hasTemplateVariables(query.linkedQuery.expr)) {
          stats.search_queries_with_template_variables_count++;
        }
      } else if (query.queryType === 'serviceMap') {
        stats.service_map_query_count++;
        if (query.serviceMapQuery && hasTemplateVariables(query.serviceMapQuery)) {
          stats.service_map_queries_with_template_variables_count++;
        }
      } else if (query.queryType === 'traceql') {
        stats.traceql_query_count++;
        if (hasTemplateVariables(query.query)) {
          stats.traceql_queries_with_template_variables_count++;
        }
      } else if (query.queryType === 'upload') {
        stats.upload_query_count++;
      }
    }

    reportInteraction('grafana_tempo_dashboard_loaded', stats);
  } catch (error) {
    console.error('error in tempo tracking handler', error);
  }
};

const hasTemplateVariables = (val: string): boolean => {
  return getTemplateSrv().containsTemplate(val);
};
