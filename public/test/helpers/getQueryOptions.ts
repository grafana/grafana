import { DataQueryRequest, DataQuery } from '@grafana/data';
import { dateTime } from '@grafana/data';

export function getQueryOptions<TQuery extends DataQuery>(
  options: Partial<DataQueryRequest<TQuery>>
): DataQueryRequest<TQuery> {
  const raw = { from: 'now', to: 'now-1h' };
  const range = { from: dateTime(), to: dateTime(), raw: raw };

  const defaults: DataQueryRequest<TQuery> = {
    requestId: 'TEST',
    range: range,
    targets: [],
    scopedVars: {},
    timezone: 'browser',
    panelId: 1,
    dashboardId: 1,
    interval: '60s',
    intervalMs: 60000,
    maxDataPoints: 500,
    startTime: 0,
  };

  Object.assign(defaults, options);

  return defaults;
}
