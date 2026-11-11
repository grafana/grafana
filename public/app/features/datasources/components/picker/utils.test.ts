import { type DataSourceInstanceSettings, type DataSourceRef } from '@grafana/data';

import {
  buildDataSourceComparator,
  buildDataSourcePickerLookups,
  buildDataSourceSearchMatcher,
  getDataSourceCompareFn,
  isDataSourceMatch,
  matchDataSourceWithSearch,
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

describe('getDataSouceCompareFn', () => {
  const dataSources = [
    { uid: 'c', name: 'c', meta: { builtIn: false } },
    { uid: 'D', name: 'D', meta: { builtIn: false } },
    { uid: 'a', name: 'a', meta: { builtIn: true } },
    { uid: 'b', name: 'b', meta: { builtIn: false } },
  ] as DataSourceInstanceSettings[];

  it('sorts data sources alphabetically ignoring captitalization', () => {
    dataSources.sort(getDataSourceCompareFn(undefined, [], []));
    expect(dataSources).toEqual([
      { uid: 'b', name: 'b', meta: { builtIn: false } },
      { uid: 'c', name: 'c', meta: { builtIn: false } },
      { uid: 'D', name: 'D', meta: { builtIn: false } },
      { uid: 'a', name: 'a', meta: { builtIn: true } },
    ] as DataSourceInstanceSettings[]);
  });

  it('sorts built in datasources last and other data sources alphabetically', () => {
    dataSources.sort(getDataSourceCompareFn(undefined, [], []));
    expect(dataSources).toEqual([
      { uid: 'b', name: 'b', meta: { builtIn: false } },
      { uid: 'c', name: 'c', meta: { builtIn: false } },
      { uid: 'D', name: 'D', meta: { builtIn: false } },
      { uid: 'a', name: 'a', meta: { builtIn: true } },
    ] as DataSourceInstanceSettings[]);
  });

  it('sorts the current datasource before others', () => {
    dataSources.sort(getDataSourceCompareFn('c', [], []));
    expect(dataSources).toEqual([
      { uid: 'c', name: 'c', meta: { builtIn: false } },
      { uid: 'b', name: 'b', meta: { builtIn: false } },
      { uid: 'D', name: 'D', meta: { builtIn: false } },
      { uid: 'a', name: 'a', meta: { builtIn: true } },
    ] as DataSourceInstanceSettings[]);
  });

  it('sorts recently used datasources first', () => {
    dataSources.sort(getDataSourceCompareFn(undefined, ['c', 'a'], []));
    expect(dataSources).toEqual([
      { uid: 'a', name: 'a', meta: { builtIn: true } },
      { uid: 'c', name: 'c', meta: { builtIn: false } },
      { uid: 'b', name: 'b', meta: { builtIn: false } },
      { uid: 'D', name: 'D', meta: { builtIn: false } },
    ] as DataSourceInstanceSettings[]);
  });

  it('sorts favorite datasources first', () => {
    dataSources.sort(getDataSourceCompareFn(undefined, [], [], ['c', 'a']));
    expect(dataSources).toEqual([
      { uid: 'a', name: 'a', meta: { builtIn: true } },
      { uid: 'c', name: 'c', meta: { builtIn: false } },
      { uid: 'b', name: 'b', meta: { builtIn: false } },
      { uid: 'D', name: 'D', meta: { builtIn: false } },
    ] as DataSourceInstanceSettings[]);
  });

  it('sorts variables before other datasources', () => {
    dataSources.sort(getDataSourceCompareFn(undefined, [], ['c', 'b']));
    expect(dataSources).toEqual([
      { uid: 'b', name: 'b', meta: { builtIn: false } },
      { uid: 'c', name: 'c', meta: { builtIn: false } },
      { uid: 'D', name: 'D', meta: { builtIn: false } },
      { uid: 'a', name: 'a', meta: { builtIn: true } },
    ] as DataSourceInstanceSettings[]);
  });

  it('sorts datasources current -> favorite -> recently used -> variables -> others -> built in', () => {
    const dataSources = [
      { uid: 'a', name: 'a', meta: { builtIn: true } },
      { uid: 'b', name: 'b', meta: { builtIn: false } },
      { uid: 'c', name: 'c', meta: { builtIn: false } },
      { uid: 'e', name: 'e', meta: { builtIn: false } },
      { uid: 'D', name: 'D', meta: { builtIn: false } },
      { uid: 'f', name: 'f', meta: { builtIn: false } },
    ] as DataSourceInstanceSettings[];

    dataSources.sort(getDataSourceCompareFn('c', ['b', 'e'], ['d'], ['f']));
    expect(dataSources).toEqual([
      { uid: 'c', name: 'c', meta: { builtIn: false } },
      { uid: 'f', name: 'f', meta: { builtIn: false } },
      { uid: 'e', name: 'e', meta: { builtIn: false } },
      { uid: 'b', name: 'b', meta: { builtIn: false } },
      { uid: 'D', name: 'D', meta: { builtIn: false } },
      { uid: 'a', name: 'a', meta: { builtIn: true } },
    ] as DataSourceInstanceSettings[]);
  });
});

describe('matchDataSourceWithSearch', () => {
  let dataSource: DataSourceInstanceSettings;

  beforeEach(() => {
    dataSource = {
      name: 'My SQL DB',
    } as DataSourceInstanceSettings;
  });

  it('should return true when the search term matches the data source name', () => {
    const searchTerm = 'My SQL';
    expect(matchDataSourceWithSearch(dataSource, searchTerm)).toBe(true);
  });

  it('should return true when the search term matches part of the data source name', () => {
    const searchTerm = 'SQL';
    expect(matchDataSourceWithSearch(dataSource, searchTerm)).toBe(true);
  });

  it('should return false when the search term does not match the data source name', () => {
    const searchTerm = 'Oracle';
    expect(matchDataSourceWithSearch(dataSource, searchTerm)).toBe(false);
  });

  it('should return true when the search term is empty', () => {
    const searchTerm = '';
    expect(matchDataSourceWithSearch(dataSource, searchTerm)).toBe(true);
  });

  it('should ignore case when matching the search term', () => {
    dataSource.name = 'PostgreSQL DB';
    const searchTerm = 'postgre';
    expect(matchDataSourceWithSearch(dataSource, searchTerm)).toBe(true);
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

  it('matches the ordering of getDataSourceCompareFn for the default sort', () => {
    const legacy = [...dataSources].sort(getDataSourceCompareFn(undefined, [], [], []));
    const fast = sortWithFastPath(undefined, [], [], []);
    expect(fast.map((ds) => ds.uid)).toEqual(legacy.map((ds) => ds.uid));
  });

  it('matches the ordering of getDataSourceCompareFn when favorites and recent are set', () => {
    const legacy = [...dataSources].sort(getDataSourceCompareFn('c', ['D', 'a'], ['${foo}'], ['b']));
    const fast = sortWithFastPath('c', ['D', 'a'], ['${foo}'], ['b']);
    expect(fast.map((ds) => ds.uid)).toEqual(legacy.map((ds) => ds.uid));
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
