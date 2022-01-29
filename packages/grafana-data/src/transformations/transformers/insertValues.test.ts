import { FieldType, MutableDataFrame } from '@grafana/data';
import { insertValuesInterval } from './insertValues';

describe('insertValues Transformer (mode: interval)', () => {
  test('should fill nulls as expected', () => {
    const df = new MutableDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, config: { interval: 1 }, values: [1, 3, 10] },
        { name: 'One', type: FieldType.number, values: [4, 6, 8] },
        { name: 'Two', type: FieldType.string, values: ['a', 'b', 'c'] },
      ],
    });
    const result = insertValuesInterval(df);
    expect(result.fields[0].values.toArray()).toStrictEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result.fields[1].values.toArray()).toStrictEqual([4, null, 6, null, null, null, null, null, null, 8]);
    expect(result.fields[2].values.toArray()).toStrictEqual(['a', null, 'b', null, null, null, null, null, null, 'c']);
  });

  test('should fill nulls as expected', () => {
    const df = new MutableDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, config: { interval: 2 }, values: [5, 7, 11] },
        { name: 'One', type: FieldType.number, values: [4, 6, 8] },
        { name: 'Two', type: FieldType.string, values: ['a', 'b', 'c'] },
      ],
    });
    const result = insertValuesInterval(df);
    expect(result.fields[0].values.toArray()).toStrictEqual([5, 7, 9, 11]);
    expect(result.fields[1].values.toArray()).toStrictEqual([4, 6, null, 8]);
    expect(result.fields[2].values.toArray()).toStrictEqual(['a', 'b', null, 'c']);
  });

  test('should not modify frame when missing interval', () => {
    const df = new MutableDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1, 3] },
        { name: 'Value', type: FieldType.number, values: [6, 8] },
      ],
    });
    const result = insertValuesInterval(df);
    expect(result.fields[0].values.toArray()).toStrictEqual([1, 3]);
    expect(result.fields[1].values.toArray()).toStrictEqual([6, 8]);
  });

  test('can guess interval from data', () => {
    const df = new MutableDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1, 3, 4] },
        { name: 'Value', type: FieldType.number, values: [6, 8, 9] },
      ],
    });
    const result = insertValuesInterval(df, null, true);
    expect(result.fields[0].values.toArray()).toStrictEqual([1, 2, 3, 4]);
    expect(result.fields[1].values.toArray()).toStrictEqual([6, null, 8, 9]);
  });

  test('should handle empty field values with interval', () => {
    const df = new MutableDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [] },
        { name: 'Value', type: FieldType.number, config: { interval: 2 }, values: [] },
      ],
    });
    const result = insertValuesInterval(df);
    expect(result.fields[0].values.toArray()).toStrictEqual([]);
    expect(result.fields[1].values.toArray()).toStrictEqual([]);
  });
});
