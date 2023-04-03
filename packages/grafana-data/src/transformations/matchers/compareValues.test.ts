import { ComparisonOperation } from '@grafana/schema';

import { compareValues } from './compareValues';

describe('compare values', () => {
  it('simple comparisons', () => {
    expect(compareValues(null, ComparisonOperation.EQ, null)).toEqual(true);
    expect(compareValues(null, ComparisonOperation.NEQ, null)).toEqual(false);

    expect(compareValues(1, ComparisonOperation.GT, 2)).toEqual(false);
    expect(compareValues(2, ComparisonOperation.GT, 1)).toEqual(true);
    expect(compareValues(1, ComparisonOperation.GTE, 2)).toEqual(false);
    expect(compareValues(2, ComparisonOperation.GTE, 1)).toEqual(true);

    expect(compareValues(1, ComparisonOperation.LT, 2)).toEqual(true);
    expect(compareValues(2, ComparisonOperation.LT, 1)).toEqual(false);
    expect(compareValues(1, ComparisonOperation.LTE, 2)).toEqual(true);
    expect(compareValues(2, ComparisonOperation.LTE, 1)).toEqual(false);

    expect(compareValues(1, ComparisonOperation.EQ, 1)).toEqual(true);
    expect(compareValues(1, ComparisonOperation.LTE, 1)).toEqual(true);
    expect(compareValues(1, ComparisonOperation.GTE, 1)).toEqual(true);
  });
});
