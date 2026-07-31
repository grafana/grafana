import { type TraceKeyValuePair } from '@grafana/data';

import { type TraceSpan } from '../types/trace';

import { countSummarySpans, isSummarySpan, partitionAggregationTags } from './summary-span';

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

describe('partitionAggregationTags', () => {
  it('splits aggregation.* tags from the rest, preserving order', () => {
    const tags: TraceKeyValuePair[] = [
      { key: 'http.method', value: 'POST' },
      { key: 'aggregation.is_summary', value: 'true' },
      { key: 'http.status_code', value: '200' },
      { key: 'aggregation.span_count', value: '3' },
    ];

    const { aggregationTags, otherTags } = partitionAggregationTags(tags);

    expect(aggregationTags.map((t) => t.key)).toEqual(['aggregation.is_summary', 'aggregation.span_count']);
    expect(otherTags.map((t) => t.key)).toEqual(['http.method', 'http.status_code']);
  });

  it('returns an empty aggregation list when no aggregation.* tags are present', () => {
    const tags: TraceKeyValuePair[] = [{ key: 'http.method', value: 'POST' }];

    const { aggregationTags, otherTags } = partitionAggregationTags(tags);

    expect(aggregationTags).toEqual([]);
    expect(otherTags).toEqual(tags);
  });

  it('handles an empty tag list', () => {
    expect(partitionAggregationTags([])).toEqual({ aggregationTags: [], otherTags: [] });
  });
});
