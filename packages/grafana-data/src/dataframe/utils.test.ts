import { dateTime } from '../datetime';
import { FieldType } from '../types';

import { toDataFrame } from './processDataFrame';
import { anySeriesWithTimeField, shiftComparisonFramesTimestamps } from './utils';

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

  describe('shiftComparisonFramesTimestamps', () => {
    it('should do nothing if time range does not exist on data frame metadata', () => {
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

      shiftComparisonFramesTimestamps([frameA, frameB]);
      expect(frameA.fields[0].values).toEqual([100, 200, 300]);
      expect(frameB.fields[0].values).toEqual([100, 200, 300]);
    });

    it('should do nothing if time range does not exist on first data frame metadata but exists on others', () => {
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

      frameB.meta = {
        timeRange: {
          from: dateTime(1690966348),
          to: dateTime(1690966348),
          raw: {
            from: dateTime(1690966348),
            to: dateTime(1690966348),
          },
        },
      };

      shiftComparisonFramesTimestamps([frameA, frameB]);
      expect(frameA.fields[0].values).toEqual([100, 200, 300]);
      expect(frameB.fields[0].values).toEqual([100, 200, 300]);
    });

    it('should shift comparison frames', () => {
      const diff = 3600000; // 1h

      const referenceFrame = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1690966348, 1690966348 + diff / 2, 1690966348 + diff] },
          { name: 'value', type: FieldType.number, values: [1, 2, 3] },
        ],
      });

      referenceFrame.meta = {
        timeRange: {
          from: dateTime(1690966348),
          to: dateTime(1690966348 + diff),
          raw: {
            from: dateTime(1690966348),
            to: dateTime(1690966348 + diff),
          },
        },
      };

      // Shifted by 1h
      const shiftedFrame = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1690966348 - diff, 1690966348 - diff / 2, 1690966348] },
          { name: 'name', type: FieldType.string, values: ['a', 'b', 'c'] },
          { name: 'value', type: FieldType.number, values: [1, 2, 3] },
        ],
      });

      shiftedFrame.meta = {
        timeRange: {
          from: dateTime(1690966348 - diff),
          to: dateTime(1690966348),
          raw: {
            from: dateTime(1690966348 - diff),
            to: dateTime(1690966348),
          },
        },
      };

      shiftComparisonFramesTimestamps([referenceFrame, shiftedFrame]);

      expect(referenceFrame.fields[0].values).toEqual([1690966348, 1690966348 + diff / 2, 1690966348 + diff]);
      expect(shiftedFrame.fields[0].values).toEqual([1690966348, 1690966348 + diff / 2, 1690966348 + diff]);
    });
  });
});
