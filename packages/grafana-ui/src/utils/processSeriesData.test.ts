import {
  isSeriesData,
  toLegacyResponseData,
  isTableData,
  toSeriesData,
  guessFieldTypes,
  guessFieldTypeFromValue,
} from './processSeriesData';
import { FieldType, TimeSeries, SeriesData, TableData } from '../types/data';
import { dateTime } from './moment_wrapper';

describe('toSeriesData', () => {
  it('converts timeseries to series', () => {
    const input1 = {
      target: 'Field Name',
      datapoints: [[100, 1], [200, 2]],
    };
    let series = toSeriesData(input1);
    expect(series.fields[0].name).toBe(input1.target);
    expect(series.rows).toBe(input1.datapoints);

    // Should fill a default name if target is empty
    const input2 = {
      // without target
      target: '',
      datapoints: [[100, 1], [200, 2]],
    };
    series = toSeriesData(input2);
    expect(series.fields[0].name).toEqual('Value');
  });

  it('keeps seriesData unchanged', () => {
    const input = {
      fields: [{ text: 'A' }, { text: 'B' }, { text: 'C' }],
      rows: [[100, 'A', 1], [200, 'B', 2], [300, 'C', 3]],
    };
    const series = toSeriesData(input);
    expect(series).toBe(input);
  });

  it('Guess Colum Types from value', () => {
    expect(guessFieldTypeFromValue(1)).toBe(FieldType.number);
    expect(guessFieldTypeFromValue(1.234)).toBe(FieldType.number);
    expect(guessFieldTypeFromValue(3.125e7)).toBe(FieldType.number);
    expect(guessFieldTypeFromValue(true)).toBe(FieldType.boolean);
    expect(guessFieldTypeFromValue(false)).toBe(FieldType.boolean);
    expect(guessFieldTypeFromValue(new Date())).toBe(FieldType.time);
    expect(guessFieldTypeFromValue(dateTime())).toBe(FieldType.time);
  });

  it('Guess Colum Types from strings', () => {
    expect(guessFieldTypeFromValue('1')).toBe(FieldType.number);
    expect(guessFieldTypeFromValue('1.234')).toBe(FieldType.number);
    expect(guessFieldTypeFromValue('3.125e7')).toBe(FieldType.number);
    expect(guessFieldTypeFromValue('True')).toBe(FieldType.boolean);
    expect(guessFieldTypeFromValue('FALSE')).toBe(FieldType.boolean);
    expect(guessFieldTypeFromValue('true')).toBe(FieldType.boolean);
    expect(guessFieldTypeFromValue('xxxx')).toBe(FieldType.string);
  });

  it('Guess Colum Types from series', () => {
    const series = {
      fields: [{ name: 'A (number)' }, { name: 'B (strings)' }, { name: 'C (nulls)' }, { name: 'Time' }],
      rows: [[123, null, null, '2000'], [null, 'Hello', null, 'XXX']],
    };
    const norm = guessFieldTypes(series);
    expect(norm.fields[0].type).toBe(FieldType.number);
    expect(norm.fields[1].type).toBe(FieldType.string);
    expect(norm.fields[2].type).toBeUndefined();
    expect(norm.fields[3].type).toBe(FieldType.time); // based on name
  });
});

describe('SerisData backwards compatibility', () => {
  it('converts TimeSeries to series and back again', () => {
    const timeseries = {
      target: 'Field Name',
      datapoints: [[100, 1], [200, 2]],
    };
    const series = toSeriesData(timeseries);
    expect(isSeriesData(timeseries)).toBeFalsy();
    expect(isSeriesData(series)).toBeTruthy();

    const roundtrip = toLegacyResponseData(series) as TimeSeries;
    expect(isSeriesData(roundtrip)).toBeFalsy();
    expect(roundtrip.target).toBe(timeseries.target);
  });

  it('converts TableData to series and back again', () => {
    const table = {
      columns: [{ text: 'a', unit: 'ms' }, { text: 'b', unit: 'zz' }, { text: 'c', unit: 'yy' }],
      rows: [[100, 1, 'a'], [200, 2, 'a']],
    };
    const series = toSeriesData(table);
    expect(isTableData(table)).toBeTruthy();
    expect(isSeriesData(series)).toBeTruthy();

    const roundtrip = toLegacyResponseData(series) as TimeSeries;
    expect(isTableData(roundtrip)).toBeTruthy();
    expect(roundtrip).toMatchObject(table);
  });

  it('converts SeriesData to TableData to series and back again', () => {
    const series: SeriesData = {
      refId: 'Z',
      meta: {
        somethign: 8,
      },
      fields: [
        { name: 'T', type: FieldType.time }, // first
        { name: 'N', type: FieldType.number, filterable: true },
        { name: 'S', type: FieldType.string, filterable: true },
      ],
      rows: [[1, 100, '1'], [2, 200, '2'], [3, 300, '3']],
    };
    const table = toLegacyResponseData(series) as TableData;
    expect(table.meta).toBe(series.meta);
    expect(table.refId).toBe(series.refId);

    const names = table.columns.map(c => c.text);
    expect(names).toEqual(['T', 'N', 'S']);
  });
});
