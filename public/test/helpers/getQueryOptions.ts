import { DataQueryOptions, DataQuery } from '@grafana/ui';
import moment from 'moment';


export function getQueryOptions<TQuery extends DataQuery>(options: Partial<DataQueryOptions<TQuery>>): DataQueryOptions<TQuery> {
  const raw = {from: 'now', to: 'now-1h'};
  const range = { from: moment(), to: moment(), raw: raw};

  const defaults: DataQueryOptions<TQuery> = {
    range: range,
    rangeRaw: raw,
    targets: [],
    scopedVars: {},
    timezone: 'browser',
    panelId: 1,
    dashboardId: 1,
    interval: '60s',
    intervalMs: 60000,
    maxDataPoints: 500,
  };

  Object.assign(defaults, options);

  return defaults;
}
