import { ArrayVector, DataFrame, FieldType } from '@grafana/data';
import { filterDataFrameByRowIds } from './utils';

describe('filterDataFrameByRowIds', () => {
  const df: DataFrame = {
    name: 'hello',
    fields: [
      {
        name: 'fname',
        labels: {
          a: 'AAA',
          b: 'BBB',
        },
        config: {},
        type: FieldType.number,
        values: new ArrayVector([1, 2, 3, 4]),
      },
      {
        name: 'fname',
        labels: {
          a: 'AAA',
          b: 'BBB',
        },
        config: {},
        type: FieldType.time,
        values: new ArrayVector([5, 6, 7, 8]),
      },
    ],
    length: 2,
  };

  it('should filter the dataframe by row ids', () => {
    const rowIds = [1, 3];
    const expected = {
      ...df,
      fields: [
        {
          ...df.fields[0],
          values: new ArrayVector([2, 4]),
        },
        {
          ...df.fields[1],
          values: new ArrayVector([6, 8]),
        },
      ],
    };
    expect(filterDataFrameByRowIds(df, rowIds)).toEqual(expected);
  });

  it('should return df without filtering when rowIds is undefined', () => {
    expect(filterDataFrameByRowIds(df, undefined)).toEqual(df);
  });
});
