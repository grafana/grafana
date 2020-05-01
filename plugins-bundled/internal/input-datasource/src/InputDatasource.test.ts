import InputDatasource, { describeDataFrame } from './InputDatasource';
import { InputOptions, InputQuery } from './types';
import {
  DataFrame,
  DataFrameDTO,
  DataSourceInstanceSettings,
  MutableDataFrame,
  PluginMeta,
  readCSV,
} from '@grafana/data';

import { getQueryOptions } from './testHelpers';

describe('InputDatasource', () => {
  const data = readCSV('a,b,c\n1,2,3\n4,5,6');
  const instanceSettings: DataSourceInstanceSettings<InputOptions> = {
    id: 1,
    uid: 'xxx',
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

        const series: DataFrame = rsp.data[0];
        expect(series.refId).toBe('Z');
        expect(series.fields[0].values).toEqual(data[0].fields[0].values);
      });
    });
  });

  test('DataFrame descriptions', () => {
    expect(describeDataFrame([])).toEqual('');
    expect(describeDataFrame((null as unknown) as Array<DataFrameDTO | DataFrame>)).toEqual('');
    expect(
      describeDataFrame([
        new MutableDataFrame({
          name: 'x',
          fields: [{ name: 'a' }],
        }),
      ])
    ).toEqual('1 Fields, 0 Rows');
  });
});
