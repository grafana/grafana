import TableDatasource from './datasource';
import { TableQuery } from './types';
import { readCSV } from '@grafana/ui';
import { getQueryOptions } from 'test/helpers/getQueryOptions';

describe('TableDatasource', () => {
  const data = readCSV('a,b,c\n1,2,3\n4,5,6');
  const instanceSettings: any = {
    jsonData: {
      data,
    },
  };

  describe('when querying', () => {
    test('should return the saved data with a query', () => {
      const ds = new TableDatasource(instanceSettings);
      const options = getQueryOptions<TableQuery>({
        targets: [{ refId: 'Z' }],
      });

      return ds.query(options).then(rsp => {
        expect(rsp.data.length).toBe(1);
        expect(rsp.data[0]).toEqual(data[0]);
      });
    });
  });
});
