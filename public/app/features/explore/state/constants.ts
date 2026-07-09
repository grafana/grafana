import { type TraceSearchProps, generateUUID } from '@grafana/data';
import { config } from '@grafana/runtime';

export const DEFAULT_RANGE = {
  from: `now-${config.exploreDefaultTimeOffset}`,
  to: 'now',
};

export const randomId = () => generateUUID().slice(0, 12);

export const DEFAULT_TAG_FILTERS = {
  id: randomId(),
  operator: '=',
};

export const DEFAULT_SPAN_FILTERS: TraceSearchProps = {
  spanNameOperator: '=',
  serviceNameOperator: '=',
  fromOperator: '>',
  toOperator: '<',
  tags: [DEFAULT_TAG_FILTERS],
  adhocFilters: [],
  matchesOnly: false,
  criticalPathOnly: false,
};
