import { TimeRange } from '@grafana/data';

export function getLiveTimerInterval(tr: TimeRange, width: number): number {
  const delta = tr.to.valueOf() - tr.from.valueOf();
  const millisPerPixel = delta / width;
  console.log('LIVE', tr, delta, millisPerPixel);

  return 100;
}
