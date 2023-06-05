import { DataSourceInstanceSettings, DataSourceRef } from '@grafana/data';

import { isDataSourceMatch } from './utils';

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
