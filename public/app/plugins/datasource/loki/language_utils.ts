import { TimeRange } from '@grafana/data';

function roundMsToMin(milliseconds: number): number {
  return roundSecToMin(milliseconds / 1000);
}

function roundSecToMin(seconds: number): number {
  return Math.floor(seconds / 60);
}

export function shouldRefreshLabels(range?: TimeRange, prevRange?: TimeRange): boolean {
  if (range && prevRange) {
    const sameMinuteFrom = roundMsToMin(range.from.valueOf()) === roundMsToMin(prevRange.from.valueOf());
    const sameMinuteTo = roundMsToMin(range.to.valueOf()) === roundMsToMin(prevRange.to.valueOf());
    // If both are same, don't need to refresh
    return !(sameMinuteFrom && sameMinuteTo);
  }
  return false;
}
