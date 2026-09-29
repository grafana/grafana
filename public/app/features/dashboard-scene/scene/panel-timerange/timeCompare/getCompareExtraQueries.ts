import { type DataQueryRequest } from '@grafana/data';
import {
  type ExtraQueryDescriptor,
  getCompareSeriesRefId,
  type SceneDataQuery,
  timeShiftAlignmentProcessor,
} from '@grafana/scenes';

import { getCompareTimeRange } from './getCompareTimeRange';

/**
 * Builds the time-shifted request that runs alongside the primary one.
 * Returns an empty list when comparison is off or every query has opted out.
 */
export function getCompareExtraQueries(
  request: DataQueryRequest,
  compareWith: string | undefined
): ExtraQueryDescriptor[] {
  const compareRange = getCompareTimeRange(request.range, compareWith);
  if (!compareRange) {
    return [];
  }

  const targets = request.targets
    .filter((query: SceneDataQuery) => query.timeRangeCompare !== false)
    .map((query) => ({
      ...query,
      // Distinct from the primary request so query caches and panels don't collide on identity.
      refId: getCompareSeriesRefId(query.refId),
    }));

  if (!targets.length) {
    return [];
  }

  return [
    {
      req: {
        ...request,
        targets,
        range: compareRange,
        // Must match compare range; inheriting primary rangeRaw (to: 'now') enables Prometheus incremental cache incorrectly.
        rangeRaw: compareRange.raw,
      },
      processor: timeShiftAlignmentProcessor,
    },
  ];
}

/**
 * Whether changing the compare offset should trigger a rerun. Queries that opted out of time
 * comparison produce no compare request, so a change is a no-op if every query has opted out.
 */
export function shouldRerunCompare(
  prevCompareWith: string | undefined,
  nextCompareWith: string | undefined,
  queries: SceneDataQuery[]
): boolean {
  return prevCompareWith !== nextCompareWith && queries.find((query) => query.timeRangeCompare !== false) !== undefined;
}
