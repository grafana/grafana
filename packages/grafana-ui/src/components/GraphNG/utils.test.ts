import { ArrayVector, DataFrame, FieldType, toDataFrame } from '@grafana/data';
import { joinDataFrames, isLikelyAscendingVector } from './utils';

describe('joinDataFrames', () => {
  describe('joined frame', () => {
    it('should align multiple data frames into one data frame', () => {
      const data: DataFrame[] = [
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
            { name: 'temperature A', type: FieldType.number, values: [1, 3, 5, 7] },
          ],
        }),
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
            { name: 'temperature B', type: FieldType.number, values: [0, 2, 6, 7] },
          ],
        }),
      ];

      const joined = joinDataFrames(data);

      expect(joined?.fields).toMatchInlineSnapshot(`
        Array [
          Object {
            "config": Object {},
            "name": "time",
            "state": Object {
              "origin": undefined,
            },
            "type": "time",
            "values": Array [
              1000,
              2000,
              3000,
              4000,
            ],
          },
          Object {
            "config": Object {},
            "name": "temperature A",
            "state": Object {
              "displayName": "temperature A",
              "origin": Object {
                "fieldIndex": 1,
                "frameIndex": 0,
              },
              "seriesIndex": 0,
            },
            "type": "number",
            "values": Array [
              1,
              3,
              5,
              7,
            ],
          },
          Object {
            "config": Object {},
            "name": "temperature B",
            "state": Object {
              "displayName": "temperature B",
              "origin": Object {
                "fieldIndex": 1,
                "frameIndex": 1,
              },
              "seriesIndex": 1,
            },
            "type": "number",
            "values": Array [
              0,
              2,
              6,
              7,
            ],
          },
        ]
      `);
    });

    it('should align multiple data frames into one data frame but only keep first time field', () => {
      const data: DataFrame[] = [
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
            { name: 'temperature', type: FieldType.number, values: [1, 3, 5, 7] },
          ],
        }),
        toDataFrame({
          fields: [
            { name: 'time2', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
            { name: 'temperature B', type: FieldType.number, values: [0, 2, 6, 7] },
          ],
        }),
      ];

      const aligned = joinDataFrames(data);

      expect(aligned?.fields).toMatchInlineSnapshot(`
        Array [
          Object {
            "config": Object {},
            "name": "time",
            "state": Object {
              "origin": undefined,
            },
            "type": "time",
            "values": Array [
              1000,
              2000,
              3000,
              4000,
            ],
          },
          Object {
            "config": Object {},
            "name": "temperature",
            "state": Object {
              "displayName": "temperature",
              "origin": Object {
                "fieldIndex": 1,
                "frameIndex": 0,
              },
              "seriesIndex": 0,
            },
            "type": "number",
            "values": Array [
              1,
              3,
              5,
              7,
            ],
          },
          Object {
            "config": Object {},
            "name": "temperature B",
            "state": Object {
              "displayName": "temperature B",
              "origin": Object {
                "fieldIndex": 1,
                "frameIndex": 1,
              },
              "seriesIndex": 1,
            },
            "type": "number",
            "values": Array [
              0,
              2,
              6,
              7,
            ],
          },
        ]
      `);
    });

    it('should align multiple data frames into one data frame and skip non-numeric fields', () => {
      const data: DataFrame[] = [
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
            { name: 'temperature', type: FieldType.number, values: [1, 3, 5, 7] },
            { name: 'state', type: FieldType.string, values: ['on', 'off', 'off', 'on'] },
          ],
        }),
      ];

      const aligned = joinDataFrames(data);

      expect(aligned?.fields).toMatchInlineSnapshot(`
        Array [
          Object {
            "config": Object {},
            "name": "time",
            "state": Object {
              "origin": undefined,
            },
            "type": "time",
            "values": Array [
              1000,
              2000,
              3000,
              4000,
            ],
          },
          Object {
            "config": Object {},
            "name": "temperature",
            "state": Object {
              "displayName": "temperature",
              "origin": Object {
                "fieldIndex": 1,
                "frameIndex": 0,
              },
              "seriesIndex": 0,
            },
            "type": "number",
            "values": Array [
              1,
              3,
              5,
              7,
            ],
          },
        ]
      `);
    });

    it('should align multiple data frames into one data frame and skip non-numeric fields', () => {
      const data: DataFrame[] = [
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
            { name: 'temperature', type: FieldType.number, values: [1, 3, 5, 7] },
            { name: 'state', type: FieldType.string, values: ['on', 'off', 'off', 'on'] },
          ],
        }),
      ];

      const aligned = joinDataFrames(data);

      expect(aligned?.fields).toMatchInlineSnapshot(`
        Array [
          Object {
            "config": Object {},
            "name": "time",
            "state": Object {
              "origin": undefined,
            },
            "type": "time",
            "values": Array [
              1000,
              2000,
              3000,
              4000,
            ],
          },
          Object {
            "config": Object {},
            "name": "temperature",
            "state": Object {
              "displayName": "temperature",
              "origin": Object {
                "fieldIndex": 1,
                "frameIndex": 0,
              },
              "seriesIndex": 0,
            },
            "type": "number",
            "values": Array [
              1,
              3,
              5,
              7,
            ],
          },
        ]
      `);
    });
  });

  describe('getDataFrameFieldIndex', () => {
    let aligned: DataFrame | null;

    beforeAll(() => {
      const data: DataFrame[] = [
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
            { name: 'temperature A', type: FieldType.number, values: [1, 3, 5, 7] },
          ],
        }),
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
            { name: 'temperature B', type: FieldType.number, values: [0, 2, 6, 7] },
            { name: 'humidity', type: FieldType.number, values: [0, 2, 6, 7] },
          ],
        }),
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
            { name: 'temperature C', type: FieldType.number, values: [0, 2, 6, 7] },
          ],
        }),
      ];

      aligned = joinDataFrames(data);
    });

    it.each`
      yDim | index
      ${1} | ${[0, 1]}
      ${2} | ${[1, 1]}
      ${3} | ${[1, 2]}
      ${4} | ${[2, 1]}
    `('should return correct index for yDim', ({ yDim, index }) => {
      const [frameIndex, fieldIndex] = index;

      expect(aligned?.fields[yDim].state?.origin).toEqual({
        frameIndex,
        fieldIndex,
      });
    });
  });

  describe('check ascending data', () => {
    it('simple ascending', () => {
      const v = new ArrayVector([1, 2, 3, 4, 5]);
      expect(isLikelyAscendingVector(v)).toBeTruthy();
    });
    it('simple ascending with null', () => {
      const v = new ArrayVector([null, 2, 3, 4, null]);
      expect(isLikelyAscendingVector(v)).toBeTruthy();
    });
    it('single value', () => {
      const v = new ArrayVector([null, null, null, 4, null]);
      expect(isLikelyAscendingVector(v)).toBeTruthy();
      expect(isLikelyAscendingVector(new ArrayVector([4]))).toBeTruthy();
      expect(isLikelyAscendingVector(new ArrayVector([]))).toBeTruthy();
    });

    it('middle values', () => {
      const v = new ArrayVector([null, null, 5, 4, null]);
      expect(isLikelyAscendingVector(v)).toBeFalsy();
    });

    it('decending', () => {
      expect(isLikelyAscendingVector(new ArrayVector([7, 6, null]))).toBeFalsy();
      expect(isLikelyAscendingVector(new ArrayVector([7, 8, 6]))).toBeFalsy();
    });
  });
});
