import { fitVisibleCount } from './fitVisibleCount';

describe('fitVisibleCount', () => {
  it.each([
    { desc: 'all tags fit exactly without a count', available: 238, expected: 4 },
    { desc: 'the last tag no longer fits', available: 237, expected: 3 },
    { desc: 'three tags and their count fit exactly', available: 198, expected: 3 },
    { desc: 'the count pushes the third tag out', available: 197, expected: 2 },
    { desc: 'one tag and its count fit exactly', available: 76, expected: 1 },
    { desc: 'the first tag needs to shrink', available: 60, expected: 1 },
    { desc: 'no space remains', available: 0, expected: 1 },
  ])('returns $expected when $desc', ({ available, expected }) => {
    expect(fitVisibleCount([40, 60, 50, 70], [30, 30, 30], 6, available)).toBe(expected);
  });

  it.each([
    { available: 91, expected: 1 },
    { available: 92, expected: 2 },
  ])('reserves space for two-digit counts at $available pixels', ({ available, expected }) => {
    expect(fitVisibleCount(Array(12).fill(20), Array(11).fill(40), 6, available)).toBe(expected);
  });

  it('uses the actual count width when a smaller label allows another tag to fit', () => {
    const countWidths = [20, 20, 20, 20, 20, 20, 20, 20, 20, 30, 30];
    expect(fitVisibleCount(Array(12).fill(20), countWidths, 6, 280)).toBe(10);
  });

  it('continues checking when showing every tag removes an otherwise oversized count', () => {
    expect(fitVisibleCount([10, 10], [40], 6, 26)).toBe(2);
  });

  it('retains a single oversized tag without needing a count', () => {
    expect(fitVisibleCount([100], [], 6, 20)).toBe(1);
  });

  it('returns zero for an empty tag list', () => {
    expect(fitVisibleCount([], [], 6, 100)).toBe(0);
  });
});
