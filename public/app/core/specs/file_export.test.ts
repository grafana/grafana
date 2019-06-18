import * as fileExport from '../utils/file_export';
import { beforeEach, expect } from 'test/lib/common';

describe('file_export', () => {
  const ctx: any = {};

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
      const text = fileExport.convertSeriesListToCsv(ctx.seriesList, ctx.timeFormat);
      const expectedText =
        '"Series";"Time";"Value"\r\n' +
        '"series_1";"1500026100";1\r\n' +
        '"series_1";"1500026200";2\r\n' +
        '"series_1";"1500026300";null\r\n' +
        '"series_1";"1500026400";null\r\n' +
        '"series_1";"1500026500";null\r\n' +
        '"series_1";"1500026600";6\r\n' +
        '"series_2";"1500026100";11\r\n' +
        '"series_2";"1500026200";12\r\n' +
        '"series_2";"1500026300";13\r\n' +
        '"series_2";"1500026500";15';

      expect(text).toBe(expectedText);
    });
  });

  describe('when exporting series as columns', () => {
    it('should export points in proper order', () => {
      const text = fileExport.convertSeriesListToCsvColumns(ctx.seriesList, ctx.timeFormat);
      const expectedText =
        '"Time";"series_1";"series_2"\r\n' +
        '"1500026100";1;11\r\n' +
        '"1500026200";2;12\r\n' +
        '"1500026300";null;13\r\n' +
        '"1500026400";null;null\r\n' +
        '"1500026500";null;15\r\n' +
        '"1500026600";6;null';

      expect(text).toBe(expectedText);
    });

    it('should not modify series.datapoints', () => {
      const expectedSeries1DataPoints = ctx.seriesList[0].datapoints.slice();
      const expectedSeries2DataPoints = ctx.seriesList[1].datapoints.slice();

      fileExport.convertSeriesListToCsvColumns(ctx.seriesList, ctx.timeFormat);

      expect(expectedSeries1DataPoints).toEqual(ctx.seriesList[0].datapoints);
      expect(expectedSeries2DataPoints).toEqual(ctx.seriesList[1].datapoints);
    });
  });

  describe('when exporting table data to csv', () => {
    it('should properly escape special characters and quote all string values', () => {
      const inputTable = {
        columns: [
          { title: 'integer_value' },
          { text: 'string_value' },
          { title: 'float_value' },
          { text: 'boolean_value' },
        ],
        rows: [
          [123, 'some_string', 1.234, true],
          [1000, 'some_string', 1.234567891, true],
          [0o765, 'some string with " in the middle', 1e-2, false],
          [0o765, 'some string with "" in the middle', 1e-2, false],
          [0o765, 'some string with """ in the middle', 1e-2, false],
          [0o765, '"some string with " at the beginning', 1e-2, false],
          [0o765, 'some string with " at the end"', 1e-2, false],
          [0x123, 'some string with \n in the middle', 10.01, false],
          [0b1011, 'some string with ; in the middle', -12.34, true],
          [123, 'some string with ;; in the middle', -12.34, true],
          [1234, '=a bogus formula  ', '-and another', '+another', '@ref'],
        ],
      };

      const returnedText = fileExport.convertTableDataToCsv(inputTable, false);

      const expectedText =
        '"integer_value";"string_value";"float_value";"boolean_value"\r\n' +
        '123;"some_string";1.234;true\r\n' +
        '1000;"some_string";1.234567891;true\r\n' +
        '501;"some string with "" in the middle";0.01;false\r\n' +
        '501;"some string with """" in the middle";0.01;false\r\n' +
        '501;"some string with """""" in the middle";0.01;false\r\n' +
        '501;"""some string with "" at the beginning";0.01;false\r\n' +
        '501;"some string with "" at the end""";0.01;false\r\n' +
        '291;"some string with \n in the middle";10.01;false\r\n' +
        '11;"some string with ; in the middle";-12.34;true\r\n' +
        '123;"some string with ;; in the middle";-12.34;true\r\n' +
        '1234;"\'=a bogus formula";"\'-and another";"\'+another";"\'@ref"';

      expect(returnedText).toBe(expectedText);
    });

    it('should decode HTML encoded characters', () => {
      const inputTable = {
        columns: [{ text: 'string_value' }],
        rows: [
          ['&quot;&amp;&auml;'],
          ['<strong>&quot;some html&quot;</strong>'],
          ['<a href="http://something/index.html">some text</a>'],
        ],
      };

      const returnedText = fileExport.convertTableDataToCsv(inputTable, false);

      const expectedText =
        '"string_value"\r\n' +
        '"""&ä"\r\n' +
        '"<strong>""some html""</strong>"\r\n' +
        '"<a href=""http://something/index.html"">some text</a>"';

      expect(returnedText).toBe(expectedText);
    });
  });
});
