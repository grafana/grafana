import { type DataFrame, FieldType } from '@grafana/data';

import { filterDataFrameByRowIndexes } from './utils';

describe('filterDataFrameByRowIndexes', () => {
  const df: DataFrame = {
    name: 'hello',
    fields: [
      {
        name: 'fname',
        labels: { a: 'AAA', b: 'BBB' },
        config: {},
        type: FieldType.number,
        values: [1, 2, 3, 4],
      },
      {
        name: 'time',
        labels: { a: 'AAA', b: 'BBB' },
        config: {},
        type: FieldType.time,
        values: [5, 6, 7, 8],
      },
    ],
    length: 4,
  };

  it('filters the dataframe down to the given row indexes, in the given order', () => {
    const rowIndexes = [3, 1];

    expect(filterDataFrameByRowIndexes(df, rowIndexes)).toEqual({
      ...df,
      length: 2,
      fields: [
        { ...df.fields[0], values: [4, 2] },
        { ...df.fields[1], values: [8, 6] },
      ],
    });
  });

  it('returns the dataframe unchanged when rowIndexes is undefined', () => {
    expect(filterDataFrameByRowIndexes(df, undefined)).toBe(df);
  });
});
