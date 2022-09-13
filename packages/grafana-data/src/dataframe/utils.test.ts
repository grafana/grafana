import { FieldType } from '../types';

import { toDataFrame } from './processDataFrame';
import { anySeriesWithTimeField } from './utils';

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
