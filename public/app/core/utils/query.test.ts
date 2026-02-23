import { DataQuery } from '@grafana/data';

import { queryIsEmpty, isDataQuery } from './query';

interface TestQuery extends DataQuery {
  name?: string;
}

describe('queryIsEmpty', () => {
  it('should return true if query only includes props that are defined in the DataQuery interface', () => {
    const testQuery: DataQuery = { refId: 'A' };
    expect(queryIsEmpty(testQuery)).toEqual(true);
  });

  it('should return true if query only includes props that are defined in the DataQuery interface and a label prop', () => {
    const testQuery: DataQuery & { label: string } = { refId: 'A', label: '' };
    expect(queryIsEmpty(testQuery)).toEqual(true);
  });

  it('should return false if query only includes props that are not defined in the DataQuery interface', () => {
    const testQuery: TestQuery = { refId: 'A', name: 'test' };
    expect(queryIsEmpty(testQuery)).toEqual(false);
  });
});

describe('isDataQuery', () => {
  it('should return false for empty-string', () => {
    const url = '';
    expect(isDataQuery(url)).toEqual(false);
  });

  it('should return true if URL starts with /api/ds/query', () => {
    const url = '/api/ds/query?a=b';
    expect(isDataQuery(url)).toEqual(true);
  });

  it('should return true if URL starts with /api/datasources/proxy', () => {
    const url = '/api/datasources/proxy/a/b/c';
    expect(isDataQuery(url)).toEqual(true);
  });

  it('should return true for query-service-style URLs', () => {
    const url = '/apis/query.grafana.app/v0alpha1/namespaces/something/query?ds_type=prometheus';
    expect(isDataQuery(url)).toEqual(true);
  });

  it('should return false for other URLs', () => {
    const url = '/api/something/else';
    expect(isDataQuery(url)).toEqual(false);
  });
});
