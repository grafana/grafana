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

  describe('when exporting table data to csv', () => {
    let tableCtx: any = {};
    beforeEach(() => {
      tableCtx = {
        columns: [
          { title: 'integer_value' },
          { text: 'string_value' },
          { title: 'float_value' },
          { text: 'boolean_value' },
        ],
        rows: [
          [1234, 'some_string', 1.234, true],
          [0o765, 'some string with " in the middle', 1e-2, false],
          [0o765, 'some string with "" in the middle', 1e-2, false],
          [0o765, '"some string with " at the beginning', 1e-2, false],
          [0o765, 'some string with " at the end"', 1e-2, false],
          [0x123, 'some string with \n in the middle', 10.01, false],
          [0x123, '\nsome string with \n at the beginning', 10.01, false],
          [0x123, 'some string with \n at the end\n', 10.01, false],
          [3, 'some string with \n\n in the middle', 10.01, false],
          [3, 'some string with \\n in the middle', 10.01, false],
          [0b1011, 'some string with ; in the middle', -12.34, true],
          [123, 'some string with ;; in the middle', -12.34, true],
        ],
      };
    });

    it('should properly escape special characters and quote all string values', () => {
      let text = fileExport.convertTableDataToCsv(tableCtx, false);
      const expectedText =
        '"integer_value";"string_value";"float_value";"boolean_value"\n' +
        '1234;"some_string";1.234;true\n' +
        '501;"some string with " in the middle";0.01;false\n' +
        '501;""some string with " at the beginning";0.01;false\n' +
        '501;"some string with " at the end"";0.01;false\n' +
        '501;"some string with "" in the middle";0.01;false\n' +
        '291;"some string with \\n in the middle";10.01;false\n' +
        '291;"\\nsome string with \\n at the beginning";10.01;false\n' +
        '291;"some string with \\n at the end\\n";10.01;false\n' +
        '3;"some string with \\n\\n in the middle";10.01;false\n' +
        '3;"some string with \\n in the middle";10.01;false\n' +
        '11;"some string with ; in the middle";-12.34;true\n' +
        '123;"some string with ;; in the middle";-12.34;true';

      expect(text).toBe(expectedText);
    });
  });
});
