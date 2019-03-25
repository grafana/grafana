import { parseCSV, toSeriesData, guessFieldTypes, guessFieldTypeFromValue } from './processSeriesData';
import { FieldType } from '../types/data';
import moment from 'moment';

describe('processSeriesData', () => {
  describe('basic processing', () => {
    it('should read header and two rows', () => {
      const text = 'a,b,c\n1,2,3\n4,5,6';
      expect(parseCSV(text)).toMatchSnapshot();
    });

    it('should generate a header and fix widths', () => {
      const text = '1\n2,3,4\n5,6';
      const series = parseCSV(text, {
        headerIsFirstLine: false,
      });
      expect(series.rows.length).toBe(3);

      expect(series).toMatchSnapshot();
    });
  });
});

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
    expect(guessFieldTypeFromValue(moment())).toBe(FieldType.time);
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
