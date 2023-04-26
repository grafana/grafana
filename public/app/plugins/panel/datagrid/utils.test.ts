import { ArrayVector, DataFrame, FieldType } from '@grafana/data';

import { clearCellsFromRangeSelection, deleteRows } from './utils';

describe('when deleting rows', () => {
  let df: DataFrame;

  beforeEach(() => {
    df = {
      name: 'test',
      length: 5,
      fields: [
        {
          name: 'test1',
          type: FieldType.string,
          values: new ArrayVector(['a', 'b', 'c', 'd', 'e']),
          config: {},
        },
        {
          name: 'test2',
          type: FieldType.number,
          values: new ArrayVector([1, 2, 3, 4, 5]),
          config: {},
        },
        {
          name: 'test3',
          type: FieldType.string,
          values: new ArrayVector(['a', 'b', 'c', 'd', 'e']),
          config: {},
        },
      ],
    };
  });

  it('should return same dataframe if no rows are selected', () => {
    const newDf = deleteRows(df, []);
    expect(newDf.fields).toEqual(df.fields);
  });

  it('should soft delete selected rows', () => {
    const newDf = deleteRows(df, [1, 3]);

    expect(newDf.fields[0].values.toArray()).toEqual(['a', null, 'c', null, 'e']);
    expect(newDf.fields[1].values.toArray()).toEqual([1, null, 3, null, 5]);
    expect(newDf.fields[2].values.toArray()).toEqual(['a', null, 'c', null, 'e']);
    expect(newDf.length).toEqual(5);
  });

  it('should remove selected rows', () => {
    let newDf = deleteRows(df, [1, 3], true);

    expect(newDf.fields[0].values.toArray()).toEqual(['a', 'c', 'e']);
    expect(newDf.fields[1].values.toArray()).toEqual([1, 3, 5]);
    expect(newDf.fields[2].values.toArray()).toEqual(['a', 'c', 'e']);
    expect(newDf.length).toEqual(3);

    newDf = deleteRows(newDf, [2], true);

    expect(newDf.fields[0].values.toArray()).toEqual(['a', 'c']);
    expect(newDf.fields[1].values.toArray()).toEqual([1, 3]);
    expect(newDf.fields[2].values.toArray()).toEqual(['a', 'c']);
    expect(newDf.length).toEqual(2);
  });

  it('should remove all rows when all rows are selected', () => {
    const newDf = deleteRows(df, [0, 1, 2, 3, 4], true);

    expect(newDf.fields[0].values.toArray()).toEqual([]);
    expect(newDf.fields[1].values.toArray()).toEqual([]);
    expect(newDf.fields[2].values.toArray()).toEqual([]);
    expect(newDf.length).toEqual(0);
  });

  it('should do nothing if there are no fields', () => {
    const newDf = deleteRows(
      {
        name: 'emptyDataframe',
        fields: [],
        length: 0,
      },
      [0, 1, 2, 3, 4],
      true
    );

    expect(newDf.length).toEqual(0);
  });
});

describe('when clearing cells from range selection', () => {
  let df: DataFrame;

  beforeEach(() => {
    df = {
      name: 'test',
      length: 5,
      fields: [
        {
          name: 'test1',
          type: FieldType.string,
          values: new ArrayVector(['a', 'b', 'c', 'd', 'e']),
          config: {},
        },
        {
          name: 'test2',
          type: FieldType.number,
          values: new ArrayVector([1, 2, 3, 4, 5]),
          config: {},
        },
        {
          name: 'test3',
          type: FieldType.string,
          values: new ArrayVector(['a', 'b', 'c', 'd', 'e']),
          config: {},
        },
      ],
    };
  });

  it('should clear cells from range selection', () => {
    const newDf = clearCellsFromRangeSelection(df, { x: 0, y: 0, width: 2, height: 2 });

    expect(newDf.fields[0].values.toArray()).toEqual([null, null, 'c', 'd', 'e']);
    expect(newDf.fields[1].values.toArray()).toEqual([null, null, 3, 4, 5]);
    expect(newDf.fields[2].values.toArray()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(newDf.length).toEqual(5);
  });

  it('should clear single cell when only one is selected', () => {
    const newDf = clearCellsFromRangeSelection(df, { x: 1, y: 1, width: 1, height: 1 });

    expect(newDf.fields[0].values.toArray()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(newDf.fields[1].values.toArray()).toEqual([1, null, 3, 4, 5]);
    expect(newDf.fields[2].values.toArray()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(newDf.length).toEqual(5);
  });

  it('should do nothing if there are no fields', () => {
    const newDf = clearCellsFromRangeSelection(
      {
        name: 'emptyDataframe',
        fields: [],
        length: 0,
      },
      { x: 0, y: 0, width: 0, height: 0 }
    );

    expect(newDf.length).toEqual(0);
  });
});
