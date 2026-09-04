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

  it('extracts grafana expression references', () => {
    expect(referencedRefIds('($A * 2) + ${B}')).toEqual(['A', 'B']);
  });

  it('supports function calls', () => {
    const transform = createLiveMathTransform({ sourceRefId: 'A', resultRefId: 'B', expression: 'abs($A) + floor(2.9)' }, [0]);
    expect(transform.values([[-4, 5]])).toEqual([[6, 7]]);
  });
});
