import { createDataFrame } from '@grafana/data';

import { getPruneStatus } from './prune-status';

describe('getPruneStatus', () => {
  it.each([
    ['PRUNED_ON_READ', 'PRUNED_ON_READ'],
    ['PRUNED_ON_WRITE', 'PRUNED_ON_WRITE'],
    ['NOT_PRUNED', undefined],
    [2, undefined],
    [undefined, undefined],
  ])('maps %s to %s', (pruneStatus, expected) => {
    expect(getPruneStatus(createDataFrame({ fields: [], meta: { custom: { pruneStatus } } }))).toBe(expected);
  });

  it('is undefined without a frame or meta', () => {
    expect(getPruneStatus(undefined)).toBeUndefined();
    expect(getPruneStatus(createDataFrame({ fields: [] }))).toBeUndefined();
  });
});
