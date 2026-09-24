import * as z from 'zod';

import { DatasourceBoundFilterSchema, parseStoredFilter, scopeFor, solutionFilterStorageKey } from './solutionFilter';

const Schema = DatasourceBoundFilterSchema.extend({ values: z.array(z.string().trim()) });
const isEmpty = (filter: z.infer<typeof Schema>) => filter.values.length === 0;

const stored = { datasourceUid: 'uid-a', datasourceName: 'Prometheus', values: ['a'] };

describe('solutionFilterStorageKey', () => {
  it('keys each solution separately within the org', () => {
    expect(solutionFilterStorageKey('metrics')).toMatch(/^grafana\.home\.metrics\.filter\.\d+$/);
    expect(solutionFilterStorageKey('metrics')).not.toBe(solutionFilterStorageKey('kubernetes'));
  });
});

describe('parseStoredFilter', () => {
  it('reads a missing, malformed or wrongly shaped value as unscoped', () => {
    expect(parseStoredFilter(undefined, Schema, isEmpty)).toBeNull();
    expect(parseStoredFilter('', Schema, isEmpty)).toBeNull();
    expect(parseStoredFilter('{not json', Schema, isEmpty)).toBeNull();
    expect(parseStoredFilter(JSON.stringify({ ...stored, values: 'a' }), Schema, isEmpty)).toBeNull();
    expect(parseStoredFilter(JSON.stringify({ values: ['a'] }), Schema, isEmpty)).toBeNull();
  });

  it('returns the normalized filter, or unscoped when it selects nothing', () => {
    expect(parseStoredFilter(JSON.stringify({ ...stored, values: [' a '] }), Schema, isEmpty)).toEqual(stored);
    expect(parseStoredFilter(JSON.stringify({ ...stored, values: [] }), Schema, isEmpty)).toBeNull();
  });
});

describe('scopeFor', () => {
  it('applies a filter only to the datasource it was saved for', () => {
    expect(scopeFor(stored, { uid: 'uid-a' })).toBe(stored);
    expect(scopeFor(stored, { uid: 'uid-b' })).toBeNull();
    expect(scopeFor(null, { uid: 'uid-a' })).toBeNull();
  });
});
