import { getSummaryStatsTooltipPlacement } from './SummaryDurationStatsTooltip';

describe('getSummaryStatsTooltipPlacement', () => {
  it('anchors to the end when the label sits left of the bar (bar near right edge)', () => {
    // viewStart 0.8 > 1 - viewEnd (0) -> label renders left of the bar, stats at its right end.
    expect(getSummaryStatsTooltipPlacement(0.8, 1)).toBe('top-end');
  });

  it('anchors to the start when the label sits right of the bar (bar near left edge)', () => {
    // viewStart 0 <= 1 - viewEnd (0.8) -> label renders right of the bar, stats at its left end.
    expect(getSummaryStatsTooltipPlacement(0, 0.2)).toBe('top-start');
  });
});
