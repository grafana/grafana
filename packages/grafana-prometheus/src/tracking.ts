// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/tracking.ts
import { Identifier, NumberDurationLiteral, parser, StringLiteral } from '@prometheus-io/lezer-promql';

import { CoreApp, DataQueryRequest, DataQueryResponse } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';

import { PromQuery } from './types';

const tagsToObscure = [StringLiteral, Identifier, NumberDurationLiteral];
const partsToKeep = [
  '__name__',
  '__interval',
  '__interval_ms',
  '__rate_interval',
  '__range',
  '__range_s',
  '__range_ms',
];

export function obfuscate(query: string): string {
  let obfuscatedQuery: string = query;
  const tree = parser.parse(query);
  tree.iterate({
    enter: ({ type, from, to }): false | void => {
      const queryPart = query.substring(from, to);
      if (tagsToObscure.includes(type.id) && !partsToKeep.includes(queryPart)) {
        obfuscatedQuery = obfuscatedQuery.replace(queryPart, type.name);
      }
    },
  });
  return obfuscatedQuery;
}

export function trackQuery(
  response: DataQueryResponse,
  request: DataQueryRequest<PromQuery> & { targets: PromQuery[] },
  startTime: Date
): void {
  const { app, targets: queries } = request;
  // We only track queries run in Explore.
  // We do not want to track queries from the dashboard, viewing a panel,
  // cloud-alerting, unified-alerting, scenes and unknown
  if (app !== CoreApp.Explore) {
    return;
  }

  for (const query of queries) {
    reportInteraction('grafana_prometheus_query_executed', {
      app,
      grafana_version: config.buildInfo.version,
      has_data: response.data.some((frame) => frame.length > 0),
      has_error: response.error !== undefined,
      expr: query.expr,
      obfuscated_query: obfuscate(query.expr),
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
      requestId: request.requestId,
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
