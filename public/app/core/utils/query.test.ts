import { DataQuery } from '@grafana/data';

import { queryIsEmpty } from './query';

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
