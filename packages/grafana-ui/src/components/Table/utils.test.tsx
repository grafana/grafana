import { Row } from 'react-table';

import { Field, FieldType, MutableDataFrame, SelectableValue } from '@grafana/data';

import {
  calculateUniqueFieldValues,
  filterByValue,
  getColumns,
  getFilteredOptions,
  getTextAlign,
  rowToFieldValue,
  sortNumber,
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
      const columns = getColumns(getData(), 1000, 120, false);

      expect(columns[0].Header).toBe('Time');
      expect(columns[1].Header).toBe('Value');
    });

    it('Should distribute width and use field config width', () => {
      const columns = getColumns(getData(), 1000, 120, false);

      expect(columns[0].width).toBe(450);
      expect(columns[1].width).toBe(100);
    });

    it('Should distribute width and use field config width with expander enabled', () => {
      const columns = getColumns(getData(), 1000, 120, true);

      expect(columns[0].width).toBe(50); // expander column
      expect(columns[1].width).toBe(425);
      expect(columns[2].width).toBe(100);
    });

    it('Should set field on columns', () => {
      const columns = getColumns(getData(), 1000, 120, false);

      expect(columns[0].field.name).toBe('Time');
      expect(columns[1].field.name).toBe('Value');
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
      const field = { values: ['a', 'aa', 'ab', 'b', 'ba', 'bb', 'c'] } as unknown as Field;
      const rows = [
        { index: 0, values: { 0: 'a' } },
        { index: 1, values: { 0: 'aa' } },
        { index: 2, values: { 0: 'ab' } },
        { index: 3, values: { 0: 'b' } },
        { index: 4, values: { 0: 'ba' } },
        { index: 5, values: { 0: 'bb' } },
        { index: 6, values: { 0: 'c' } },
      ] as unknown as Row[];
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
          const field = { values: ['a'] } as unknown as Field;
          const rows: Row[] = [];
          const filterValues = [{ value: 'a' }];

          const result = filterByValue(field)(rows, '', filterValues);

          expect(result).toEqual([]);
        });
      });

      describe('no filterValues', () => {
        it('should return rows', () => {
          const field = { values: ['a'] } as unknown as Field;
          const rows = [{}] as Row[];
          const filterValues = undefined;

          const result = filterByValue(field)(rows, '', filterValues);

          expect(result).toEqual([{}]);
        });
      });

      describe('no field', () => {
        it('should return rows', () => {
          const field = undefined;
          const rows = [{}] as Row[];
          const filterValues = [{ value: 'a' }];

          const result = filterByValue(field)(rows, '', filterValues);

          expect(result).toEqual([{}]);
        });
      });

      describe('missing id in values', () => {
        it('should return rows', () => {
          const field = { values: ['a', 'b', 'c'] } as unknown as Field;
          const rows = [
            { index: 0, values: { 0: 'a' } },
            { index: 1, values: { 0: 'b' } },
            { index: 2, values: { 0: 'c' } },
          ] as unknown as Row[];
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
          values: [1],
          name: 'value',
          type: FieldType.number,
          getLinks: () => [],
          state: null,
          display: () => ({
            numeric: 1,
            percent: 0.01,
            color: '',
            title: '1.0',
            text: '1.0',
          }),
        };
        const rows = [] as Row[];

        const result = calculateUniqueFieldValues(rows, field);

        expect(result).toEqual({});
      });
    });

    describe('when called with rows and field with display processor', () => {
      it('then it should return an array with unique values', () => {
        const field: Field = {
          config: {},
          values: [1, 2, 2, 1, 3, 5, 6],
          name: 'value',
          type: FieldType.number,
          display: jest.fn().mockImplementation((value) => ({
            numeric: 1,
            percent: 0.01,
            color: '',
            title: `${value}.0`,
            text: `${value}.0`,
          })),
        };
        const rows = [{ index: 0 }, { index: 1 }, { index: 2 }, { index: 3 }, { index: 4 }];

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
          values: [1, 2, 2, 1, 3, 5, 6],
          name: 'value',
          type: FieldType.number,
        };
        const rows = [{ index: 0 }, { index: 1 }, { index: 2 }, { index: 3 }, { index: 4 }];

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
            values: [1, null, null, 1, 3, 5, 6],
            name: 'value',
            type: FieldType.number,
          };
          const rows = [{ index: 0 }, { index: 1 }, { index: 2 }, { index: 3 }, { index: 4 }];

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
        const field: Field = {
          name: 'value',
          type: FieldType.string,
          config: {},
          values: ['a', 'b', 'c'],
        };
        const row = { index: 1 };

        const result = rowToFieldValue(row, field);

        expect(result).toEqual('b');
      });

      describe('field with display processor', () => {
        const field: Field = {
          config: {},
          values: [1, 2, 2, 1, 3, 5, 6],
          name: 'value',
          type: FieldType.number,
          display: jest.fn().mockImplementation((value) => ({
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
        const field = {
          name: 'value',
          type: FieldType.string,
          config: {},
          values: ['a', 'b', 'c'],
        };
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

  describe('sortNumber', () => {
    it.each`
      a                                         | b                                         | expected
      ${{ values: [] }}                         | ${{ values: [] }}                         | ${0}
      ${{ values: [undefined] }}                | ${{ values: [undefined] }}                | ${0}
      ${{ values: [null] }}                     | ${{ values: [null] }}                     | ${0}
      ${{ values: [Number.POSITIVE_INFINITY] }} | ${{ values: [Number.POSITIVE_INFINITY] }} | ${0}
      ${{ values: [Number.NEGATIVE_INFINITY] }} | ${{ values: [Number.NEGATIVE_INFINITY] }} | ${0}
      ${{ values: [Number.POSITIVE_INFINITY] }} | ${{ values: [Number.NEGATIVE_INFINITY] }} | ${1}
      ${{ values: [Number.NEGATIVE_INFINITY] }} | ${{ values: [Number.POSITIVE_INFINITY] }} | ${-1}
      ${{ values: ['infinIty'] }}               | ${{ values: ['infinIty'] }}               | ${0}
      ${{ values: ['infinity'] }}               | ${{ values: ['not infinity'] }}           | ${0}
      ${{ values: [1] }}                        | ${{ values: [1] }}                        | ${0}
      ${{ values: [1.5] }}                      | ${{ values: [1.5] }}                      | ${0}
      ${{ values: [2] }}                        | ${{ values: [1] }}                        | ${1}
      ${{ values: [25] }}                       | ${{ values: [2.5] }}                      | ${1}
      ${{ values: [2.5] }}                      | ${{ values: [1.5] }}                      | ${1}
      ${{ values: [1] }}                        | ${{ values: [2] }}                        | ${-1}
      ${{ values: [2.5] }}                      | ${{ values: [25] }}                       | ${-1}
      ${{ values: [1.5] }}                      | ${{ values: [2.5] }}                      | ${-1}
      ${{ values: [1] }}                        | ${{ values: [] }}                         | ${1}
      ${{ values: [1] }}                        | ${{ values: [undefined] }}                | ${1}
      ${{ values: [1] }}                        | ${{ values: [null] }}                     | ${1}
      ${{ values: [1] }}                        | ${{ values: [Number.POSITIVE_INFINITY] }} | ${-1}
      ${{ values: [1] }}                        | ${{ values: [Number.NEGATIVE_INFINITY] }} | ${1}
      ${{ values: [1] }}                        | ${{ values: ['infinIty'] }}               | ${1}
      ${{ values: [-1] }}                       | ${{ values: ['infinIty'] }}               | ${1}
      ${{ values: [] }}                         | ${{ values: [1] }}                        | ${-1}
      ${{ values: [undefined] }}                | ${{ values: [1] }}                        | ${-1}
      ${{ values: [null] }}                     | ${{ values: [1] }}                        | ${-1}
      ${{ values: [Number.POSITIVE_INFINITY] }} | ${{ values: [1] }}                        | ${1}
      ${{ values: [Number.NEGATIVE_INFINITY] }} | ${{ values: [1] }}                        | ${-1}
      ${{ values: ['infinIty'] }}               | ${{ values: [1] }}                        | ${-1}
      ${{ values: ['infinIty'] }}               | ${{ values: [-1] }}                       | ${-1}
      ${{ values: [1] }}                        | ${{ values: [NaN] }}                      | ${1}
      ${{ values: [NaN] }}                      | ${{ values: [NaN] }}                      | ${0}
      ${{ values: [NaN] }}                      | ${{ values: [1] }}                        | ${-1}
    `("when called with a: '$a.toString', b: '$b.toString' then result should be '$expected'", ({ a, b, expected }) => {
      expect(sortNumber(a, b, '0')).toEqual(expected);
    });

    it.skip('should have good performance', () => {
      const ITERATIONS = 100000;
      const a = { values: Array(ITERATIONS) } as unknown as Row;
      const b = { values: Array(ITERATIONS) } as unknown as Row;
      for (let i = 0; i < ITERATIONS; i++) {
        a.values[i] = Math.random() * Date.now();
        b.values[i] = Math.random() * Date.now();
      }

      const start = performance.now();
      for (let i = 0; i < ITERATIONS; i++) {
        sortNumber(a, b, i.toString(10));
      }
      const stop = performance.now();
      const diff = stop - start;
      expect(diff).toBeLessThanOrEqual(20);
    });
  });
});
