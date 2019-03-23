import { parseCSV, toTableData, guessColumnTypes, guessColumnTypeFromValue } from './processTableData';
import { ColumnType } from '../types/data';
import moment from 'moment';

describe('processTableData', () => {
  describe('basic processing', () => {
    it('should read header and two rows', () => {
      const text = 'a,b,c\n1,2,3\n4,5,6';
      expect(parseCSV(text)).toMatchSnapshot();
    });

    it('should generate a header and fix widths', () => {
      const text = '1\n2,3,4\n5,6';
      const table = parseCSV(text, {
        headerIsFirstLine: false,
      });
      expect(table.rows.length).toBe(3);

      expect(table).toMatchSnapshot();
    });
  });
});

describe('toTableData', () => {
  it('converts timeseries to table ', () => {
    const input1 = {
      target: 'Field Name',
      datapoints: [[100, 1], [200, 2]],
    };
    let table = toTableData(input1);
    expect(table.columns[0].text).toBe(input1.target);
    expect(table.rows).toBe(input1.datapoints);

    // Should fill a default name if target is empty
    const input2 = {
      // without target
      target: '',
      datapoints: [[100, 1], [200, 2]],
    };
    table = toTableData(input2);
    expect(table.columns[0].text).toEqual('Value');
  });

  it('keeps tableData unchanged', () => {
    const input = {
      columns: [{ text: 'A' }, { text: 'B' }, { text: 'C' }],
      rows: [[100, 'A', 1], [200, 'B', 2], [300, 'C', 3]],
    };
    const table = toTableData(input);
    expect(table).toBe(input);
  });

  it('Guess Colum Types from value', () => {
    expect(guessColumnTypeFromValue(1)).toBe(ColumnType.number);
    expect(guessColumnTypeFromValue(1.234)).toBe(ColumnType.number);
    expect(guessColumnTypeFromValue(3.125e7)).toBe(ColumnType.number);
    expect(guessColumnTypeFromValue(true)).toBe(ColumnType.boolean);
    expect(guessColumnTypeFromValue(false)).toBe(ColumnType.boolean);
    expect(guessColumnTypeFromValue(new Date())).toBe(ColumnType.time);
    expect(guessColumnTypeFromValue(moment())).toBe(ColumnType.time);
  });

  it('Guess Colum Types from strings', () => {
    expect(guessColumnTypeFromValue('1')).toBe(ColumnType.number);
    expect(guessColumnTypeFromValue('1.234')).toBe(ColumnType.number);
    expect(guessColumnTypeFromValue('3.125e7')).toBe(ColumnType.number);
    expect(guessColumnTypeFromValue('True')).toBe(ColumnType.boolean);
    expect(guessColumnTypeFromValue('FALSE')).toBe(ColumnType.boolean);
    expect(guessColumnTypeFromValue('true')).toBe(ColumnType.boolean);
    expect(guessColumnTypeFromValue('xxxx')).toBe(ColumnType.string);
  });

  it('Guess Colum Types from table', () => {
    const table = {
      columns: [{ text: 'A (number)' }, { text: 'B (strings)' }, { text: 'C (nulls)' }, { text: 'Time' }],
      rows: [[123, null, null, '2000'], [null, 'Hello', null, 'XXX']],
    };
    const norm = guessColumnTypes(table);
    expect(norm.columns[0].type).toBe(ColumnType.number);
    expect(norm.columns[1].type).toBe(ColumnType.string);
    expect(norm.columns[2].type).toBeUndefined();
    expect(norm.columns[3].type).toBe(ColumnType.time); // based on name
  });
});
