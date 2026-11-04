import { compare } from 'fast-json-patch';
import { get } from 'lodash';

import { type Diff } from '../../../settings/version-history/utils';

/**
 * The flattened `jsonDiff(lhs, rhs)` without its line numbers: the same operations, path segments, values and
 * original values. jsonDiff pretty-prints both sides through json-source-map only to find line numbers, which
 * Review never shows; on large dashboards that is most of the time a summary takes.
 *
 * Ops come in path order (array indexes numerically), close to jsonDiff's line order on sorted save models.
 */
export function flatDiff(lhs: object, rhs: object): Diff[] {
  return compare(lhs, rhs)
    .map((operation): Diff => {
      // Segments stay JSON-pointer escaped, and original values are read with lodash `get`, exactly as jsonDiff does.
      const path = operation.path.split('/').slice(1);
      const value = operation.op === 'add' || operation.op === 'replace' ? operation.value : undefined;
      const originalValue = operation.op === 'replace' || operation.op === 'remove' ? get(lhs, path) : undefined;
      return { op: operation.op, value, originalValue, path, startLineNumber: 0, endLineNumber: 0 };
    })
    .sort((a, b) => comparePaths(a.path, b.path));
}

function comparePaths(a: string[], b: string[]): number {
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index++) {
    if (a[index] === b[index]) {
      continue;
    }
    const numberA = Number(a[index]);
    const numberB = Number(b[index]);
    if (Number.isInteger(numberA) && Number.isInteger(numberB)) {
      return numberA - numberB;
    }
    return a[index] < b[index] ? -1 : 1;
  }
  return a.length - b.length;
}
