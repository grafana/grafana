import { FieldType, MutableDataFrame } from '@grafana/data';
import { filterByValue, getColumns, getTextAlign } from './utils';

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
      expect(textAlign).toBe('right');
    });
  });

  describe('filterByValue', () => {
    it.each`
      rows                                                                        | id     | filterValues  | expected
      ${[]}                                                                       | ${'0'} | ${['a']}      | ${[]}
      ${[{ values: { 0: 'a' } }]}                                                 | ${'0'} | ${null}       | ${[{ values: { 0: 'a' } }]}
      ${[{ values: { 0: 'a' } }]}                                                 | ${'0'} | ${undefined}  | ${[{ values: { 0: 'a' } }]}
      ${[{ values: { 0: 'a' } }]}                                                 | ${'1'} | ${['b']}      | ${[]}
      ${[{ values: { 0: 'a' } }]}                                                 | ${'0'} | ${['a']}      | ${[{ values: { 0: 'a' } }]}
      ${[{ values: { 0: 'a' } }, { values: { 1: 'a' } }]}                         | ${'0'} | ${['a']}      | ${[{ values: { 0: 'a' } }]}
      ${[{ values: { 0: 'a' } }, { values: { 0: 'b' } }, { values: { 0: 'c' } }]} | ${'0'} | ${['a', 'b']} | ${[{ values: { 0: 'a' } }, { values: { 0: 'b' } }]}
    `(
      "when called with rows: '$rows', id: '$id' and filterValues: '$filterValues' then result should be '$expected'",
      ({ rows, id, filterValues, expected }) => {
        expect(filterByValue(rows, id, filterValues)).toEqual(expected);
      }
    );
  });
});
