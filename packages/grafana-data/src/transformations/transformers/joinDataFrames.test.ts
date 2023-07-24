import { toDataFrame } from '../../dataframe/processDataFrame';
import { getFieldDisplayName } from '../../field';
import { DataFrame, FieldType } from '../../types/dataFrame';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';

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
          values: f.values,
        }))
      ).toMatchInlineSnapshot(`
        [
          {
            "name": "TheTime",
            "values": [
              1000,
              1500,
              2000,
            ],
          },
          {
            "name": "A",
            "values": [
              1,
              undefined,
              100,
            ],
          },
          {
            "name": "A",
            "values": [
              2,
              20,
              200,
            ],
          },
          {
            "name": "B",
            "values": [
              3,
              30,
              300,
            ],
          },
          {
            "name": "C",
            "values": [
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
          values: f.values,
        }))
      ).toMatchInlineSnapshot(`
        [
          {
            "name": "TheTime",
            "values": [
              1000,
              2000,
            ],
          },
          {
            "name": "A",
            "values": [
              1,
              100,
            ],
          },
          {
            "name": "A",
            "values": [
              2,
              200,
            ],
          },
          {
            "name": "B",
            "values": [
              3,
              300,
            ],
          },
          {
            "name": "C",
            "values": [
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
        values: f.values,
        state: f.state,
      }))
    ).toMatchInlineSnapshot(`
      [
        {
          "name": "TheTime",
          "state": {
            "origin": {
              "fieldIndex": 0,
              "frameIndex": 0,
            },
          },
          "values": [
            1000,
            1500,
            2000,
          ],
        },
        {
          "name": "A1",
          "state": {
            "origin": {
              "fieldIndex": 1,
              "frameIndex": 0,
            },
          },
          "values": [
            1,
            15,
            2,
          ],
        },
        {
          "name": "A2",
          "state": {
            "origin": {
              "fieldIndex": 1,
              "frameIndex": 1,
            },
          },
          "values": [
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
      [
        {
          "name": "TheTime",
          "state": {
            "origin": {
              "fieldIndex": 0,
              "frameIndex": 0,
            },
          },
        },
        {
          "name": "A1",
          "state": {
            "origin": {
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
        values: f.values,
      }))
    ).toMatchInlineSnapshot(`
      [
        {
          "name": "TheTime",
          "values": [
            1500,
            2000,
            6000,
          ],
        },
        {
          "name": "A1",
          "values": [
            15,
            22,
            1,
          ],
        },
      ]
    `);
  });

  it('maintains naming convention after join', () => {
    const series1 = toDataFrame({
      name: 'Muta',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000, 2000] },
        { name: 'Value', type: FieldType.number, values: [1, 100] },
      ],
    });
    expect(getFieldDisplayNames([series1])).toMatchInlineSnapshot(`
      [
        "Time",
        "Muta",
      ]
    `);
    expect(getFieldNames([series1])).toMatchInlineSnapshot(`
      [
        "Time",
        "Value",
      ]
    `);

    const series2 = toDataFrame({
      name: 'Muta',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000] },
        { name: 'Value', type: FieldType.number, values: [150] },
      ],
    });
    expect(getFieldDisplayNames([series2])).toMatchInlineSnapshot(`
      [
        "Time",
        "Muta",
      ]
    `);
    expect(getFieldNames([series2])).toMatchInlineSnapshot(`
      [
        "Time",
        "Value",
      ]
    `);

    const out = joinDataFrames({ frames: [series1, series2] })!;
    expect(getFieldDisplayNames([out])).toMatchInlineSnapshot(`
      [
        "Time",
        "Muta 1",
        "Muta 2",
      ]
    `);
    expect(getFieldNames([out])).toMatchInlineSnapshot(`
      [
        "Time",
        "Muta",
        "Muta",
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
        values: f.values,
      }))
    ).toMatchInlineSnapshot(`
      [
        {
          "name": "TheTime",
          "values": [
            1000,
            2000,
          ],
        },
        {
          "name": "A",
          "values": [
            1,
            100,
          ],
        },
        {
          "name": "A",
          "values": [
            200,
            undefined,
          ],
        },
      ]
    `);
  });

  describe('check ascending data', () => {
    it('simple ascending', () => {
      const v = [1, 2, 3, 4, 5];
      expect(isLikelyAscendingVector(v)).toBeTruthy();
    });
    it('simple ascending with null', () => {
      const v = [null, 2, 3, 4, null];
      expect(isLikelyAscendingVector(v)).toBeTruthy();
    });
    it('single value', () => {
      const v = [null, null, null, 4, null];
      expect(isLikelyAscendingVector(v)).toBeTruthy();
      expect(isLikelyAscendingVector([4])).toBeTruthy();
      expect(isLikelyAscendingVector([])).toBeTruthy();
    });

    it('middle values', () => {
      const v = [null, null, 5, 4, null];
      expect(isLikelyAscendingVector(v)).toBeFalsy();
    });

    it('decending', () => {
      expect(isLikelyAscendingVector([7, 6, null])).toBeFalsy();
      expect(isLikelyAscendingVector([7, 8, 6])).toBeFalsy();
    });

    it('ascending first/last', () => {
      expect(isLikelyAscendingVector([10, 20, 30, 5, 15, 7, 43, 29, 11], 3)).toBeFalsy();
      expect(isLikelyAscendingVector([null, 10, 20, 30, 5, null, 15, 7, 43, 29, 11, null], 3)).toBeFalsy();
    });

    it('null stuffs', () => {
      expect(isLikelyAscendingVector([null, null, 1], 3)).toBeTruthy();
      expect(isLikelyAscendingVector([1, null, null], 3)).toBeTruthy();
      expect(isLikelyAscendingVector([null, null, null], 3)).toBeTruthy();
      expect(isLikelyAscendingVector([null, 1, null], 3)).toBeTruthy();
    });
  });
});

function getFieldDisplayNames(data: DataFrame[]): string[] {
  return data.flatMap((frame) => frame.fields.map((f) => getFieldDisplayName(f, frame, data)));
}

function getFieldNames(data: DataFrame[]): string[] {
  return data.flatMap((frame) => frame.fields.map((f) => f.name));
}
