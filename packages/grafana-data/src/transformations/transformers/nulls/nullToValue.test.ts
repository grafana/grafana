import { FieldType, createDataFrame } from '@grafana/data';

import { applyNullInsertThreshold } from './nullInsertThreshold';
import { nullToValue } from './nullToValue';

describe('nullToValue Transformer', () => {
  test('should change all nulls to configured zero value', () => {
    const df = createDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1, 3, 10] },
        {
          name: 'One',
          type: FieldType.number,
          config: { custom: { insertNulls: 1 }, noValue: '0' },
          values: [4, 6, 8],
        },
        {
          name: 'Two',
          type: FieldType.string,
          config: { custom: { insertNulls: 1 }, noValue: '0' },
          values: ['a', 'b', 'c'],
        },
      ],
    });

    const result = nullToValue(applyNullInsertThreshold({ frame: df }));

    expect(result.fields[0].values).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result.fields[1].values).toEqual([4, 0, 6, 0, 0, 0, 0, 0, 0, 8]);
    expect(result.fields[2].values).toEqual(['a', 0, 'b', 0, 0, 0, 0, 0, 0, 'c']);
  });

  test('should change all nulls to configured positive value', () => {
    const df = createDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [5, 7, 11] },
        {
          name: 'One',
          type: FieldType.number,
          config: { custom: { insertNulls: 2 }, noValue: '1' },
          values: [4, 6, 8],
        },
        {
          name: 'Two',
          type: FieldType.string,
          config: { custom: { insertNulls: 2 }, noValue: '1' },
          values: ['a', 'b', 'c'],
        },
      ],
    });

    const result = nullToValue(applyNullInsertThreshold({ frame: df }));

    expect(result.fields[0].values).toEqual([5, 7, 9, 11]);
    expect(result.fields[1].values).toEqual([4, 6, 1, 8]);
    expect(result.fields[2].values).toEqual(['a', 'b', 1, 'c']);
  });

  test('should change all nulls to configured negative value', () => {
    const df = createDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, config: { interval: 1 }, values: [1, 3, 10] },
        { name: 'One', type: FieldType.number, config: { noValue: '-1' }, values: [4, 6, 8] },
        { name: 'Two', type: FieldType.string, config: { noValue: '-1' }, values: ['a', 'b', 'c'] },
      ],
    });

    const result = nullToValue(applyNullInsertThreshold({ frame: df }));

    expect(result.fields[0].values).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result.fields[1].values).toEqual([4, -1, 6, -1, -1, -1, -1, -1, -1, 8]);
    expect(result.fields[2].values).toEqual(['a', -1, 'b', -1, -1, -1, -1, -1, -1, 'c']);
  });

  test('should have no effect without nulls', () => {
    const df = createDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, config: { interval: 1 }, values: [1, 2, 3] },
        { name: 'One', type: FieldType.number, values: [4, 6, 8] },
        { name: 'Two', type: FieldType.string, values: ['a', 'b', 'c'] },
      ],
    });

    const result = nullToValue(applyNullInsertThreshold({ frame: df, refFieldName: null }));

    expect(result.fields[0].values).toEqual([1, 2, 3]);
    expect(result.fields[1].values).toEqual([4, 6, 8]);
    expect(result.fields[2].values).toEqual(['a', 'b', 'c']);
  });
});
