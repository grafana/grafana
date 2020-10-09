import { ArrayVector, Field, FieldType, MutableDataFrame, SelectableValue } from '@grafana/data';
import {
  calculateUniqueFieldValues,
  filterByValue,
  getColumns,
  getFilteredOptions,
  getTextAlign,
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
    it.each`
      rows                                                                        | id     | filterValues                        | expected
      ${[]}                                                                       | ${'0'} | ${[{ value: 'a' }]}                 | ${[]}
      ${[{ values: { 0: 'a' } }]}                                                 | ${'0'} | ${null}                             | ${[{ values: { 0: 'a' } }]}
      ${[{ values: { 0: 'a' } }]}                                                 | ${'0'} | ${undefined}                        | ${[{ values: { 0: 'a' } }]}
      ${[{ values: { 0: 'a' } }]}                                                 | ${'1'} | ${[{ value: 'b' }]}                 | ${[]}
      ${[{ values: { 0: 'a' } }]}                                                 | ${'0'} | ${[{ value: 'a' }]}                 | ${[{ values: { 0: 'a' } }]}
      ${[{ values: { 0: 'a' } }, { values: { 1: 'a' } }]}                         | ${'0'} | ${[{ value: 'a' }]}                 | ${[{ values: { 0: 'a' } }]}
      ${[{ values: { 0: 'a' } }, { values: { 0: 'b' } }, { values: { 0: 'c' } }]} | ${'0'} | ${[{ value: 'a' }, { value: 'b' }]} | ${[{ values: { 0: 'a' } }, { values: { 0: 'b' } }]}
    `(
      "when called with rows: '$rows.toString()', id: '$id' and filterValues: '$filterValues' then result should be '$expected'",
      ({ rows, id, filterValues, expected }) => {
        expect(filterByValue(rows, id, filterValues)).toEqual(expected);
      }
    );
  });

  describe('calculateUniqueFieldValues', () => {
    describe('when called without field', () => {
      it('then it should return an empty object', () => {
        const field = undefined;
        const rows = [{ id: 0 }];

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
        const rows: any[] = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];

        const result = calculateUniqueFieldValues(rows, field);

        expect(field.display).toHaveBeenCalledTimes(5);
        expect(result).toEqual({
          '1.0': 1,
          '2.0': 2,
          '3.0': 3,
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
        const rows: any[] = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];

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
          const rows: any[] = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];

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
