import { jsonDiff } from '../../../settings/version-history/utils';
import { corpusCases } from '../__corpus__/cases';

import { emptyBaselineFor } from './emptyBaseline';
import { flatDiff } from './flatDiff';

type Comparable = Pick<ReturnType<typeof flatDiff>[number], 'op' | 'path' | 'value' | 'originalValue'>;

const comparable = ({ op, path, value, originalValue }: Comparable): Comparable => ({ op, path, value, originalValue });
const byPath = (a: Comparable, b: Comparable) => {
  const keyA = `${a.path.join('/')} ${a.op}`;
  const keyB = `${b.path.join('/')} ${b.op}`;
  return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
};

describe('flatDiff', () => {
  it.each(corpusCases.map((corpusCase) => [corpusCase.name, corpusCase] as const))(
    'gives the same ops as the flattened jsonDiff: %s',
    (_, { input }) => {
      const baseline = input.baseline ?? emptyBaselineFor(input.payload);
      const expected = Object.values(jsonDiff(baseline, input.payload)).flat().map(comparable).sort(byPath);

      expect(flatDiff(baseline, input.payload).map(comparable).sort(byPath)).toEqual(expected);
    }
  );

  it('orders ops by path, array indexes numerically', () => {
    const before = { b: 1, a: { items: Array.from({ length: 12 }, (_, index) => index) } };
    const after = { b: 2, a: { items: Array.from({ length: 12 }, (_, index) => index + 1) } };

    const paths = flatDiff(before, after).map((diff) => diff.path.join('/'));

    expect(paths.slice(0, 3)).toEqual(['a/items/0', 'a/items/1', 'a/items/2']);
    expect(paths[paths.length - 1]).toBe('b');
  });
});
