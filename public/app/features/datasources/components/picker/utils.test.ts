import { DataSourceInstanceSettings, DataSourceRef } from '@grafana/data';

import { isDataSourceMatch, getDataSourceCompareFn } from './utils';

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
    { uid: 'a', name: 'a', meta: { builtIn: true } },
    { uid: 'b', name: 'b', meta: { builtIn: false } },
  ] as DataSourceInstanceSettings[];

  it('sorts built in datasources last and other data sources alphabetically', () => {
    dataSources.sort(getDataSourceCompareFn(undefined, [], []));
    expect(dataSources).toEqual([
      { uid: 'b', name: 'b', meta: { builtIn: false } },
      { uid: 'c', name: 'c', meta: { builtIn: false } },
      { uid: 'a', name: 'a', meta: { builtIn: true } },
    ] as DataSourceInstanceSettings[]);
  });

  it('sorts the current datasource before others', () => {
    dataSources.sort(getDataSourceCompareFn('c', [], []));
    expect(dataSources).toEqual([
      { uid: 'c', name: 'c', meta: { builtIn: false } },
      { uid: 'b', name: 'b', meta: { builtIn: false } },
      { uid: 'a', name: 'a', meta: { builtIn: true } },
    ] as DataSourceInstanceSettings[]);
  });

  it('sorts recently used datasources first', () => {
    dataSources.sort(getDataSourceCompareFn(undefined, ['c', 'a'], []));
    expect(dataSources).toEqual([
      { uid: 'a', name: 'a', meta: { builtIn: true } },
      { uid: 'c', name: 'c', meta: { builtIn: false } },
      { uid: 'b', name: 'b', meta: { builtIn: false } },
    ] as DataSourceInstanceSettings[]);
  });

  it('sorts variables before other datasources', () => {
    dataSources.sort(getDataSourceCompareFn(undefined, [], ['c', 'b']));
    expect(dataSources).toEqual([
      { uid: 'b', name: 'b', meta: { builtIn: false } },
      { uid: 'c', name: 'c', meta: { builtIn: false } },
      { uid: 'a', name: 'a', meta: { builtIn: true } },
    ] as DataSourceInstanceSettings[]);
  });

  it('sorts datasources current -> recently used -> variables -> others -> built in', () => {
    const dataSources = [
      { uid: 'a', name: 'a', meta: { builtIn: true } },
      { uid: 'b', name: 'b', meta: { builtIn: false } },
      { uid: 'c', name: 'c', meta: { builtIn: false } },
      { uid: 'e', name: 'e', meta: { builtIn: false } },
      { uid: 'd', name: 'd', meta: { builtIn: false } },
      { uid: 'f', name: 'f', meta: { builtIn: false } },
    ] as DataSourceInstanceSettings[];

    dataSources.sort(getDataSourceCompareFn('c', ['b', 'e'], ['d']));
    expect(dataSources).toEqual([
      { uid: 'c', name: 'c', meta: { builtIn: false } },
      { uid: 'e', name: 'e', meta: { builtIn: false } },
      { uid: 'b', name: 'b', meta: { builtIn: false } },
      { uid: 'd', name: 'd', meta: { builtIn: false } },
      { uid: 'f', name: 'f', meta: { builtIn: false } },
      { uid: 'a', name: 'a', meta: { builtIn: true } },
    ] as DataSourceInstanceSettings[]);
  });
});
