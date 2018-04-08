import * as fileExport from '../utils/file_export';
import { beforeEach, expect } from 'test/lib/common';

describe('file_export', () => {
  let ctx: any = {};

  beforeEach(() => {
    ctx.seriesList = [
      {
        alias: 'series_1',
        datapoints: [
          [1, 1500026100000],
          [2, 1500026200000],
          [null, 1500026300000],
          [null, 1500026400000],
          [null, 1500026500000],
          [6, 1500026600000],
        ],
      },
      {
        alias: 'series_2',
        datapoints: [[11, 1500026100000], [12, 1500026200000], [13, 1500026300000], [15, 1500026500000]],
      },
    ];

    ctx.timeFormat = 'X'; // Unix timestamp (seconds)
  });

  describe('when exporting series as rows', () => {
    it('should export points in proper order', () => {
      let text = fileExport.convertSeriesListToCsv(ctx.seriesList, ctx.timeFormat);
      const expectedText =
        'Series;Time;Value\n' +
        'series_1;1500026100;1\n' +
        'series_1;1500026200;2\n' +
        'series_1;1500026300;null\n' +
        'series_1;1500026400;null\n' +
        'series_1;1500026500;null\n' +
        'series_1;1500026600;6\n' +
        'series_2;1500026100;11\n' +
        'series_2;1500026200;12\n' +
        'series_2;1500026300;13\n' +
        'series_2;1500026500;15\n';

      expect(text).toBe(expectedText);
    });
  });

  describe('when exporting series as columns', () => {
    it('should export points in proper order', () => {
      let text = fileExport.convertSeriesListToCsvColumns(ctx.seriesList, ctx.timeFormat);
      const expectedText =
        'Time;series_1;series_2\n' +
        '1500026100;1;11\n' +
        '1500026200;2;12\n' +
        '1500026300;null;13\n' +
        '1500026400;null;null\n' +
        '1500026500;null;15\n' +
        '1500026600;6;null\n';

      expect(text).toBe(expectedText);
    });
  });
});
