import { representativeDelta } from './utils';

describe('representativeDelta', () => {
  it('returns the spacing for uniform data', () => {
    expect(representativeDelta([1000, 2000, 3000, 4000], [1, 1, 1, 1])).toBe(1000);
  });

  it('ignores a small first gap from a partial edge bucket', () => {
    // gaps: 250, 1000, 1000, 1000 -> drop edges -> [1000, 1000] -> 1000, not 250
    expect(representativeDelta([0, 250, 1250, 2250, 3250], [1, 1, 1, 1, 1])).toBe(1000);
  });

  it('ignores a small last gap from a partial edge bucket', () => {
    // gaps: 1000, 1000, 1000, 100 -> drop edges -> [1000, 1000] -> 1000
    expect(representativeDelta([0, 1000, 2000, 3000, 3100], [1, 1, 1, 1, 1])).toBe(1000);
  });

  it('is not dominated by an interior outlier gap (missing bucket)', () => {
    // one missing bucket at 4000 -> gaps 1000,1000,1000,2000,1000,1000
    // interior (drop edges) 1000,1000,2000,1000 -> median 1000, not the 2000 outlier
    expect(representativeDelta([0, 1000, 2000, 3000, 5000, 6000, 7000], [1, 1, 1, 1, 1, 1, 1])).toBe(1000);
  });

  it('stays stable under timestamp jitter where a mode would degenerate', () => {
    // gaps: 1000, 1001, 998, 1001 (all distinct) -> interior [1001, 998] -> median 999.5
    expect(representativeDelta([0, 1000, 2001, 2999, 4000], [1, 1, 1, 1, 1])).toBe(999.5);
  });

  it('skips null and undefined y values', () => {
    // valid points at x = 0, 2000, 3000 -> gaps 2000, 1000 -> median 1500
    expect(representativeDelta([0, 1000, 2000, 3000], [1, null, 1, 1])).toBe(1500);
    expect(representativeDelta([0, 1000, 2000, 3000], [1, undefined, 1, 1])).toBe(1500);
  });

  it('skips non-positive and non-finite deltas', () => {
    // duplicate timestamp (delta 0) and NaN x are dropped -> only the 1000 gap remains
    expect(representativeDelta([1000, 1000, 2000], [1, 1, 1])).toBe(1000);
    expect(representativeDelta([1000, NaN, 2000, 3000], [1, 1, 1, 1])).toBe(1000);
  });

  it('handles short series without edge exclusion', () => {
    expect(representativeDelta([1000, 2000], [1, 1])).toBe(1000); // one gap
    expect(representativeDelta([0, 1000, 4000], [1, 1, 1])).toBe(2000); // two gaps -> median
  });

  it('returns null with fewer than two valid points', () => {
    expect(representativeDelta([], [])).toBeNull();
    expect(representativeDelta([1000], [1])).toBeNull();
    expect(representativeDelta([1000, 2000], [null, 1])).toBeNull();
  });
});
