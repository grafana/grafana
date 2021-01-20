import { ArrayVector, DataFrame, FieldType, toDataFrame } from '@grafana/data';
import { AlignedFrameWithGapTest } from '../uPlot/types';
import { alignDataFrames, isLikelyAscendingVector } from './utils';

describe('alignDataFrames', () => {
  describe('aligned frame', () => {
    it('should align multiple data frames into one data frame', () => {
      const data: DataFrame[] = [
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
            { name: 'temperature A', type: FieldType.number, values: [1, 3, 5, 7] },
          ],
        }),
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
            { name: 'temperature B', type: FieldType.number, values: [0, 2, 6, 7] },
          ],
        }),
      ];

      const aligned = alignDataFrames(data);

      expect(aligned?.frame.fields).toEqual([
        {
          config: {},
          state: {},
          name: 'time',
          type: FieldType.time,
          values: new ArrayVector([1000, 2000, 3000, 4000]),
        },
        {
          config: {},
          state: {
            displayName: 'temperature A',
            seriesIndex: 0,
          },
          name: 'temperature A',
          type: FieldType.number,
          values: new ArrayVector([1, 3, 5, 7]),
        },
        {
          config: {},
          state: {
            displayName: 'temperature B',
            seriesIndex: 1,
          },
          name: 'temperature B',
          type: FieldType.number,
          values: new ArrayVector([0, 2, 6, 7]),
        },
      ]);
    });

    it('should align multiple data frames into one data frame but only keep first time field', () => {
      const data: DataFrame[] = [
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
            { name: 'temperature', type: FieldType.number, values: [1, 3, 5, 7] },
          ],
        }),
        toDataFrame({
          fields: [
            { name: 'time2', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
            { name: 'temperature B', type: FieldType.number, values: [0, 2, 6, 7] },
          ],
        }),
      ];

      const aligned = alignDataFrames(data);

      expect(aligned?.frame.fields).toEqual([
        {
          config: {},
          state: {},
          name: 'time',
          type: FieldType.time,
          values: new ArrayVector([1000, 2000, 3000, 4000]),
        },
        {
          config: {},
          state: {
            displayName: 'temperature',
            seriesIndex: 0,
          },
          name: 'temperature',
          type: FieldType.number,
          values: new ArrayVector([1, 3, 5, 7]),
        },
        {
          config: {},
          state: {
            displayName: 'temperature B',
            seriesIndex: 1,
          },
          name: 'temperature B',
          type: FieldType.number,
          values: new ArrayVector([0, 2, 6, 7]),
        },
      ]);
    });

    it('should align multiple data frames into one data frame and skip non-numeric fields', () => {
      const data: DataFrame[] = [
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
            { name: 'temperature', type: FieldType.number, values: [1, 3, 5, 7] },
            { name: 'state', type: FieldType.string, values: ['on', 'off', 'off', 'on'] },
          ],
        }),
      ];

      const aligned = alignDataFrames(data);

      expect(aligned?.frame.fields).toEqual([
        {
          config: {},
          state: {},
          name: 'time',
          type: FieldType.time,
          values: new ArrayVector([1000, 2000, 3000, 4000]),
        },
        {
          config: {},
          state: {
            displayName: 'temperature',
            seriesIndex: 0,
          },
          name: 'temperature',
          type: FieldType.number,
          values: new ArrayVector([1, 3, 5, 7]),
        },
      ]);
    });

    it('should align multiple data frames into one data frame and skip non-numeric fields', () => {
      const data: DataFrame[] = [
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
            { name: 'temperature', type: FieldType.number, values: [1, 3, 5, 7] },
            { name: 'state', type: FieldType.string, values: ['on', 'off', 'off', 'on'] },
          ],
        }),
      ];

      const aligned = alignDataFrames(data);

      expect(aligned?.frame.fields).toEqual([
        {
          config: {},
          state: {},
          name: 'time',
          type: FieldType.time,
          values: new ArrayVector([1000, 2000, 3000, 4000]),
        },
        {
          config: {},
          state: {
            displayName: 'temperature',
            seriesIndex: 0,
          },
          name: 'temperature',
          type: FieldType.number,
          values: new ArrayVector([1, 3, 5, 7]),
        },
      ]);
    });
  });

  describe('getDataFrameFieldIndex', () => {
    let aligned: AlignedFrameWithGapTest | null;

    beforeAll(() => {
      const data: DataFrame[] = [
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
            { name: 'temperature A', type: FieldType.number, values: [1, 3, 5, 7] },
          ],
        }),
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
            { name: 'temperature B', type: FieldType.number, values: [0, 2, 6, 7] },
            { name: 'humidity', type: FieldType.number, values: [0, 2, 6, 7] },
          ],
        }),
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
            { name: 'temperature C', type: FieldType.number, values: [0, 2, 6, 7] },
          ],
        }),
      ];

      aligned = alignDataFrames(data);
    });

    it.each`
      yDim | index
      ${1} | ${[0, 1]}
      ${2} | ${[1, 1]}
      ${3} | ${[1, 2]}
      ${4} | ${[2, 1]}
    `('should return correct index for yDim', ({ yDim, index }) => {
      const [frameIndex, fieldIndex] = index;

      expect(aligned?.getDataFrameFieldIndex(yDim)).toEqual({
        frameIndex,
        fieldIndex,
      });
    });
  });

  describe('check ascending data', () => {
    it('simple ascending', () => {
      const v = new ArrayVector([1, 2, 3, 4, 5]);
      expect(isLikelyAscendingVector(v)).toBeTruthy();
    });
    it('simple ascending with null', () => {
      const v = new ArrayVector([null, 2, 3, 4, null]);
      expect(isLikelyAscendingVector(v)).toBeTruthy();
    });
    it('single value', () => {
      const v = new ArrayVector([null, null, null, 4, null]);
      expect(isLikelyAscendingVector(v)).toBeTruthy();
      expect(isLikelyAscendingVector(new ArrayVector([4]))).toBeTruthy();
      expect(isLikelyAscendingVector(new ArrayVector([]))).toBeTruthy();
    });

    it('middle values', () => {
      const v = new ArrayVector([null, null, 5, 4, null]);
      expect(isLikelyAscendingVector(v)).toBeFalsy();
    });

    it('decending', () => {
      expect(isLikelyAscendingVector(new ArrayVector([7, 6, null]))).toBeFalsy();
      expect(isLikelyAscendingVector(new ArrayVector([7, 8, 6]))).toBeFalsy();
    });
  });
});
