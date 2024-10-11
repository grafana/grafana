import { FieldType } from '../types/dataFrame';

import { createDataFrame, toDataFrame } from './processDataFrame';
import { anySeriesWithTimeField, addRow } from './utils';

describe('anySeriesWithTimeField', () => {
  describe('single frame', () => {
    test('without time field', () => {
      const frameA = toDataFrame({
        fields: [
          { name: 'name', type: FieldType.string, values: ['a', 'b', 'c'] },
          { name: 'value', type: FieldType.number, values: [1, 2, 3] },
        ],
      });
      expect(anySeriesWithTimeField([frameA])).toBeFalsy();
    });

    test('with time field', () => {
      const frameA = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [100, 200, 300] },
          { name: 'name', type: FieldType.string, values: ['a', 'b', 'c'] },
          { name: 'value', type: FieldType.number, values: [1, 2, 3] },
        ],
      });
      expect(anySeriesWithTimeField([frameA])).toBeTruthy();
    });
  });

  describe('multiple frames', () => {
    test('without time field', () => {
      const frameA = toDataFrame({
        fields: [
          { name: 'name', type: FieldType.string, values: ['a', 'b', 'c'] },
          { name: 'value', type: FieldType.number, values: [1, 2, 3] },
        ],
      });
      const frameB = toDataFrame({
        fields: [{ name: 'value', type: FieldType.number, values: [1, 2, 3] }],
      });
      expect(anySeriesWithTimeField([frameA, frameB])).toBeFalsy();
    });

    test('with time field in any frame', () => {
      const frameA = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [100, 200, 300] },
          { name: 'name', type: FieldType.string, values: ['a', 'b', 'c'] },
          { name: 'value', type: FieldType.number, values: [1, 2, 3] },
        ],
      });
      const frameB = toDataFrame({
        fields: [{ name: 'value', type: FieldType.number, values: [1, 2, 3] }],
      });
      const frameC = toDataFrame({
        fields: [{ name: 'name', type: FieldType.string, values: ['a', 'b', 'c'] }],
      });

      expect(anySeriesWithTimeField([frameA, frameB, frameC])).toBeTruthy();
    });

    test('with time field in a all frames', () => {
      const frameA = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [100, 200, 300] },
          { name: 'value', type: FieldType.number, values: [1, 2, 3] },
        ],
      });
      const frameB = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [100, 200, 300] },
          { name: 'name', type: FieldType.string, values: ['a', 'b', 'c'] },
          { name: 'value', type: FieldType.number, values: [1, 2, 3] },
        ],
      });
      expect(anySeriesWithTimeField([frameA, frameB])).toBeTruthy();
    });
  });
});

describe('addRow', () => {
  const frame = createDataFrame({
    fields: [
      { name: 'name', type: FieldType.string },
      { name: 'date', type: FieldType.time },
      { name: 'number', type: FieldType.number },
    ],
  });
  const date = Date.now();

  it('adds row to data frame as object', () => {
    addRow(frame, { name: 'A', date, number: 1 });
    expect(frame.fields[0].values[0]).toBe('A');
    expect(frame.fields[1].values[0]).toBe(date);
    expect(frame.fields[2].values[0]).toBe(1);
    expect(frame.length).toBe(1);
  });

  it('adds row to data frame as array', () => {
    addRow(frame, ['B', date, 42]);
    expect(frame.fields[0].values[1]).toBe('B');
    expect(frame.fields[1].values[1]).toBe(date);
    expect(frame.fields[2].values[1]).toBe(42);
    expect(frame.length).toBe(2);
  });
});
