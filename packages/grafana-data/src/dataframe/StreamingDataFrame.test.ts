import { reduceField, ReducerID } from '..';
import { getFieldDisplayName } from '../field';
import { DataFrame, FieldType } from '../types/dataFrame';
import { DataFrameJSON } from './DataFrameJSON';
import { StreamingDataFrame } from './StreamingDataFrame';

describe('Streaming JSON', () => {
  describe('when called with a DataFrame', () => {
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
      },
    };

    const stream = new StreamingDataFrame(json, {
      maxLength: 5,
      maxDelta: 300,
    });

    it('should create frame with schema & data', () => {
      expect(stream.fields.map((f) => ({ name: f.name, value: f.values.buffer }))).toMatchInlineSnapshot(`
        Array [
          Object {
            "name": "time",
            "value": Array [
              100,
              200,
              300,
            ],
          },
          Object {
            "name": "name",
            "value": Array [
              "a",
              "b",
              "c",
            ],
          },
          Object {
            "name": "value",
            "value": Array [
              1,
              2,
              3,
            ],
          },
        ]
      `);
    });

    it('should append new data to frame', () => {
      stream.push({
        data: {
          values: [[400], ['d'], [4]],
        },
      });

      expect(stream.fields.map((f) => ({ name: f.name, value: f.values.buffer }))).toMatchInlineSnapshot(`
        Array [
          Object {
            "name": "time",
            "value": Array [
              100,
              200,
              300,
              400,
            ],
          },
          Object {
            "name": "name",
            "value": Array [
              "a",
              "b",
              "c",
              "d",
            ],
          },
          Object {
            "name": "value",
            "value": Array [
              1,
              2,
              3,
              4,
            ],
          },
        ]
      `);
    });

    it('should append new data and slice based on maxDelta', () => {
      stream.push({
        data: {
          values: [[500], ['e'], [5]],
        },
      });

      expect(stream.fields.map((f) => ({ name: f.name, value: f.values.buffer }))).toMatchInlineSnapshot(`
        Array [
          Object {
            "name": "time",
            "value": Array [
              200,
              300,
              400,
              500,
            ],
          },
          Object {
            "name": "name",
            "value": Array [
              "b",
              "c",
              "d",
              "e",
            ],
          },
          Object {
            "name": "value",
            "value": Array [
              2,
              3,
              4,
              5,
            ],
          },
        ]
      `);
    });

    it('should append new data and slice based on maxLength', () => {
      stream.push({
        data: {
          values: [
            [501, 502, 503],
            ['f', 'g', 'h'],
            [6, 7, 8, 9],
          ],
        },
      });

      expect(stream.fields.map((f) => ({ name: f.name, value: f.values.buffer }))).toMatchInlineSnapshot(`
        Array [
          Object {
            "name": "time",
            "value": Array [
              400,
              500,
              501,
              502,
              503,
            ],
          },
          Object {
            "name": "name",
            "value": Array [
              "d",
              "e",
              "f",
              "g",
              "h",
            ],
          },
          Object {
            "name": "value",
            "value": Array [
              4,
              5,
              6,
              7,
              8,
              9,
            ],
          },
        ]
      `);
    });
  });

  describe('lengths property is accurate', () => {
    const stream = new StreamingDataFrame(
      {
        schema: {
          fields: [{ name: 'simple', type: FieldType.number }],
        },
        data: {
          values: [[100]],
        },
      },
      {
        maxLength: 5,
      }
    );
    let val = reduceField({ field: stream.fields[0], reducers: [ReducerID.lastNotNull] })[ReducerID.lastNotNull];
    expect(val).toEqual(100);
    expect(stream.length).toEqual(1);
    stream.push({
      data: { values: [[200]] },
    });
    val = reduceField({ field: stream.fields[0], reducers: [ReducerID.lastNotNull] })[ReducerID.lastNotNull];
    expect(val).toEqual(200);
    expect(stream.length).toEqual(2);

    const copy = ({ ...stream } as any) as DataFrame;
    expect(copy.length).toEqual(2);
  });

  describe('streaming labels column', () => {
    const stream = new StreamingDataFrame(
      {
        schema: {
          fields: [
            { name: 'labels', type: FieldType.string },
            { name: 'time', type: FieldType.time },
            { name: 'speed', type: FieldType.number },
            { name: 'light', type: FieldType.number },
          ],
        },
      },
      {
        maxLength: 4,
      }
    );

    stream.push({
      data: {
        values: [
          ['sensor=A', 'sensor=B'],
          [100, 100],
          [10, 15],
          [1, 2],
        ],
      },
    });

    stream.push({
      data: {
        values: [
          ['sensor=B', 'sensor=C'],
          [200, 200],
          [20, 25],
          [3, 4],
        ],
      },
    });

    stream.push({
      data: {
        values: [
          ['sensor=A', 'sensor=C'],
          [300, 400],
          [30, 40],
          [5, 6],
        ],
      },
    });

    expect(stream.fields.map((f) => ({ name: f.name, labels: f.labels, values: f.values.buffer })))
      .toMatchInlineSnapshot(`
      Array [
        Object {
          "labels": undefined,
          "name": "time",
          "values": Array [
            100,
            200,
            300,
            400,
          ],
        },
        Object {
          "labels": Object {
            "sensor": "A",
          },
          "name": "speed",
          "values": Array [
            10,
            undefined,
            30,
            undefined,
          ],
        },
        Object {
          "labels": Object {
            "sensor": "A",
          },
          "name": "light",
          "values": Array [
            1,
            undefined,
            5,
            undefined,
          ],
        },
        Object {
          "labels": Object {
            "sensor": "B",
          },
          "name": "speed",
          "values": Array [
            15,
            20,
            undefined,
            undefined,
          ],
        },
        Object {
          "labels": Object {
            "sensor": "B",
          },
          "name": "light",
          "values": Array [
            2,
            3,
            undefined,
            undefined,
          ],
        },
        Object {
          "labels": Object {
            "sensor": "C",
          },
          "name": "speed",
          "values": Array [
            undefined,
            25,
            undefined,
            40,
          ],
        },
        Object {
          "labels": Object {
            "sensor": "C",
          },
          "name": "light",
          "values": Array [
            undefined,
            4,
            undefined,
            6,
          ],
        },
      ]
    `);

    // Push value with empty labels
    stream.push({
      data: {
        values: [[''], [500], [50], [7]],
      },
    });

    expect(stream.fields.map((f) => getFieldDisplayName(f, stream, [stream]))).toMatchInlineSnapshot(`
      Array [
        "time",
        "speed A",
        "light A",
        "speed B",
        "light B",
        "speed C",
        "light C",
        "speed 4",
        "light 4",
      ]
    `); // speed+light 4  ¯\_(ツ)_/¯ better than undefined labels
  });

  /*
  describe('transpose vertical records', () => {
    let vrecsA = [
      ['sensor=A', 'sensor=B'],
      [100, 100],
      [10, 15],
    ];

    let vrecsB = [
      ['sensor=B', 'sensor=C'],
      [200, 200],
      [20, 25],
    ];

    let vrecsC = [
      ['sensor=A', 'sensor=C'],
      [300, 400],
      [30, 40],
    ];

    let cTables = transpose(vrecsC);

    expect(cTables).toMatchInlineSnapshot(`
      Array [
        Array [
          "sensor=A",
          "sensor=C",
        ],
        Array [
          Array [
            Array [
              300,
            ],
            Array [
              30,
            ],
          ],
          Array [
            Array [
              400,
            ],
            Array [
              40,
            ],
          ],
        ],
      ]
    `);

    let cJoined = join(cTables[1]);

    expect(cJoined).toMatchInlineSnapshot(`
      Array [
        Array [
          300,
          400,
        ],
        Array [
          30,
          undefined,
        ],
        Array [
          undefined,
          40,
        ],
      ]
    `);
  });
*/
});
