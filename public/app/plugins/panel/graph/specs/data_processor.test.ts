import { DataProcessor } from '../data_processor';
import { LegacyResponseData } from '@grafana/ui';

describe('Graph DataProcessor', () => {
  const panel: any = {
    xaxis: {},
    aliasColors: {},
  };

  const processor = new DataProcessor(panel);

  describe('getTimeSeries from LegacyResponseData', () => {
    // Try each type of data
    const dataList = [
      {
        alias: 'First (time_series)',
        datapoints: [[1, 1001], [2, 1002], [3, 1003]],
        unit: 'watt',
      },
      {
        name: 'table_data',
        columns: [
          { text: 'time' },
          { text: 'v1', unit: 'ohm' },
          { text: 'v2' }, // no unit
          { text: 'string' }, // skipped
        ],
        rows: [
          [1001, 0.1, 1.1, 'a'], // a
          [1002, 0.2, 2.2, 'b'], // b
          [1003, 0.3, 3.3, 'c'], // c
        ],
      },
      {
        name: 'series',
        fields: [
          { name: 'v1' }, // first
          { name: 'v2' }, // second
          { name: 'string' }, // skip
          { name: 'time' }, // Time is last column
        ],
        rows: [[0.1, 1.1, 'a', 1001], [0.2, 2.2, 'b', 1002], [0.3, 3.3, 'c', 1003]],
      },
    ] as LegacyResponseData[];

    it('Should return a new series for each field', () => {
      const series = processor.getTimeSeries(dataList, { dataList: [] });
      expect(series.length).toEqual(5);
      expect(series).toMatchSnapshot();
    });
  });
});
