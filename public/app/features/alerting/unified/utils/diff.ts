import { chain, identity } from 'lodash';

import { jsonDiff } from 'app/features/dashboard-scene/settings/version-history/utils';

export type Diff = {
  added: number;
  removed: number;
};

export function computeVersionDiff<T extends Object>(
  json1: T,
  json2: T,
  normalizeFunction: (item: T) => Object = identity
): Diff {
  const cleanedJson1 = normalizeFunction(json1);
  const cleanedJson2 = normalizeFunction(json2);

  const diff = jsonDiff(cleanedJson1, cleanedJson2);
  const added = chain(diff)
    .values()
    .flatMap()
    .filter((operation) => operation.op === 'add' || operation.op === 'replace' || operation.op === 'move')
    .sumBy((operation) => operation.endLineNumber - operation.startLineNumber + 1)
    .value();

  const removed = chain(diff)
    .values()
    .flatMap()
    .filter((operation) => operation.op === 'remove' || operation.op === 'replace')
    .sumBy((operation) => operation.endLineNumber - operation.startLineNumber + 1)
    .value();

  return {
    added,
    removed,
  };
}
