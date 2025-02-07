import { computeVersionDiff } from './diff';

describe('computeVersionDiff', () => {
  it('should compute the correct diff for added and removed lines', () => {
    const json1 = { a: 1, b: 2 };
    const json2 = { a: 1, b: 3, c: 4 };

    const result = computeVersionDiff(json1, json2);

    expect(result.added).toBe(2);
    expect(result.removed).toBe(1);
  });

  it('should handle empty objects', () => {
    const json1 = {};
    const json2 = {};

    const result = computeVersionDiff(json1, json2);

    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
  });

  it('should handle nested objects', () => {
    const json1 = { a: { b: 1 } };
    const json2 = { a: { b: 2, c: 4 } };

    const result = computeVersionDiff(json1, json2);

    expect(result.added).toBe(2);
    expect(result.removed).toBe(1);
  });

  it('should handle arrays', () => {
    const json1 = { a: [1, 2, 3], b: 2 };
    const json2 = { a: [1, 2, 4] };

    const result = computeVersionDiff(json1, json2);

    expect(result.added).toBe(1);
    expect(result.removed).toBe(2);
  });

  it('should use normalizeFunction to normalize input objects', () => {
    const json1 = { a: 1, b: 2 };
    const json2 = { a: 1, b: 3, c: 4 };

    const normalizeFunction = (item: typeof json1) => {
      const { b, ...rest } = item;
      return rest;
    };

    const result = computeVersionDiff(json1, json2, normalizeFunction);

    expect(result.added).toBe(1);
    expect(result.removed).toBe(0);
  });
});
