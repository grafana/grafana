import { type DataSourceInstanceSettings, type DataSourceRef } from '@grafana/data';

import {
  isDataSourceMatch,
  sortDataSources,
  createDataSourceSearchIndex,
  searchDataSources,
  type DataSourceSortOptions,
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

describe('sortDataSources', () => {
  const dataSources = [
    { uid: 'c', name: 'c', meta: { builtIn: false } },
    { uid: 'D', name: 'D', meta: { builtIn: false } },
    { uid: 'a', name: 'a', meta: { builtIn: true } },
    { uid: 'b', name: 'b', meta: { builtIn: false } },
  ] as DataSourceInstanceSettings[];

  const sortedUids = (list: DataSourceInstanceSettings[], options?: DataSourceSortOptions) =>
    sortDataSources(list, options).map((ds) => ds.uid);

  it('sorts data sources alphabetically ignoring capitalization, built-in data sources last', () => {
    expect(sortedUids(dataSources)).toEqual(['b', 'c', 'D', 'a']);
  });

  it('does not mutate the given list', () => {
    sortDataSources(dataSources);
    expect(dataSources.map((ds) => ds.uid)).toEqual(['c', 'D', 'a', 'b']);
  });

  it('sorts the current datasource before others', () => {
    expect(sortedUids(dataSources, { current: 'c' })).toEqual(['c', 'b', 'D', 'a']);
    expect(sortedUids(dataSources, { current: { uid: 'D' } })).toEqual(['D', 'b', 'c', 'a']);
  });

  it('sorts recently used datasources first, most recent first', () => {
    expect(sortedUids(dataSources, { recentlyUsed: ['c', 'a'] })).toEqual(['a', 'c', 'b', 'D']);
  });

  it('sorts favorite datasources first, alphabetically', () => {
    expect(sortedUids(dataSources, { favorites: ['c', 'a'] })).toEqual(['a', 'c', 'b', 'D']);
  });

  it('sorts variables before other datasources', () => {
    expect(sortedUids(dataSources, { variableIds: ['c', 'b'] })).toEqual(['b', 'c', 'D', 'a']);
    expect(sortedUids(dataSources, { variableIds: ['D'] })).toEqual(['D', 'b', 'c', 'a']);
  });

  it('sorts datasources current -> favorite -> recently used -> variables -> others -> built in', () => {
    const dataSources = [
      { uid: 'a', name: 'a', meta: { builtIn: true } },
      { uid: 'b', name: 'b', meta: { builtIn: false } },
      { uid: 'c', name: 'c', meta: { builtIn: false } },
      { uid: 'e', name: 'e', meta: { builtIn: false } },
      { uid: 'D', name: 'D', meta: { builtIn: false } },
      { uid: 'f', name: 'f', meta: { builtIn: false } },
      { uid: 'g', name: 'g', meta: { builtIn: false } },
    ] as DataSourceInstanceSettings[];

    expect(
      sortedUids(dataSources, { current: 'c', recentlyUsed: ['b', 'e'], variableIds: ['g'], favorites: ['f'] })
    ).toEqual(['c', 'f', 'e', 'b', 'g', 'D', 'a']);
  });
});

describe('searchDataSources', () => {
  const ds = (name: string, pluginName = 'Prometheus', type = 'prometheus') =>
    ({ uid: name, name, type, meta: { name: pluginName } }) as DataSourceInstanceSettings;

  const search = (list: DataSourceInstanceSettings[], query: string) =>
    searchDataSources(createDataSourceSearchIndex(list), query).map((d) => d.name);

  it('returns the list unchanged when the search is empty', () => {
    const list = [ds('b'), ds('a')];
    expect(searchDataSources(createDataSourceSearchIndex(list), '')).toBe(list);
  });

  it('matches part of the name, ignoring case', () => {
    const list = [ds('My SQL DB', 'MySQL', 'mysql'), ds('PostgreSQL DB', 'PostgreSQL', 'postgres')];
    expect(search(list, 'SQL')).toEqual(['My SQL DB', 'PostgreSQL DB']);
    expect(search(list, 'postgre')).toEqual(['PostgreSQL DB']);
    expect(search(list, 'Oracle')).toEqual([]);
  });
});
