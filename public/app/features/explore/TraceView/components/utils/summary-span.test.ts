import { type TraceSpan } from '../types/trace';

import { countSummarySpans, isSummarySpan } from './summary-span';

const summarySpan = { aggregation: { isSummary: true, isPreservedOutlier: false, spanCount: 3 } } as TraceSpan;
const preservedOutlierSpan = { aggregation: { isSummary: false, isPreservedOutlier: true } } as TraceSpan;
const normalSpan = {} as TraceSpan;

describe('isSummarySpan', () => {
  it('is true only for spans flagged as summaries', () => {
    expect(isSummarySpan(summarySpan)).toBe(true);
    expect(isSummarySpan(preservedOutlierSpan)).toBe(false);
    expect(isSummarySpan(normalSpan)).toBe(false);
  });
});

describe('countSummarySpans', () => {
  it('counts only summary spans', () => {
    expect(countSummarySpans([summarySpan, preservedOutlierSpan, normalSpan, summarySpan])).toBe(2);
  });

  it('returns 0 when there are no summary spans', () => {
    expect(countSummarySpans([preservedOutlierSpan, normalSpan])).toBe(0);
    expect(countSummarySpans([])).toBe(0);
  });
});
