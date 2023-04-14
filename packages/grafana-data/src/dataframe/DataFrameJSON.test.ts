import { ArrayVector } from '..';
import { DataFrame, FieldType } from '../types/dataFrame';

import { DataFrameJSON, dataFrameFromJSON, dataFrameToJSON } from './DataFrameJSON';

describe('DataFrame JSON', () => {
  describe('when called with a DataFrame', () => {
    it('should decode values not supported natively in JSON (e.g. NaN, Infinity)', () => {
      const json: DataFrameJSON = {
        schema: {
          fields: [
            { name: 'time', type: FieldType.time },
            { name: 'name', type: FieldType.string },
            { name: 'value', type: FieldType.number },
          ],
        },
        data: {
          values: [
            [100, 200, 300],
            ['a', 'b', 'c'],
            [1, 2, 3],
          ],
          entities: [
            null, // nothing to replace, but keeps the index
            { NaN: [0], Inf: [1], Undef: [2] },
            { NegInf: [2] },
          ],
        },
      };

      const frame = dataFrameFromJSON(json);
      expect(frame).toMatchInlineSnapshot(`
        {
          "fields": [
            {
              "config": {},
              "entities": {},
              "name": "time",
              "type": "time",
              "values": [
                100,
                200,
                300,
              ],
            },
            {
              "config": {},
              "entities": {
                "Inf": [
                  1,
                ],
                "NaN": [
                  0,
                ],
                "Undef": [
                  2,
                ],
              },
              "name": "name",
              "type": "string",
              "values": [
                NaN,
                Infinity,
                undefined,
              ],
            },
            {
              "config": {},
              "entities": {
                "NegInf": [
                  2,
                ],
              },
              "name": "value",
              "type": "number",
              "values": [
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

    it('should inflate values from enums and switch to string field type', () => {
      const json: DataFrameJSON = {
        schema: {
          fields: [
            { name: 'time', type: FieldType.time },
            { name: 'value', type: FieldType.number },
          ],
        },
        data: {
          values: [
            [100, 200, 300, 400],
            [1, 0, 2, 1],
          ],
          enums: [
            null, // nothing to replace, but keeps the index
            ['foo', 'bar', 'baz'],
          ],
        },
      };

      const frame = dataFrameFromJSON(json);
      expect(frame).toMatchInlineSnapshot(`
        {
          "fields": [
            {
              "config": {},
              "entities": {},
              "name": "time",
              "type": "time",
              "values": [
                100,
                200,
                300,
                400,
              ],
            },
            {
              "config": {},
              "entities": {},
              "name": "value",
              "type": "string",
              "values": [
                "bar",
                "foo",
                "baz",
                "bar",
              ],
            },
          ],
          "length": 4,
        }
      `);
    });

    it('should decode fields with nanos', () => {
      const json: DataFrameJSON = {
        schema: {
          fields: [
            { name: 'time1', type: FieldType.time },
            { name: 'time2', type: FieldType.time },
          ],
        },
        data: {
          values: [
            [1, 2, 3],
            [4, 5, 6],
          ],
          nanos: [null, [7, 8, 9]],
        },
      };

      const frame = dataFrameFromJSON(json);
      expect(frame).toMatchInlineSnapshot(`
        {
          "fields": [
            {
              "config": {},
              "entities": {},
              "name": "time1",
              "type": "time",
              "values": [
                1,
                2,
                3,
              ],
            },
            {
              "config": {},
              "entities": {},
              "name": "time2",
              "nanos": [
                7,
                8,
                9,
              ],
              "type": "time",
              "values": [
                4,
                5,
                6,
              ],
            },
          ],
          "length": 3,
        }
      `);
    });

    it('should encode fields with nanos', () => {
      const inputFrame: DataFrame = {
        refId: 'A',
        meta: {},
        name: 'f1',
        fields: [
          {
            name: 'time1',
            type: FieldType.time,
            config: {},
            values: new ArrayVector([11, 12, 13]),
          },
          {
            name: 'time2',
            type: FieldType.time,
            config: {},
            values: new ArrayVector([14, 15, 16]),
            nanos: [17, 18, 19],
          },
        ],
        length: 3,
      };

      const expectedJSON: DataFrameJSON = {
        schema: {
          fields: [
            { name: 'time1', type: FieldType.time, config: {} },
            { name: 'time2', type: FieldType.time, config: {} },
          ],
          meta: {},
          name: 'f1',
          refId: 'A',
        },
        data: {
          nanos: [null, [17, 18, 19]],
          values: [
            [11, 12, 13],
            [14, 15, 16],
          ],
        },
      };

      expect(dataFrameToJSON(inputFrame)).toEqual(expectedJSON);
    });
  });
});
