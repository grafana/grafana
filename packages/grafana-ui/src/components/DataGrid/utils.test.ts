import { SortColumn } from 'react-data-grid';

import { createDataFrame, DataFrame, DataFrameWithValue, Field, FieldType } from '@grafana/data';

import { applySort, frameToRecords, getColumnTypes, getComparator } from './utils';

describe('DataGrid utils', () => {
  describe('frameToRecords', () => {
    it('should convert DataFrame to TableRows', () => {
      const frame = createDataFrame({
        fields: [
          { name: 'time', values: [1, 2] },
          { name: 'value', values: [10, 20] },
        ],
      });

      const records = frameToRecords(frame);
      expect(records).toHaveLength(2);
      expect(records[0]).toEqual({ __depth: 0, __index: 0, time: 1, value: 10 });
    });
  });

  describe('applySort', () => {
    it('sorts by nanos', () => {
      const frame = createDataFrame({
        fields: [
          { name: 'time', values: [1, 1, 2], nanos: [100, 99, 0] },
          { name: 'value', values: [10, 20, 30] },
        ],
      });

      const sortColumns: SortColumn[] = [{ columnKey: 'time', direction: 'ASC' }];

      const records = applySort(frameToRecords(frame), frame.fields, sortColumns);

      expect(records).toMatchObject([
        { time: 1, value: 20 },
        { time: 1, value: 10 },
        { time: 2, value: 30 },
      ]);
    });
  });

  describe('getColumnTypes', () => {
    it('builds the expected record with column types', () => {
      const fields: Field[] = [
        {
          name: 'name',
          type: FieldType.string,
          display: (v) => ({ text: v as string, numeric: NaN }),
          config: {},
          values: [],
        },
        {
          name: 'age',
          type: FieldType.number,
          display: (v) => ({ text: (v as number).toString(), numeric: v as number }),
          config: {},
          values: [],
        },
        {
          name: 'active',
          type: FieldType.boolean,
          display: (v) => ({ text: (v as boolean).toString(), numeric: NaN }),
          config: {},
          values: [],
        },
      ];
      const result = getColumnTypes(fields);

      expect(result).toEqual({ name: FieldType.string, age: FieldType.number, active: FieldType.boolean });
    });

    it('should recursively build column types when nested fields are present', () => {
      const frame: DataFrame = {
        fields: [
          { type: FieldType.string, name: 'stringCol', config: {}, values: [] },
          {
            type: FieldType.nestedFrames,
            name: 'nestedCol',
            config: {},
            values: [
              [
                createDataFrame({
                  fields: [
                    { name: 'time', values: [1, 2] },
                    { name: 'value', values: [10, 20] },
                  ],
                }),
              ],
              [
                createDataFrame({
                  fields: [
                    { name: 'time', values: [3, 4] },
                    { name: 'value', values: [30, 40] },
                  ],
                }),
              ],
            ],
          },
        ],
        length: 0,
        name: 'test',
      };

      expect(getColumnTypes(frame.fields)).toEqual({
        stringCol: FieldType.string,
        time: FieldType.time,
        value: FieldType.number,
      });
    });

    it('does not throw if nestedFrames has no values', () => {
      const frame: DataFrame = {
        fields: [
          { type: FieldType.string, name: 'stringCol', config: {}, values: [] },
          { type: FieldType.nestedFrames, name: 'nestedCol', config: {}, values: [] },
        ],
        length: 0,
        name: 'test',
      };

      expect(getColumnTypes(frame.fields)).toEqual({ stringCol: FieldType.string });
    });
  });

  describe('getComparator', () => {
    it('should compare numbers correctly', () => {
      const comparator = getComparator(FieldType.number);
      expect(comparator(1, 2)).toBeLessThan(0);
      expect(comparator(2, 1)).toBeGreaterThan(0);
      expect(comparator(1, 1)).toBe(0);
    });

    it('should handle undefined values', () => {
      const comparator = getComparator(FieldType.number);
      expect(comparator(undefined, 1)).toBeLessThan(0);
      expect(comparator(1, undefined)).toBeGreaterThan(0);
      expect(comparator(undefined, undefined)).toBe(0);
    });

    it('should compare strings case-insensitively', () => {
      const comparator = getComparator(FieldType.string);
      expect(comparator('a', 'B')).toBeLessThan(0);
      expect(comparator('B', 'a')).toBeGreaterThan(0);
      expect(comparator('a', 'a')).toBe(0);
    });

    it('should handle time values', () => {
      const comparator = getComparator(FieldType.time);
      const t1 = 1672531200000; // 2023-01-01
      const t2 = 1672617600000; // 2023-01-02

      expect(comparator(t1, t2)).toBeLessThan(0);
      expect(comparator(t2, t1)).toBeGreaterThan(0);
      expect(comparator(t1, t1)).toBe(0);
    });

    it('should handle boolean values', () => {
      const comparator = getComparator(FieldType.boolean);
      expect(comparator(false, true)).toBeLessThan(0);
      expect(comparator(true, false)).toBeGreaterThan(0);
      expect(comparator(true, true)).toBe(0);
    });

    it('should compare frame values', () => {
      const comparator = getComparator(FieldType.frame);

      // simulate using `first`.
      const frame1: DataFrameWithValue = {
        value: 1,
        ...createDataFrame({ fields: [{ name: 'a', values: [1, 2, 3, 4] }] }),
      };
      const frame2: DataFrameWithValue = {
        value: 4,
        ...createDataFrame({ fields: [{ name: 'a', values: [4, 3, 2, 1] }] }),
      };
      const frame3: DataFrameWithValue = {
        value: 4,
        ...createDataFrame({ fields: [{ name: 'a', values: [4, 5, 6, 7] }] }),
      };

      expect(comparator(frame1, frame2)).toBeLessThan(0);
      expect(comparator(frame2, frame1)).toBeGreaterThan(0);
      expect(comparator(frame2, frame2)).toBe(0);
      expect(comparator(frame2, frame3)).toBe(0); // equivalent start values
    });
  });
});
