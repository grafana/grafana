import { FieldType, MutableDataFrame } from '@grafana/data';
import { fillGaps } from './fillGaps';

describe('fillGaps', () => {
  test('should fill nulls as expected', () => {
    const df = new MutableDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, config: { interval: 1 }, values: [1, 3, 10] },
        { name: 'One', type: FieldType.number, values: [4, 6, 8] },
        { name: 'Two', type: FieldType.string, values: ['a', 'b', 'c'] },
      ],
    });
    const result = fillGaps(df);
    expect(result.fields[0].values.toArray()).toStrictEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result.fields[1].values.toArray()).toStrictEqual([4, null, 6, null, null, null, null, null, null, 8]);
    expect(result.fields[2].values.toArray()).toStrictEqual(['a', null, 'b', null, null, null, null, null, null, 'c']);
  });

  test('should not insert nulls for out of order timestamps', () => {
    const df = new MutableDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, config: { interval: 1 }, values: [3, 1] },
        { name: 'Value', type: FieldType.number, values: [6, 8] },
      ],
    });
    const result = fillGaps(df);
    expect(result.fields[0].values.toArray()).toStrictEqual([3, 1]);
    expect(result.fields[1].values.toArray()).toStrictEqual([6, 8]);
  });

  test('should not modify frame when missing interval', () => {
    const df = new MutableDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1, 3] },
        { name: 'Value', type: FieldType.number, values: [6, 8] },
      ],
    });
    const result = fillGaps(df);
    expect(result.fields[0].values.toArray()).toStrictEqual([1, 3]);
    expect(result.fields[1].values.toArray()).toStrictEqual([6, 8]);
  });

  test('should handle empty field values with interval', () => {
    const df = new MutableDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, config: { interval: 2 }, values: [] },
        { name: 'Value', type: FieldType.number, values: [] },
      ],
    });
    const result = fillGaps(df);
    expect(result.fields[0].values.toArray()).toStrictEqual([]);
    expect(result.fields[1].values.toArray()).toStrictEqual([]);
  });

  test('should handle timestamp alignment issues', () => {
    const df = new MutableDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, config: { interval: 2 }, values: [1, 4, 8] },
        { name: 'Value', type: FieldType.number, values: [0, 1, 2] },
      ],
    });
    const result = fillGaps(df);
    expect(result.fields[0].values.toArray()).toStrictEqual([1, 3, 4, 6, 8]);
    expect(result.fields[1].values.toArray()).toStrictEqual([0, null, 1, null, 2]);
  });
});
