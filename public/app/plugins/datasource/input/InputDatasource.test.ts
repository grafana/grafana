import InputDatasource, { describeSeriesData } from './InputDatasource';
import { InputQuery, InputOptions } from './types';
import { readCSV, DataSourceInstanceSettings, PluginMeta } from '@grafana/ui';
import { getQueryOptions } from 'test/helpers/getQueryOptions';

describe('InputDatasource', () => {
  const data = readCSV('a,b,c\n1,2,3\n4,5,6');
  const instanceSettings: DataSourceInstanceSettings<InputOptions> = {
    id: 1,
    type: 'x',
    name: 'xxx',
    meta: {} as PluginMeta,
    jsonData: {
      data,
    },
  };

  describe('when querying', () => {
    test('should return the saved data with a query', () => {
      const ds = new InputDatasource(instanceSettings);
      const options = getQueryOptions<InputQuery>({
        targets: [{ refId: 'Z' }],
      });

      return ds.query(options).then(rsp => {
        expect(rsp.data.length).toBe(1);

        const series = rsp.data[0];
        expect(series.refId).toBe('Z');
        expect(series.rows).toEqual(data[0].rows);
      });
    });
  });

  test('SeriesData descriptions', () => {
    expect(describeSeriesData([])).toEqual('');
    expect(describeSeriesData(null)).toEqual('');
    expect(
      describeSeriesData([
        {
          name: 'x',
          fields: [{ name: 'a' }],
          rows: [],
        },
      ])
    ).toEqual('1 Fields, 0 Rows');
  });
});
