import { DashboardLoadedEvent } from '@grafana/data';
import { getTemplateSrv, reportInteraction } from '@grafana/runtime';

import pluginJson from './plugin.json';
import { TempoQuery } from './types';

type TempoOnDashboardLoadedTrackingEvent = {
  grafana_version?: string;
  dashboard_id?: string;
  org_id?: number;
  service_map_query_count: number;
  traceql_query_count: number;
  upload_query_count: number;
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
      service_map_query_count: 0,
      traceql_query_count: 0,
      upload_query_count: 0,
      service_map_queries_with_template_variables_count: 0,
      traceql_queries_with_template_variables_count: 0,
    };

    for (const query of tempoQueries) {
      if (query.hide) {
        continue;
      }

      if (query.queryType === 'serviceMap') {
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

const hasTemplateVariables = (val?: string | string[]): boolean => {
  return (Array.isArray(val) ? val : [val]).some((v) => getTemplateSrv().containsTemplate(v));
};
