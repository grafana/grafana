import { ArrayVector, DataFrame, FieldType, toDataFrame } from '@grafana/data';
import { alignDataFrames } from './utils';

describe('alignDataFrames', () => {
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
