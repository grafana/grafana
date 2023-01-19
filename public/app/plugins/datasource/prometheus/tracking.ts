import { CoreApp, DataQueryRequest, DataQueryResponse } from '@grafana/data';
import { reportInteraction, config } from '@grafana/runtime';

import { PromQuery } from './types';

export function trackQuery(
  response: DataQueryResponse,
  request: DataQueryRequest<PromQuery> & { targets: PromQuery[] },
  startTime: Date
): void {
  const { app, targets: queries } = request;
  // We do want to track panel-editor and explore
  // We do not want to track queries from the dashboard or viewing a panel
  // also included in the tracking is cloud-alerting, unified-alerting, and unknown
  if (app === CoreApp.Dashboard || app === CoreApp.PanelViewer) {
    return;
  }

  for (const query of queries) {
    reportInteraction('grafana_prometheus_query_executed', {
      app,
      grafana_version: config.buildInfo.version,
      has_data: response.data.some((frame) => frame.length > 0),
      has_error: response.error !== undefined,
      expr: query.expr,
      format: query.format,
      instant: query.instant,
      range: query.range,
      exemplar: query.exemplar,
      hinting: query.hinting,
      interval: query.interval,
      intervalFactor: query.intervalFactor,
      utcOffsetSec: query.utcOffsetSec,
      legend: query.legendFormat,
      valueWithRefId: query.valueWithRefId,
      requestId: query.requestId,
      showingGraph: query.showingGraph,
      showingTable: query.showingTable,
      editor_mode: query.editorMode,
      simultaneously_sent_query_count: queries.length,
      time_range_from: request?.range?.from?.toISOString(),
      time_range_to: request?.range?.to?.toISOString(),
      time_taken: Date.now() - startTime.getTime(),
    });
  }
}
