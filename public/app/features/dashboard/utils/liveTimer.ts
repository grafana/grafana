import { TimeRange } from '@grafana/data';

const FIVE_MINS = 5 * 60 * 1000;

export function getLiveTimerInterval(tr: TimeRange, width: number): number {
  const delta = tr.to.valueOf() - tr.from.valueOf();
  const millisPerPixel = delta / width;

  if (millisPerPixel < 100) {
    return 100; // 10hz max
  }
  if (millisPerPixel > FIVE_MINS) {
    return FIVE_MINS;
  }
  return millisPerPixel;
}
