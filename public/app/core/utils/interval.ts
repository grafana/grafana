import kbn from 'app/core/utils/kbn';
import { DataQueryRequest, IntervalValues, TimeRange } from '@grafana/data';

export function populateInterval(
  request: DataQueryRequest,
  timeRange: TimeRange,
  resolution: number,
  lowLimit: string
): DataQueryRequest {
  const { interval, intervalMs } = getIntervals(timeRange, lowLimit, resolution);

  // make shallow copy of scoped vars,
  // and add built in variables interval and interval_ms
  request.scopedVars = Object.assign({}, request.scopedVars, {
    __interval: { text: interval, value: interval },
    __interval_s: { text: (intervalMs / 1000).toString(), value: intervalMs / 1000 },
    __interval_ms: { text: intervalMs.toString(), value: intervalMs },
  });

  request.interval = interval;
  request.intervalMs = intervalMs;

  return request;
}

export function getIntervals(range: TimeRange, lowLimit: string, resolution: number): IntervalValues {
  if (!resolution) {
    return { interval: '1s', intervalMs: 1000 };
  }

  return kbn.calculateInterval(range, resolution, lowLimit);
}
