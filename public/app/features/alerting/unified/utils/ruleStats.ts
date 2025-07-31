import { pick, sum } from 'lodash';

import { AlertGroupTotals } from 'app/types/unified-alerting';

export function totalFromStats(stats: AlertGroupTotals): number {
  // countable stats will pick only the states that indicate a single rule – health indicators like "error" and "nodata" should
  // not be counted because they are already counted by their state
  const countableStats = pick(stats, ['alerting', 'pending', 'inactive', 'recording', 'recovering']);
  const total = sum(Object.values(countableStats));

  return total;
}
