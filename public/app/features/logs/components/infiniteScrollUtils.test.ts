import { type AbsoluteTimeRange, dateTime, type TimeRange } from '@grafana/data';
import { LogsSortOrder } from '@grafana/schema';

import { canScrollBottom, canScrollTop, SCROLLING_THRESHOLD } from './infiniteScrollUtils';

function makeRange(from: number, to: number): TimeRange {
  const fromDt = dateTime(from);
  const toDt = dateTime(to);
  return { from: fromDt, raw: { from: fromDt, to: toDt }, to: toDt };
}

// currentRange is always wide enough that SCROLLING_THRESHOLD never blocks the scroll.
const currentRange = makeRange(0, 1_000_000);
const timeZone = 'utc';

describe('canScrollTop', () => {
  it('widens the "to" edge by 1ms when scrolling for older logs (ascending order)', () => {
    const visibleRange: AbsoluteTimeRange = { from: 500_000, to: 600_000 };
    const result = canScrollTop(visibleRange, currentRange, timeZone, LogsSortOrder.Ascending);
    expect(result).toEqual({ from: 0, to: 500_001 });
  });

  it('widens the "from" edge by 1ms when scrolling for newer logs (descending order)', () => {
    const visibleRange: AbsoluteTimeRange = { from: 500_000, to: 600_000 };
    const result = canScrollTop(visibleRange, currentRange, timeZone, LogsSortOrder.Descending);
    expect(result).toEqual({ from: 599_999, to: 1_000_000 });
  });

  it('returns undefined when already at the edge of the current range', () => {
    const visibleRange: AbsoluteTimeRange = { from: 0, to: 100 };
    expect(canScrollTop(visibleRange, currentRange, timeZone, LogsSortOrder.Ascending)).toBeUndefined();
  });
});

describe('canScrollBottom', () => {
  it('widens the "from" edge by 1ms when scrolling for newer logs (ascending order)', () => {
    const visibleRange: AbsoluteTimeRange = { from: 400_000, to: 500_000 };
    const result = canScrollBottom(visibleRange, currentRange, timeZone, LogsSortOrder.Ascending);
    expect(result).toEqual({ from: 499_999, to: 1_000_000 });
  });

  it('widens the "to" edge by 1ms when scrolling for older logs (descending order)', () => {
    const visibleRange: AbsoluteTimeRange = { from: 400_000, to: 500_000 };
    const result = canScrollBottom(visibleRange, currentRange, timeZone, LogsSortOrder.Descending);
    expect(result).toEqual({ from: 0, to: 400_001 });
  });

  it('respects SCROLLING_THRESHOLD', () => {
    const visibleRange: AbsoluteTimeRange = {
      from: 999_000 - SCROLLING_THRESHOLD,
      to: 999_000,
    };
    expect(canScrollBottom(visibleRange, currentRange, timeZone, LogsSortOrder.Ascending)).toBeUndefined();
  });
});
