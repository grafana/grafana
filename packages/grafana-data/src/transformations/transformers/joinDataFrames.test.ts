import { toDataFrame } from '../../dataframe/processDataFrame';
import { getFieldDisplayName } from '../../field/fieldState';
import { DataFrame, FieldType } from '../../types/dataFrame';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { fieldMatchers } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';

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

    // the following does not work for tabular joins where the joined on field value is duplicated
    // the time will never have a duplicated time which is joined on
    it('should perform an outer join - as expected on time series data', () => {
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

    it('should perform an inner join - as expected on time series data', () => {
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

  describe('join tabular data by chosen field', () => {
    // join on gender where there are multiple values, duplicate values which can increase the rows

    const tableData1 = toDataFrame({
      fields: [
        {
          name: 'gender',
          type: FieldType.string,
          values: ['NON-BINARY', 'MALE', 'MALE', 'FEMALE', 'FEMALE', 'NON-BINARY', 'COW'],
        },
        {
          name: 'day',
          type: FieldType.string,
          values: ['Wednesday', 'Tuesday', 'Monday', 'Wednesday', 'Tuesday', 'Monday', 'Monday'],
        },
        { name: 'count', type: FieldType.number, values: [18, 72, 13, 17, 71, 7, 1] },
      ],
    });
    const tableData2 = toDataFrame({
      fields: [
        { name: 'gender', type: FieldType.string, values: ['MALE', 'NON-BINARY', 'FEMALE', 'DOG'] },
        { name: 'count', type: FieldType.number, values: [103, 95, 201, 6] },
      ],
    });

    it('should perform an outer join with duplicated values to join on - as expected for tabular data', () => {
      const out = joinDataFrames({
        frames: [tableData1, tableData2],
        joinBy: fieldMatchers.get(FieldMatcherID.byName).get('gender'),
        mode: JoinMode.outerTabular,
      })!;
      expect(
        out.fields.map((f) => ({
          name: f.name,
          values: f.values,
        }))
      ).toMatchInlineSnapshot(`
        [
          {
            "name": "gender",
            "values": [
              "NON-BINARY",
              "MALE",
              "MALE",
              "FEMALE",
              "FEMALE",
              "NON-BINARY",
              "COW",
              "DOG",
            ],
          },
          {
            "name": "day",
            "values": [
              "Wednesday",
              "Tuesday",
              "Monday",
              "Wednesday",
              "Tuesday",
              "Monday",
              "Monday",
              null,
            ],
          },
          {
            "name": "count",
            "values": [
              18,
              72,
              13,
              17,
              71,
              7,
              1,
              null,
            ],
          },
          {
            "name": "count",
            "values": [
              95,
              103,
              103,
              201,
              201,
              95,
              null,
              6,
            ],
          },
        ]
      `);
    });

    it('should perform an inner join with duplicated values to join on - as expected for tabular data', () => {
      const out = joinDataFrames({
        frames: [tableData1, tableData2],
        joinBy: fieldMatchers.get(FieldMatcherID.byName).get('gender'),
        mode: JoinMode.inner,
      })!;
      expect(
        out.fields.map((f) => ({
          name: f.name,
          values: f.values,
        }))
      ).toMatchInlineSnapshot(`
        [
          {
            "name": "gender",
            "values": [
              "NON-BINARY",
              "MALE",
              "MALE",
              "FEMALE",
              "FEMALE",
              "NON-BINARY",
            ],
          },
          {
            "name": "day",
            "values": [
              "Wednesday",
              "Tuesday",
              "Monday",
              "Wednesday",
              "Tuesday",
              "Monday",
            ],
          },
          {
            "name": "count",
            "values": [
              18,
              72,
              13,
              17,
              71,
              7,
            ],
          },
          {
            "name": "count",
            "values": [
              95,
              103,
              103,
              201,
              201,
              95,
            ],
          },
        ]
      `);
    });

    it('should perform an inner join with empty values', () => {
      const out = joinDataFrames({
        frames: [
          toDataFrame({
            fields: [
              {
                name: 'A',
                type: FieldType.string,
                values: [],
              },
              {
                name: 'B',
                type: FieldType.string,
                values: [],
              },
            ],
          }),
          toDataFrame({
            fields: [
              {
                name: 'A',
                type: FieldType.string,
                values: [],
              },
              {
                name: 'C',
                type: FieldType.string,
                values: [],
              },
            ],
          }),
        ],
        joinBy: fieldMatchers.get(FieldMatcherID.byName).get('A'),
        mode: JoinMode.inner,
      })!;

      expect(
        out.fields.map((f) => ({
          name: f.name,
          values: f.values,
        }))
      ).toMatchInlineSnapshot(`
        [
          {
            "name": "A",
            "values": [],
          },
          {
            "name": "B",
            "values": [],
          },
          {
            "name": "C",
            "values": [],
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

  it('add frame.name as field.labels.name only when field.labels.name does not exist', () => {
    const series1 = toDataFrame({
      name: 'Frame A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000, 2000] },
        { name: 'Metric 1', type: FieldType.number, values: [1, 100], labels: { name: 'bar' } },
      ],
    });

    const series2 = toDataFrame({
      name: 'Frame B',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000] },
        { name: 'Metric 2', type: FieldType.number, values: [150] },
      ],
    });

    const series3 = toDataFrame({
      name: 'Frame C',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000] },
        { name: 'Value', type: FieldType.number, values: [150] }, // weird that in this "Value" case it doesnt get moved into field.labels.name
      ],
    });

    const out = joinDataFrames({ frames: [series1, series2, series3] })!;

    expect(out.fields[1].labels).toEqual({ name: 'bar' });
    expect(out.fields[2].labels).toEqual({ name: 'Frame B' });
    expect(out.fields[3].labels).toEqual({});
  });

  it('supports duplicate times', () => {
    //----------
    // NOTE!!!
    // * ideally we would *keep* duplicate fields
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
