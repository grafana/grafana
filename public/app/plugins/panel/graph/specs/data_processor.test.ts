import { DataProcessor } from '../data_processor';
import { getProcessedDataFrames } from 'app/features/dashboard/state/runRequest';

describe('Graph DataProcessor', () => {
  const panel: any = {
    xaxis: { mode: 'series' },
    aliasColors: {},
  };

  const processor = new DataProcessor(panel);

  describe('getTimeSeries from LegacyResponseData', () => {
    // Try each type of data
    const dataList = getProcessedDataFrames([
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
          { name: 'v1', values: [0.1, 0.2, 0.3] }, // first
          { name: 'v2', values: [1.1, 2.2, 3.3] }, // second
          { name: 'string', values: ['a', 'b', 'c'] }, // skip
          { name: 'time', values: [1001, 1002, 1003] }, // Time is last column
        ],
      },
    ]);

    it('Should return a new series for each field', () => {
      panel.xaxis.mode = 'series';
      const series = processor.getSeriesList({ dataList });
      expect(series.length).toEqual(5);

      expect(series).toMatchSnapshot();
    });

    it('Should return single histogram', () => {
      panel.xaxis.mode = 'histogram';
      const series = processor.getSeriesList({ dataList });
      expect(series.length).toEqual(1);
      expect(series).toMatchSnapshot();
    });
  });
});
