import { FieldType } from '../types/dataFrame';
import { DataFrameJSON, dataFrameFromJSON } from './DataFrameJSON';

describe('DataFrame JSON', () => {
  describe('when called with a DataFrame', () => {
    it('then it should reverse the order of values in all fields', () => {
      const json: DataFrameJSON = {
        schema: {
          fields: [
            { name: 'time', type: FieldType.time },
            { name: 'name', type: FieldType.string },
            { name: 'value', type: FieldType.number },
          ],
        },
        data: [
          [100, 200, 300],
          ['a', 'b', 'c'],
          [1, 2, 3],
        ],
        replaced: [
          {}, // nothing to replace, but keeps the index
          { NaN: [1], Inf: [2] },
          { NegInf: [2] },
        ],
      };

      const frame = dataFrameFromJSON(json);
      expect(frame).toMatchInlineSnapshot(`
        Object {
          "fields": Array [
            Object {
              "config": Object {},
              "name": "time",
              "replaced": Object {},
              "type": "time",
              "values": Array [
                100,
                200,
                300,
              ],
            },
            Object {
              "config": Object {},
              "name": "name",
              "replaced": Object {
                "Inf": Array [
                  2,
                ],
                "NaN": Array [
                  1,
                ],
              },
              "type": "string",
              "values": Array [
                "a",
                NaN,
                Infinity,
              ],
            },
            Object {
              "config": Object {},
              "name": "value",
              "replaced": Object {
                "NegInf": Array [
                  2,
                ],
              },
              "type": "number",
              "values": Array [
                1,
                2,
                -Infinity,
              ],
            },
          ],
          "length": 3,
        }
      `);
    });
  });
});
