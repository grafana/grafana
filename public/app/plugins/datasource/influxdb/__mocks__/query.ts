import { DataQueryRequest, dateTime } from '@grafana/data';

import { InfluxQuery } from '../types';

const now = dateTime('2023-09-16T21:26:00Z');

export const queryOptions: DataQueryRequest<InfluxQuery> = {
  app: 'dashboard',
  interval: '10',
  intervalMs: 10,
  requestId: 'A-testing',
  startTime: 0,
  range: {
    from: dateTime(now).subtract(15, 'minutes'),
    to: now,
    raw: {
      from: 'now-15m',
      to: 'now',
    },
  },
  rangeRaw: {
    from: 'now-15m',
    to: 'now',
  },
  targets: [],
  timezone: 'UTC',
  scopedVars: {
    interval: { text: '1m', value: '1m' },
    __interval: { text: '1m', value: '1m' },
    __interval_ms: { text: 60000, value: 60000 },
  },
};
