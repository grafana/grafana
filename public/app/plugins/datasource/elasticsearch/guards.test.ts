import { Count, ExtendedStats } from './dataquery.gen';
import { isMetricAggregationWithMeta } from './guards';

describe('Type guards', () => {
  test('Identifies metrics with meta attribute', () => {
    const metric: ExtendedStats = {
      id: 'test',
      type: 'extended_stats',
      meta: {
        test: 'test',
      },
    };
    expect(isMetricAggregationWithMeta(metric)).toBe(true);
  });

  test('Identifies metrics without meta attribute', () => {
    const metric: Count = {
      id: 'test',
      type: 'count',
    };
    expect(isMetricAggregationWithMeta(metric)).toBe(false);
  });
});
