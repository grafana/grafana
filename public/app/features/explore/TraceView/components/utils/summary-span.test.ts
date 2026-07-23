import { type TraceKeyValuePair } from '@grafana/data';

import { partitionAggregationTags } from './summary-span';

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
