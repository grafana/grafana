import { config } from '@grafana/runtime';

export const DEFAULT_RANGE = {
  from: `now-${config.exploreDefaultTimeOffset}`,
  to: 'now',
};
