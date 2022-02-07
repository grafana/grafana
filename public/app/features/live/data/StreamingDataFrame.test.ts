import { reduceField, ReducerID, getFieldDisplayName, DataFrame, FieldType, DataFrameJSON } from '@grafana/data';
import { StreamingFrameAction, StreamingFrameOptions } from '@grafana/runtime';
import { getStreamingFrameOptions, StreamingDataFrame } from './StreamingDataFrame';

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

    const stream = StreamingDataFrame.fromDataFrameJSON(json, {
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

    it('should append data with new schema and fill missed values with undefined', () => {
      stream.push({
        schema: {
          fields: [
            { name: 'time', type: FieldType.time },
            { name: 'name', type: FieldType.string },
            { name: 'value', type: FieldType.number },
            { name: 'value2', type: FieldType.number },
          ],
        },
        data: {
          values: [[601], ['i'], [10], [-10]],
        },
      });

      expect(stream.fields.map((f) => ({ name: f.name, value: f.values.buffer }))).toMatchInlineSnapshot(`
        Array [
          Object {
            "name": "time",
            "value": Array [
              500,
              501,
              502,
              503,
              601,
            ],
          },
          Object {
            "name": "name",
            "value": Array [
              "e",
              "f",
              "g",
              "h",
              "i",
            ],
          },
          Object {
            "name": "value",
            "value": Array [
              5,
              6,
              7,
              8,
              9,
              10,
            ],
          },
          Object {
            "name": "value2",
            "value": Array [
              undefined,
              undefined,
              undefined,
              undefined,
              -10,
            ],
          },
        ]
      `);
    });

    it('should be able to return values from previous packet', function () {
      stream.push({
        data: {
          values: [
            [602, 603],
            ['j', 'k'],
            [11, 12],
            [-11, -12],
          ],
        },
      });

      expect(stream.getValuesFromLastPacket()).toEqual([
        [602, 603],
        ['j', 'k'],
        [11, 12],
        [-11, -12],
      ]);
    });
  });

  describe('serialization', function () {
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

    const frame = StreamingDataFrame.fromDataFrameJSON(json, {
      maxLength: 5,
      maxDelta: 300,
    });

    it('should filter fields', function () {
      const serializedFrame = frame.serialize((f) => ['time'].includes(f.name));
      expect(serializedFrame.fields).toEqual([
        {
          config: {},
          name: 'time',
          type: 'time',
          values: [100, 200, 300],
        },
      ]);
    });

    it('should resize the buffer', function () {
      const serializedFrame = frame.serialize((f) => ['time', 'name'].includes(f.name), { maxLength: 2 });
      expect(serializedFrame.fields).toEqual([
        {
          config: {},
          name: 'time',
          type: 'time',
          values: [200, 300],
        },
        {
          config: {},
          name: 'name',
          type: 'string',
          values: ['b', 'c'],
        },
      ]);
    });
  });

  describe('resizing', function () {
    it.each([
      [
        {
          existing: {
            maxLength: 10,
            maxDelta: 5,
            action: StreamingFrameAction.Replace,
          },
          newOptions: {},
          expected: {
            maxLength: 10,
            maxDelta: 5,
            action: StreamingFrameAction.Replace,
          },
        },
      ],
      [
        {
          existing: {
            maxLength: 10,
            maxDelta: 5,
            action: StreamingFrameAction.Replace,
          },
          newOptions: {
            maxLength: 9,
            maxDelta: 4,
          },
          expected: {
            maxLength: 10,
            maxDelta: 5,
            action: StreamingFrameAction.Replace,
          },
        },
      ],
      [
        {
          existing: {
            maxLength: 10,
            maxDelta: 5,
            action: StreamingFrameAction.Replace,
          },
          newOptions: {
            maxLength: 11,
            maxDelta: 6,
          },
          expected: {
            maxLength: 11,
            maxDelta: 6,
            action: StreamingFrameAction.Replace,
          },
        },
      ],
    ])(
      'should always resize to a bigger buffer',
      ({
        existing,
        expected,
        newOptions,
      }: {
        existing: StreamingFrameOptions;
        newOptions: Partial<StreamingFrameOptions>;
        expected: StreamingFrameOptions;
      }) => {
        const frame = StreamingDataFrame.empty(existing);
        frame.resize(newOptions);
        expect(frame.getOptions()).toEqual(expected);
      }
    );

    it('should override infinity maxDelta', function () {
      const frame = StreamingDataFrame.empty({
        maxLength: 10,
        maxDelta: Infinity,
        action: StreamingFrameAction.Replace,
      });
      frame.resize({
        maxLength: 9,
        maxDelta: 4,
      });
      expect(frame.getOptions()).toEqual({
        maxLength: 10,
        maxDelta: 4,
        action: StreamingFrameAction.Replace,
      });
    });
  });

  describe('options with defaults', function () {
    it('should provide defaults', function () {
      expect(getStreamingFrameOptions()).toEqual({
        action: StreamingFrameAction.Append,
        maxDelta: Infinity,
        maxLength: 1000,
      });
    });
  });

  describe('when deserialized', function () {
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

    const serializedFrame = StreamingDataFrame.fromDataFrameJSON(json, {
      maxLength: 5,
      maxDelta: 300,
    }).serialize();

    it('should support pushing new values matching the existing schema', function () {
      const frame = StreamingDataFrame.deserialize(serializedFrame);
      frame.pushNewValues([[601], ['x'], [10]]);
      expect(frame.fields.map((f) => ({ name: f.name, value: f.values.buffer }))).toMatchInlineSnapshot(`
        Array [
          Object {
            "name": "time",
            "value": Array [
              300,
              601,
            ],
          },
          Object {
            "name": "name",
            "value": Array [
              "c",
              "x",
            ],
          },
          Object {
            "name": "value",
            "value": Array [
              3,
              10,
            ],
          },
        ]
      `);
    });
  });

  describe('when created empty', function () {
    it('should have no packets', function () {
      const streamingDataFrame = StreamingDataFrame.empty();
      expect(streamingDataFrame.hasAtLeastOnePacket()).toEqual(false);
      expect(streamingDataFrame.fields).toHaveLength(0);
    });
  });

  describe('lengths property is accurate', () => {
    const stream = StreamingDataFrame.fromDataFrameJSON(
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
    const stream = StreamingDataFrame.fromDataFrameJSON(
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
        displayNameFormat: '{{__name__}}: {{sensor}}',
      }
    );

    stream.push({
      data: {
        values: [
          // A = influxStyle, B = prometheus style labels
          // key must be constatnt for join to work
          ['sensor=A', '{sensor="B"}'],
          [100, 100],
          [10, 15],
          [1, 2],
        ],
      },
    });

    stream.push({
      data: {
        values: [
          ['{sensor="B"}', 'sensor=C'],
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

    // names are based on legend format
    expect(stream.fields.map((f) => getFieldDisplayName(f, stream, [stream]))).toMatchInlineSnapshot(`
      Array [
        "time: sensor",
        "speed: A",
        "light: A",
        "speed: B",
        "light: B",
        "speed: C",
        "light: C",
        "speed: sensor",
        "light: sensor",
      ]
    `);
  });

  describe('keep track of packets', () => {
    const json: DataFrameJSON = {
      schema: {
        fields: [
          { name: 'time', type: FieldType.time },
          { name: 'value', type: FieldType.number },
        ],
      },
      data: {
        values: [
          [100, 200, 300],
          [1, 2, 3],
        ],
      },
    };

    const stream = StreamingDataFrame.fromDataFrameJSON(json, {
      maxLength: 4,
      maxDelta: 300,
    });

    const getSnapshot = (f: StreamingDataFrame) => {
      return {
        values: f.fields[1].values.toArray(),
        info: f.packetInfo,
      };
    };

    expect(getSnapshot(stream)).toMatchInlineSnapshot(`
      Object {
        "info": Object {
          "action": "replace",
          "length": 3,
          "number": 1,
          "schemaChanged": true,
        },
        "values": Array [
          1,
          2,
          3,
        ],
      }
    `);

    stream.push({
      data: {
        values: [
          [400, 500],
          [4, 5],
        ],
      },
    });
    expect(getSnapshot(stream)).toMatchInlineSnapshot(`
      Object {
        "info": Object {
          "action": "append",
          "length": 2,
          "number": 2,
          "schemaChanged": false,
        },
        "values": Array [
          2,
          3,
          4,
          5,
        ],
      }
    `);

    stream.push({
      data: {
        values: [[600], [6]],
      },
    });
    expect(getSnapshot(stream)).toMatchInlineSnapshot(`
      Object {
        "info": Object {
          "action": "append",
          "length": 1,
          "number": 3,
          "schemaChanged": false,
        },
        "values": Array [
          3,
          4,
          5,
          6,
        ],
      }
    `);
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
