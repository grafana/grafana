import { type DataSourceInstanceSettings, type DataSourceRef } from '@grafana/data';

import {
  buildDataSourceComparator,
  buildDataSourcePickerLookups,
  buildDataSourceSearchMatcher,
  isDataSourceMatch,
} from './utils';

describe('isDataSourceMatch', () => {
  const dataSourceInstanceSettings = { uid: 'a' } as DataSourceInstanceSettings;

  it('matches a string with the uid', () => {
    expect(isDataSourceMatch(dataSourceInstanceSettings, 'a')).toBeTruthy();
  });
  it('matches a datasource with a datasource by the uid', () => {
    expect(isDataSourceMatch(dataSourceInstanceSettings, { uid: 'a' } as DataSourceInstanceSettings)).toBeTruthy();
  });
  it('matches a datasource ref with a datasource by the uid', () => {
    expect(isDataSourceMatch(dataSourceInstanceSettings, { uid: 'a' } as DataSourceRef)).toBeTruthy();
  });

  it('doesnt match with null', () => {
    expect(isDataSourceMatch(dataSourceInstanceSettings, null)).toBeFalsy();
  });
  it('doesnt match a datasource to a non matching string', () => {
    expect(isDataSourceMatch(dataSourceInstanceSettings, 'b')).toBeFalsy();
  });
  it('doesnt match a datasource with a different datasource uid', () => {
    expect(isDataSourceMatch(dataSourceInstanceSettings, { uid: 'b' } as DataSourceInstanceSettings)).toBeFalsy();
  });
  it('doesnt match a datasource with a datasource ref with a different uid', () => {
    expect(isDataSourceMatch(dataSourceInstanceSettings, { uid: 'b' } as DataSourceRef)).toBeFalsy();
  });
});

describe('buildDataSourcePickerLookups', () => {
  const dataSources = [
    { uid: 'a', name: 'Alpha', meta: { builtIn: false } },
    { uid: 'b', name: 'Beta', meta: { builtIn: false } },
  ] as DataSourceInstanceSettings[];

  it('builds upper and lower case name maps keyed by uid', () => {
    const lookups = buildDataSourcePickerLookups(dataSources, [], [], []);
    expect(lookups.upperCaseNameByUid.get('a')).toBe('ALPHA');
    expect(lookups.lowerCaseNameByUid.get('b')).toBe('beta');
  });

  it('builds favorite and variable uid sets for O(1) membership checks', () => {
    const lookups = buildDataSourcePickerLookups(dataSources, ['a'], [], ['${foo}']);
    expect(lookups.favoriteUids.has('a')).toBe(true);
    expect(lookups.favoriteUids.has('b')).toBe(false);
    expect(lookups.variableUids.has('${foo}')).toBe(true);
  });

  it('indexes recent uids by their position for ordering comparisons', () => {
    const lookups = buildDataSourcePickerLookups(dataSources, [], ['b', 'a'], []);
    expect(lookups.recentUidToIndex.get('b')).toBe(0);
    expect(lookups.recentUidToIndex.get('a')).toBe(1);
    expect(lookups.recentUidToIndex.has('missing')).toBe(false);
  });
});

describe('buildDataSourceComparator', () => {
  const dataSources = [
    { uid: 'c', name: 'c', meta: { builtIn: false } },
    { uid: 'D', name: 'D', meta: { builtIn: false } },
    { uid: 'a', name: 'a', meta: { builtIn: true } },
    { uid: 'b', name: 'b', meta: { builtIn: false } },
  ] as DataSourceInstanceSettings[];

  const sortWithFastPath = (
    current: string | undefined,
    recent: string[],
    variables: string[],
    favorites: string[]
  ) => {
    const lookups = buildDataSourcePickerLookups(dataSources, favorites, recent, variables);
    return [...dataSources].sort(buildDataSourceComparator(current, lookups));
  };

  it('sorts alphabetically ignoring case and puts built-in last by default', () => {
    expect(sortWithFastPath(undefined, [], [], []).map((ds) => ds.uid)).toEqual(['b', 'c', 'D', 'a']);
  });

  it('puts the current datasource first, then favorites, then recent by most-recent idx, then alphabetical with built-in last', () => {
    expect(sortWithFastPath('c', ['D', 'a'], ['${foo}'], ['b']).map((ds) => ds.uid)).toEqual(['c', 'b', 'a', 'D']);
  });
});

describe('buildDataSourceSearchMatcher', () => {
  const dataSources = [
    { uid: 'a', name: 'PostgreSQL', meta: { builtIn: false } },
    { uid: 'b', name: 'MySQL', meta: { builtIn: false } },
  ] as DataSourceInstanceSettings[];
  const lookups = buildDataSourcePickerLookups(dataSources, [], [], []);

  it('returns a function that matches every data source for an empty search term', () => {
    const matches = buildDataSourceSearchMatcher(lookups, '');
    expect(matches(dataSources[0])).toBe(true);
    expect(matches(dataSources[1])).toBe(true);
  });

  it('returns a matcher that ignores case', () => {
    const matches = buildDataSourceSearchMatcher(lookups, 'postgre');
    expect(matches(dataSources[0])).toBe(true);
    expect(matches(dataSources[1])).toBe(false);
  });

  it('falls back to data source name when the uid is missing from the lookup table', () => {
    const matches = buildDataSourceSearchMatcher(lookups, 'other');
    const unknownDs = { uid: 'z', name: 'Other', meta: { builtIn: false } } as DataSourceInstanceSettings;
    expect(matches(unknownDs)).toBe(true);
  });
});
