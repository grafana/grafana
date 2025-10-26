import { v4 as uuidv4 } from 'uuid';

import { config } from '@grafana/runtime';

export const DEFAULT_RANGE = {
  from: `now-${config.exploreDefaultTimeOffset}`,
  to: 'now',
};

export const randomId = () => uuidv4().slice(0, 12);

export const DEFAULT_TAG_FILTERS = {
  id: randomId(),
  operator: '=',
};

export const DEFAULT_SPAN_FILTERS = {
  spanNameOperator: '=',
  serviceNameOperator: '=',
  fromOperator: '>',
  toOperator: '<',
  tags: [DEFAULT_TAG_FILTERS],
  matchesOnly: false,
  criticalPathOnly: false,
};
