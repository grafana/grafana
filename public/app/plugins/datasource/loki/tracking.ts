import { DataQueryResponse } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';

import { isLogsQuery, parseToArray } from './queryUtils';
import { LokiQuery } from './types';

export function trackQuery(response: DataQueryResponse, queries: LokiQuery[], app: string): void {
  for (const query of queries) {
    reportInteraction('grafana_loki_query_executed', {
      app,
      editor_mode: query.editorMode,
      has_data: response.data.some((frame) => frame.length > 0),
      has_error: response.error !== undefined,
      legend: query.legendFormat,
      line_limit: query.maxLines,
      parsed_query: parseToArray(query.expr),
      query_type: isLogsQuery(query.expr) ? 'logs' : 'metrics',
      query_vector_type: query.queryType,
      resolution: query.resolution,
      simultaneously_sent_query_count: queries.length,
    });
  }
}
