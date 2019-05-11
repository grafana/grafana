import { DataProcessor } from '../data_processor';
import { getProcessedSeriesData } from 'app/features/dashboard/state/PanelQueryState';

describe('Graph DataProcessor', () => {
  const panel: any = {
    xaxis: { mode: 'series' },
    aliasColors: {},
  };

  const processor = new DataProcessor(panel);

  describe('getTimeSeries from LegacyResponseData', () => {
    // Try each type of data
    const dataList = getProcessedSeriesData([
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
