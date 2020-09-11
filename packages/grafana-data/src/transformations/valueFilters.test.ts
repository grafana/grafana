import { valueFiltersRegistry, ValueFilterID } from './valueFilters';
import { FieldType, Field, ArrayVector } from '@grafana/data';

function createField<T>(name: string, values?: T[], type: FieldType): Field<T> {
  const arr = new ArrayVector(values);
  return {
    name,
    config: {},
    type: type,
    values: arr,
  };
}

describe('Value filters', () => {
  it('should match greater', () => {
    let datasetMatch = [1.51, 2, 3, 100];
    let datasetNoMatch = [1.5, -2, 0, 1.4, -100];

    let filterInfo = valueFiltersRegistry.get(ValueFilterID.greater);
    let filter = filterInfo.getInstance({
      filterExpression: '1.5',
      fieldType: FieldType.number,
    });

    expect(filter.isValid).toBe(true);
    expect(datasetMatch.every(val => filter.test(val))).toBe(true);
    expect(datasetNoMatch.some(val => filter.test(val))).toBe(false);
  });

  it('should match greater or equal', () => {
    let datasetMatch = [1.5, 1.51, 2, 3, 100];
    let datasetNoMatch = [-2, 0, 1.4, -100];

    let filterInfo = valueFiltersRegistry.get(ValueFilterID.greaterOrEqual);
    let filter = filterInfo.getInstance({
      filterExpression: '1.5',
      fieldType: FieldType.number,
    });

    expect(filter.isValid).toBe(true);
    expect(datasetMatch.every(val => filter.test(val))).toBe(true);
    expect(datasetNoMatch.some(val => filter.test(val))).toBe(false);
  });

  it('should match lower', () => {
    let datasetMatch = [-1.51, -2, -3, -100, 1];
    let datasetNoMatch = [1.5, 1.6, 100];

    let filterInfo = valueFiltersRegistry.get(ValueFilterID.lower);
    let filter = filterInfo.getInstance({
      filterExpression: '1.5',
      fieldType: FieldType.number,
    });

    expect(filter.isValid).toBe(true);
    expect(datasetMatch.every(val => filter.test(val))).toBe(true);
    expect(datasetNoMatch.some(val => filter.test(val))).toBe(false);
  });

  it('should match lower or equal', () => {
    let datasetNoMatch = [1.51, 2, 3, 100];
    let datasetMatch = [-2, 0, 1.4, -100, 1.5];

    let filterInfo = valueFiltersRegistry.get(ValueFilterID.lowerOrEqual);
    let filter = filterInfo.getInstance({
      filterExpression: '1.5',
      fieldType: FieldType.number,
    });

    expect(filter.isValid).toBe(true);
    expect(datasetMatch.every(val => filter.test(val))).toBe(true);
    expect(datasetNoMatch.some(val => filter.test(val))).toBe(false);
  });

  it('should match null', () => {
    let datasetMatch = [null];
    let datasetNoMatch = [0, undefined, '', [], 0.0, 1, 38, 'abc'];

    let filterInfo = valueFiltersRegistry.get(ValueFilterID.isNull);
    let filter = filterInfo.getInstance({
      filterExpression: '',
      fieldType: FieldType.number,
    });

    expect(filter.isValid).toBe(true);
    expect(datasetMatch.every(val => filter.test(val))).toBe(true);
    expect(datasetNoMatch.some(val => filter.test(val))).toBe(false);
  });

  it('should match not null', () => {
    let datasetMatch = [0, undefined, '', [], 0.0, 1, 38, 'abc'];
    let datasetNoMatch = [null];

    let filterInfo = valueFiltersRegistry.get(ValueFilterID.isNotNull);
    let filter = filterInfo.getInstance({
      filterExpression: '',
      fieldType: FieldType.number,
    });

    expect(filter.isValid).toBe(true);
    expect(datasetMatch.every(val => filter.test(val))).toBe(true);
    expect(datasetNoMatch.some(val => filter.test(val))).toBe(false);
  });

  it('should match equal', () => {
    let dataset = [
      [123, FieldType.number, '123', true],
      [123, FieldType.number, ' 0123 ', true],
      [123, FieldType.number, '123.0', true],
      [123, FieldType.number, '1234', false],
      ['123', FieldType.string, '123', true],
      [null, FieldType.string, 'null', false],
    ];

    for (let [value, fieldType, filterExpression, result] of dataset) {
      let filterInfo = valueFiltersRegistry.get(ValueFilterID.equal);
      let filter = filterInfo.getInstance({ filterExpression, fieldType });
      expect(filter.isValid).toBe(true);
      expect(filter.test(value)).toBe(result);
    }
  });

  it('should match different', () => {
    let dataset = [
      [123, FieldType.number, '123', false],
      ['123', FieldType.string, ' 0123 ', true],
      [null, FieldType.number, '123.0', true],
      [12355, FieldType.number, '1234', true],
      ['123', FieldType.string, '123', false],
      [null, FieldType.string, 'null', true],
    ];

    for (let [value, fieldType, filterExpression, result] of dataset) {
      let filterInfo = valueFiltersRegistry.get(ValueFilterID.notEqual);
      let filter = filterInfo.getInstance({ filterExpression, fieldType });
      expect(filter.isValid).toBe(true);
      expect(filter.test(value)).toBe(result);
    }
  });

  it('should match regex', () => {
    let dataset = [
      [123, FieldType.number, '123', true],
      [123, FieldType.number, '123.0', false],
      [123.1, FieldType.number, '123', true],
      ['123', FieldType.string, ' 0123 ', false],
      ['abc', FieldType.string, 'a.+', true],
      [null, FieldType.string, 'null', false],
      [null, FieldType.number, 'null', false],
    ];

    for (let [value, fieldType, filterExpression, result] of dataset) {
      let filterInfo = valueFiltersRegistry.get(ValueFilterID.regex);
      let filter = filterInfo.getInstance({ filterExpression, fieldType });
      expect(filter.isValid).toBe(true);
      expect(filter.test(value)).toBe(result);
    }
  });

  it('should match range', () => {
    let datasetNoMatch = [-5, -4, -3, -1.1, 3.1, 4, 5, 100];
    let datasetMatch = [-1, 0, 0.5, 1, 1.2, 2];

    let filterInfo = valueFiltersRegistry.get(ValueFilterID.range);
    let filter = filterInfo.getInstance({
      filterExpression: '-1',
      filterExpression2: '2',
      fieldType: FieldType.number,
    });

    expect(filter.isValid).toBe(true);
    expect(datasetMatch.every(val => filter.test(val))).toBe(true);
    expect(datasetNoMatch.some(val => filter.test(val))).toBe(false);
  });
});
