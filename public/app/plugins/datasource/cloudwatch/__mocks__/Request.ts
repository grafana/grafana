import { DataQueryRequest } from '@grafana/data';

import { CloudWatchQuery } from '../types';

import { TimeRangeMock } from './timeRange';

export const RequestMock: DataQueryRequest<CloudWatchQuery> = {
  range: TimeRangeMock,
  rangeRaw: { from: TimeRangeMock.from, to: TimeRangeMock.to },
  targets: [],
  requestId: '',
  interval: '',
  intervalMs: 0,
  scopedVars: {},
  timezone: '',
  app: '',
  startTime: 0,
};
