import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType } from '../../types/dataFrame';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { ArrayVector } from '../../vector';

import { calculateFieldTransformer } from './calculateField';
import { JoinMode } from './joinByField';
import { isLikelyAscendingVector, joinDataFrames } from './joinDataFrames';

describe('align frames', () => {
  beforeAll(() => {
    mockTransformationsRegistry([calculateFieldTransformer]);
  });

  describe('by first time field', () => {
    const series1 = toDataFrame({
      fields: [
        { name: 'TheTime', type: FieldType.time, values: [1000, 2000] },
        { name: 'A', type: FieldType.number, values: [1, 100] },
      ],
    });
    const series2 = toDataFrame({
      fields: [
        { name: '_time', type: FieldType.time, values: [1000, 1500, 2000] },
        { name: 'A', type: FieldType.number, values: [2, 20, 200] },
        { name: 'B', type: FieldType.number, values: [3, 30, 300] },
        { name: 'C', type: FieldType.string, values: ['first', 'second', 'third'] },
      ],
    });

    it('should perform an outer join', () => {
      const out = joinDataFrames({ frames: [series1, series2] })!;
      expect(
        out.fields.map((f) => ({
          name: f.name,
          values: f.values.toArray(),
        }))
      ).toMatchInlineSnapshot(`
        Array [
          Object {
            "name": "TheTime",
            "values": Array [
              1000,
              1500,
              2000,
            ],
          },
          Object {
            "name": "A",
            "values": Array [
              1,
              undefined,
              100,
            ],
          },
          Object {
            "name": "A",
            "values": Array [
              2,
              20,
              200,
            ],
          },
          Object {
            "name": "B",
            "values": Array [
              3,
              30,
              300,
            ],
          },
          Object {
            "name": "C",
            "values": Array [
              "first",
              "second",
              "third",
            ],
          },
        ]
      `);
    });

    it('should perform an inner join', () => {
      const out = joinDataFrames({ frames: [series1, series2], mode: JoinMode.inner })!;
      expect(
        out.fields.map((f) => ({
          name: f.name,
          values: f.values.toArray(),
        }))
      ).toMatchInlineSnapshot(`
        Array [
          Object {
            "name": "TheTime",
            "values": Array [
              1000,
              2000,
            ],
          },
          Object {
            "name": "A",
            "values": Array [
              1,
              100,
            ],
          },
          Object {
            "name": "A",
            "values": Array [
              2,
              200,
            ],
          },
          Object {
            "name": "B",
            "values": Array [
              3,
              300,
            ],
          },
          Object {
            "name": "C",
            "values": Array [
              "first",
              "third",
            ],
          },
        ]
      `);
    });
  });

  it('unsorted input keep indexes', () => {
    //----------
    const series1 = toDataFrame({
      fields: [
        { name: 'TheTime', type: FieldType.time, values: [1000, 2000, 1500] },
        { name: 'A1', type: FieldType.number, values: [1, 2, 15] },
      ],
    });

    const series3 = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [2000, 1000] },
        { name: 'A2', type: FieldType.number, values: [2, 1] },
      ],
    });

    let out = joinDataFrames({ frames: [series1, series3], keepOriginIndices: true })!;
    expect(
      out.fields.map((f) => ({
        name: f.name,
        values: f.values.toArray(),
        state: f.state,
      }))
    ).toMatchInlineSnapshot(`
      Array [
        Object {
          "name": "TheTime",
          "state": Object {
            "origin": Object {
              "fieldIndex": 0,
              "frameIndex": 0,
            },
          },
          "values": Array [
            1000,
            1500,
            2000,
          ],
        },
        Object {
          "name": "A1",
          "state": Object {
            "origin": Object {
              "fieldIndex": 1,
              "frameIndex": 0,
            },
          },
          "values": Array [
            1,
            15,
            2,
          ],
        },
        Object {
          "name": "A2",
          "state": Object {
            "origin": Object {
              "fieldIndex": 1,
              "frameIndex": 1,
            },
          },
          "values": Array [
            1,
            undefined,
            2,
          ],
        },
      ]
    `);

    // Fast path still adds origin indecies
    out = joinDataFrames({ frames: [series1], keepOriginIndices: true })!;
    expect(
      out.fields.map((f) => ({
        name: f.name,
        state: f.state,
      }))
    ).toMatchInlineSnapshot(`
      Array [
        Object {
          "name": "TheTime",
          "state": Object {
            "origin": Object {
              "fieldIndex": 0,
              "frameIndex": 0,
            },
          },
        },
        Object {
          "name": "A1",
          "state": Object {
            "origin": Object {
              "fieldIndex": 1,
              "frameIndex": 0,
            },
          },
        },
      ]
    `);
  });

  it('sort single frame as index zero', () => {
    const series1 = toDataFrame({
      fields: [
        { name: 'A1', type: FieldType.number, values: [1, 22, 15] },
        { name: 'TheTime', type: FieldType.time, values: [6000, 2000, 1500] },
      ],
    });

    const out = joinDataFrames({ frames: [series1], keepOriginIndices: true })!;
    expect(
      out.fields.map((f) => ({
        name: f.name,
        values: f.values.toArray(),
      }))
    ).toMatchInlineSnapshot(`
      Array [
        Object {
          "name": "TheTime",
          "values": Array [
            1500,
            2000,
            6000,
          ],
        },
        Object {
          "name": "A1",
          "values": Array [
            15,
            22,
            1,
          ],
        },
      ]
    `);
  });

  it('supports duplicate times', () => {
    //----------
    // NOTE!!!
    // * ideally we would *keep* dupicate fields
    //----------
    const series1 = toDataFrame({
      fields: [
        { name: 'TheTime', type: FieldType.time, values: [1000, 2000] },
        { name: 'A', type: FieldType.number, values: [1, 100] },
      ],
    });

    const series3 = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000, 1000, 1000] },
        { name: 'A', type: FieldType.number, values: [2, 20, 200] },
      ],
    });

    const out = joinDataFrames({ frames: [series1, series3] })!;
    expect(
      out.fields.map((f) => ({
        name: f.name,
        values: f.values.toArray(),
      }))
    ).toMatchInlineSnapshot(`
      Array [
        Object {
          "name": "TheTime",
          "values": Array [
            1000,
            2000,
          ],
        },
        Object {
          "name": "A",
          "values": Array [
            1,
            100,
          ],
        },
        Object {
          "name": "A",
          "values": Array [
            200,
            undefined,
          ],
        },
      ]
    `);
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

    it('ascending first/last', () => {
      expect(isLikelyAscendingVector(new ArrayVector([10, 20, 30, 5, 15, 7, 43, 29, 11]), 3)).toBeFalsy();
      expect(
        isLikelyAscendingVector(new ArrayVector([null, 10, 20, 30, 5, null, 15, 7, 43, 29, 11, null]), 3)
      ).toBeFalsy();
    });

    it('null stuffs', () => {
      expect(isLikelyAscendingVector(new ArrayVector([null, null, 1]), 3)).toBeTruthy();
      expect(isLikelyAscendingVector(new ArrayVector([1, null, null]), 3)).toBeTruthy();
      expect(isLikelyAscendingVector(new ArrayVector([null, null, null]), 3)).toBeTruthy();
      expect(isLikelyAscendingVector(new ArrayVector([null, 1, null]), 3)).toBeTruthy();
    });
  });
});
