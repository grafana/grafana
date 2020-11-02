import { ArrayVector, Field, FieldType, MutableDataFrame, SelectableValue } from '@grafana/data';
import {
  calculateUniqueFieldValues,
  filterByValue,
  getColumns,
  getFilteredOptions,
  getTextAlign,
  rowToFieldValue,
  sortOptions,
  valuesToOptions,
} from './utils';

function getData() {
  const data = new MutableDataFrame({
    fields: [
      { name: 'Time', type: FieldType.time, values: [] },
      {
        name: 'Value',
        type: FieldType.number,
        values: [],
        config: {
          custom: {
            width: 100,
          },
        },
      },
      {
        name: 'Message',
        type: FieldType.string,
        values: [],
        config: {
          custom: {
            align: 'center',
          },
        },
      },
    ],
  });
  return data;
}

describe('Table utils', () => {
  describe('getColumns', () => {
    it('Should build columns from DataFrame', () => {
      const columns = getColumns(getData(), 1000, 120);

      expect(columns[0].Header).toBe('Time');
      expect(columns[1].Header).toBe('Value');
    });

    it('Should distribute width and use field config width', () => {
      const columns = getColumns(getData(), 1000, 120);

      expect(columns[0].width).toBe(450);
      expect(columns[1].width).toBe(100);
    });
  });

  describe('getTextAlign', () => {
    it('Should use textAlign from custom', () => {
      const data = getData();
      const textAlign = getTextAlign(data.fields[2]);

      expect(textAlign).toBe('center');
    });

    it('Should set textAlign to right for number values', () => {
      const data = getData();
      const textAlign = getTextAlign(data.fields[1]);
      expect(textAlign).toBe('flex-end');
    });
  });

  describe('filterByValue', () => {
    describe('happy path', () => {
      const field: any = { values: new ArrayVector(['a', 'aa', 'ab', 'b', 'ba', 'bb', 'c']) };
      const rows: any = [
        { index: 0, values: { 0: 'a' } },
        { index: 1, values: { 0: 'aa' } },
        { index: 2, values: { 0: 'ab' } },
        { index: 3, values: { 0: 'b' } },
        { index: 4, values: { 0: 'ba' } },
        { index: 5, values: { 0: 'bb' } },
        { index: 6, values: { 0: 'c' } },
      ];
      const filterValues = [{ value: 'a' }, { value: 'b' }, { value: 'c' }];

      const result = filterByValue(field)(rows, '0', filterValues);

      expect(result).toEqual([
        { index: 0, values: { 0: 'a' } },
        { index: 3, values: { 0: 'b' } },
        { index: 6, values: { 0: 'c' } },
      ]);
    });

    describe('fast exit cases', () => {
      describe('no rows', () => {
        it('should return empty array', () => {
          const field: any = { values: new ArrayVector(['a']) };
          const rows: any = [];
          const filterValues = [{ value: 'a' }];

          const result = filterByValue(field)(rows, '', filterValues);

          expect(result).toEqual([]);
        });
      });

      describe('no filterValues', () => {
        it('should return rows', () => {
          const field: any = { values: new ArrayVector(['a']) };
          const rows: any = [{}];
          const filterValues = undefined;

          const result = filterByValue(field)(rows, '', filterValues);

          expect(result).toEqual([{}]);
        });
      });

      describe('no field', () => {
        it('should return rows', () => {
          const field = undefined;
          const rows: any = [{}];
          const filterValues = [{ value: 'a' }];

          const result = filterByValue(field)(rows, '', filterValues);

          expect(result).toEqual([{}]);
        });
      });

      describe('missing id in values', () => {
        it('should return rows', () => {
          const field: any = { values: new ArrayVector(['a', 'b', 'c']) };
          const rows: any = [
            { index: 0, values: { 0: 'a' } },
            { index: 1, values: { 0: 'b' } },
            { index: 2, values: { 0: 'c' } },
          ];
          const filterValues = [{ value: 'a' }, { value: 'b' }, { value: 'c' }];

          const result = filterByValue(field)(rows, '1', filterValues);

          expect(result).toEqual([]);
        });
      });
    });
  });

  describe('calculateUniqueFieldValues', () => {
    describe('when called without field', () => {
      it('then it should return an empty object', () => {
        const field = undefined;
        const rows = [{ index: 0 }];

        const result = calculateUniqueFieldValues(rows, field);

        expect(result).toEqual({});
      });
    });

    describe('when called with no rows', () => {
      it('then it should return an empty object', () => {
        const field: Field = {
          config: {},
          labels: {},
          values: new ArrayVector([1]),
          name: 'value',
          type: FieldType.number,
          getLinks: () => [],
          state: null,
          display: (value: any) => ({
            numeric: 1,
            percent: 0.01,
            color: '',
            title: '1.0',
            text: '1.0',
          }),
          parse: (value: any) => '1.0',
        };
        const rows: any[] = [];

        const result = calculateUniqueFieldValues(rows, field);

        expect(result).toEqual({});
      });
    });

    describe('when called with rows and field with display processor', () => {
      it('then it should return an array with unique values', () => {
        const field: Field = {
          config: {},
          values: new ArrayVector([1, 2, 2, 1, 3, 5, 6]),
          name: 'value',
          type: FieldType.number,
          display: jest.fn((value: any) => ({
            numeric: 1,
            percent: 0.01,
            color: '',
            title: `${value}.0`,
            text: `${value}.0`,
          })),
        };
        const rows: any[] = [{ index: 0 }, { index: 1 }, { index: 2 }, { index: 3 }, { index: 4 }];

        const result = calculateUniqueFieldValues(rows, field);

        expect(field.display).toHaveBeenCalledTimes(5);
        expect(result).toEqual({
          '1.0': '1.0',
          '2.0': '2.0',
          '3.0': '3.0',
        });
      });
    });

    describe('when called with rows and field without display processor', () => {
      it('then it should return an array with unique values', () => {
        const field: Field = {
          config: {},
          values: new ArrayVector([1, 2, 2, 1, 3, 5, 6]),
          name: 'value',
          type: FieldType.number,
        };
        const rows: any[] = [{ index: 0 }, { index: 1 }, { index: 2 }, { index: 3 }, { index: 4 }];

        const result = calculateUniqueFieldValues(rows, field);

        expect(result).toEqual({
          '1': 1,
          '2': 2,
          '3': 3,
        });
      });

      describe('when called with rows with blanks and field', () => {
        it('then it should return an array with unique values and (Blanks)', () => {
          const field: Field = {
            config: {},
            values: new ArrayVector([1, null, null, 1, 3, 5, 6]),
            name: 'value',
            type: FieldType.number,
          };
          const rows: any[] = [{ index: 0 }, { index: 1 }, { index: 2 }, { index: 3 }, { index: 4 }];

          const result = calculateUniqueFieldValues(rows, field);

          expect(result).toEqual({
            '(Blanks)': null,
            '1': 1,
            '3': 3,
          });
        });
      });
    });
  });

  describe('rowToFieldValue', () => {
    describe('happy paths', () => {
      describe('field without field display', () => {
        const field: any = { values: new ArrayVector(['a', 'b', 'c']) };
        const row = { index: 1 };

        const result = rowToFieldValue(row, field);

        expect(result).toEqual('b');
      });

      describe('field with display processor', () => {
        const field: Field = {
          config: {},
          values: new ArrayVector([1, 2, 2, 1, 3, 5, 6]),
          name: 'value',
          type: FieldType.number,
          display: jest.fn((value: any) => ({
            numeric: 1,
            percent: 0.01,
            color: '',
            title: `${value}.0`,
            text: `${value}.0`,
          })),
        };
        const row = { index: 4 };

        const result = rowToFieldValue(row, field);

        expect(result).toEqual('3.0');
      });
    });

    describe('quick exist paths', () => {
      describe('field is missing', () => {
        const field = undefined;
        const row = { index: 0 };

        const result = rowToFieldValue(row, field);

        expect(result).toEqual('');
      });
      describe('row is missing', () => {
        const field: any = { values: new ArrayVector(['a', 'b', 'c']) };
        const row = undefined;

        const result = rowToFieldValue(row, field);

        expect(result).toEqual('');
      });
    });
  });

  describe('valuesToOptions', () => {
    describe('when called with a record object', () => {
      it('then it should return sorted options from that object', () => {
        const date = new Date();
        const unique = {
          string: 'string',
          numeric: 1,
          date: date,
          boolean: true,
        };

        const result = valuesToOptions(unique);

        expect(result).toEqual([
          { label: 'boolean', value: true },
          { label: 'date', value: date },
          { label: 'numeric', value: 1 },
          { label: 'string', value: 'string' },
        ]);
      });
    });
  });

  describe('sortOptions', () => {
    it.each`
      a                       | b                       | expected
      ${{ label: undefined }} | ${{ label: undefined }} | ${0}
      ${{ label: undefined }} | ${{ label: 'b' }}       | ${-1}
      ${{ label: 'a' }}       | ${{ label: undefined }} | ${1}
      ${{ label: 'a' }}       | ${{ label: 'b' }}       | ${-1}
      ${{ label: 'b' }}       | ${{ label: 'a' }}       | ${1}
      ${{ label: 'a' }}       | ${{ label: 'a' }}       | ${0}
    `("when called with a: '$a.toString', b: '$b.toString' then result should be '$expected'", ({ a, b, expected }) => {
      expect(sortOptions(a, b)).toEqual(expected);
    });
  });

  describe('getFilteredOptions', () => {
    describe('when called without filterValues', () => {
      it('then it should return an empty array', () => {
        const options = [
          { label: 'a', value: 'a' },
          { label: 'b', value: 'b' },
          { label: 'c', value: 'c' },
        ];
        const filterValues = undefined;

        const result = getFilteredOptions(options, filterValues);

        expect(result).toEqual([]);
      });
    });

    describe('when called with no options', () => {
      it('then it should return an empty array', () => {
        const options: SelectableValue[] = [];
        const filterValues = [
          { label: 'a', value: 'a' },
          { label: 'b', value: 'b' },
          { label: 'c', value: 'c' },
        ];

        const result = getFilteredOptions(options, filterValues);

        expect(result).toEqual(options);
      });
    });

    describe('when called with options and matching filterValues', () => {
      it('then it should return an empty array', () => {
        const options: SelectableValue[] = [
          { label: 'a', value: 'a' },
          { label: 'b', value: 'b' },
          { label: 'c', value: 'c' },
        ];
        const filterValues = [
          { label: 'a', value: 'a' },
          { label: 'b', value: 'b' },
        ];

        const result = getFilteredOptions(options, filterValues);

        expect(result).toEqual([
          { label: 'a', value: 'a' },
          { label: 'b', value: 'b' },
        ]);
      });
    });

    describe('when called with options and non matching filterValues', () => {
      it('then it should return an empty array', () => {
        const options: SelectableValue[] = [
          { label: 'a', value: 'a' },
          { label: 'b', value: 'b' },
          { label: 'c', value: 'c' },
        ];
        const filterValues = [{ label: 'q', value: 'q' }];

        const result = getFilteredOptions(options, filterValues);

        expect(result).toEqual([]);
      });
    });
  });
});
