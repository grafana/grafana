import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType } from '../../types/dataFrame';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { ArrayVector } from '../../vector';
import { getFieldMatcher } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';
import { calculateFieldTransformer } from './calculateField';
import { isLikelyAscendingVector, outerJoinDataFrames } from './joinDataFrames';

describe('align frames', () => {
  beforeAll(() => {
    mockTransformationsRegistry([calculateFieldTransformer]);
  });

  it('by first time field', () => {
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

    const out = outerJoinDataFrames({ frames: [series1, series2] })!;
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

    let out = outerJoinDataFrames({ frames: [series1, series3], keepOriginIndices: true })!;
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
            "displayName": "TheTime",
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
            "displayName": "A1",
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
            "displayName": "A2",
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
    out = outerJoinDataFrames({ frames: [series1], keepOriginIndices: true })!;
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
            "displayName": "TheTime",
            "origin": Object {
              "fieldIndex": 0,
              "frameIndex": 0,
            },
          },
        },
        Object {
          "name": "A1",
          "state": Object {
            "displayName": "A1",
            "origin": Object {
              "fieldIndex": 1,
              "frameIndex": 0,
            },
          },
        },
      ]
    `);
  });

  it('sort single frame', () => {
    const series1 = toDataFrame({
      fields: [
        { name: 'TheTime', type: FieldType.time, values: [6000, 2000, 1500] },
        { name: 'A1', type: FieldType.number, values: [1, 22, 15] },
      ],
    });

    const out = outerJoinDataFrames({ frames: [series1], enforceSort: true, keepOriginIndices: true })!;
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

  it('will join by a numeric ID', () => {
    //----------
    const frameA = toDataFrame({
      fields: [
        { name: 'f0', type: FieldType.string, values: ['a', 'b', 'c'] },
        { name: 'id', type: FieldType.number, values: [1, 2, 3] },
      ],
    });

    const frameB = toDataFrame({
      fields: [
        { name: 'f1', type: FieldType.string, values: ['x', 'y', 'z'] },
        { name: 'id', type: FieldType.number, values: [1, 4, 3] },
      ],
    });

    const out = outerJoinDataFrames({
      joinBy: getFieldMatcher({
        id: FieldMatcherID.byName,
        options: 'id',
      }),
      frames: [frameA, frameB],
    })!;
    expect(
      out.fields.map((f) => ({
        name: f.name,
        values: f.values.toArray(),
      }))
    ).toMatchInlineSnapshot(`
      Array [
        Object {
          "name": "id",
          "values": Array [
            1,
            2,
            3,
            4,
          ],
        },
        Object {
          "name": "f0",
          "values": Array [
            "a",
            "b",
            "c",
            undefined,
          ],
        },
        Object {
          "name": "f1",
          "values": Array [
            "x",
            undefined,
            "z",
            "y",
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

    const out = outerJoinDataFrames({ frames: [series1, series3] })!;
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
  });
});
