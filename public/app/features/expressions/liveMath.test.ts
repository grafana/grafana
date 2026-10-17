import { expect, describe, it } from 'vitest';

import { createLiveMathTransform, referencedRefIds } from './liveMath';

describe('live math expressions', () => {
  it('evaluates arithmetic against a single live field', () => {
    const transform = createLiveMathTransform(
      { sourceRefId: 'A', resultRefId: 'B', expression: '$A * 2 + 1' },
      [1]
    );

    expect(transform.values([[1000, 2000], [2, 3]])).toEqual([[1000, 2000], [5, 7]]);
  });

  it('preserves null values through arithmetic and comparisons', () => {
    const arithmetic = createLiveMathTransform({ sourceRefId: 'A', resultRefId: 'B', expression: '$A * 2' }, [0]);
    const arithmeticValues = arithmetic.values([[null, 2, NaN]])[0];
    expect(arithmeticValues[0]).toBeNull();
    expect(arithmeticValues[1]).toBe(4);
    expect(Number.isNaN(arithmeticValues[2] as number)).toBe(true);

    const comparison = createLiveMathTransform({ sourceRefId: 'A', resultRefId: 'B', expression: '$A > 10' }, [0]);
    const comparisonValues = comparison.values([[null, 20, NaN]])[0];
    expect(comparisonValues[0]).toBeNull();
    expect(comparisonValues[1]).toBe(1);
    expect(Number.isNaN(comparisonValues[2] as number)).toBe(true);
  });

  it('preserves null values through logical operators', () => {
    const or = createLiveMathTransform({ sourceRefId: 'A', resultRefId: 'B', expression: '$A || 1' }, [0]);
    expect(or.values([[null, 0, 2]])[0]).toEqual([null, 1, 1]);

    const and = createLiveMathTransform({ sourceRefId: 'A', resultRefId: 'B', expression: '$A && 1' }, [0]);
    expect(and.values([[null, 0, 2]])[0]).toEqual([null, 0, 1]);

    const nan = createLiveMathTransform({ sourceRefId: 'A', resultRefId: 'B', expression: '$A || 1' }, [0]);
    expect(Number.isNaN(nan.values([[NaN]])[0][0] as number)).toBe(true);
  });

  it('preserves null values through unary operators and math functions', () => {
    const unary = createLiveMathTransform({ sourceRefId: 'A', resultRefId: 'B', expression: '-$A' }, [0]);
    expect(unary.values([[null, 2]])[0]).toEqual([null, -2]);

    const abs = createLiveMathTransform({ sourceRefId: 'A', resultRefId: 'B', expression: 'abs($A)' }, [0]);
    expect(abs.values([[null, -2]])[0]).toEqual([null, 2]);
  });

  it('extracts grafana expression references', () => {
    expect(referencedRefIds('($A * 2) + ${B}')).toEqual(['A', 'B']);
  });

  it('supports function calls', () => {
    const transform = createLiveMathTransform({ sourceRefId: 'A', resultRefId: 'B', expression: 'abs($A) + floor(2.9)' }, [0]);
    expect(transform.values([[-4, 5]])).toEqual([[6, 7]]);
  });

  it('does not throw for malformed expressions', () => {
    const transform = createLiveMathTransform(
      { sourceRefId: 'A', resultRefId: 'B', expression: '$A +' },
      [0]
    );

    expect(() => transform.values([[1, 2]])).not.toThrow();
    expect(transform.values([[1, 2]])).toEqual([[1, 2]]);
  });
});
