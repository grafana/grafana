import { DataFrame, DataFrameJSON, FieldType, getFieldDisplayName, reduceField, ReducerID } from '@grafana/data';
import { StreamingFrameAction, StreamingFrameOptions } from '@grafana/runtime';
import { closestIdx, getStreamingFrameOptions, StreamingDataFrame } from './StreamingDataFrame';

describe('Streaming JSON', () => {
  describe('closestIdx', function () {
    [
      {
        num: 10,
        arr: [2, 3, 4, 5, 6],
        expected: 4,
        descr: 'bigger than all in array',
      },
      {
        num: 10,
        arr: [2, 3, 4, 5, 11, 12, 13],
        expected: 4,
        descr: 'bigger than some in array #1 - smaller difference to bigger number',
      },
      {
        num: 10,
        arr: [2, 3, 4, 5, 16, 17, 18],
        expected: 3,
        descr: 'bigger than some in array #2 - smaller difference to smaller number',
      },
      {
        num: 10,
        arr: [2, 3, 4, 9, 11, 12, 13],
        expected: 3,
        descr: 'bigger than some in array #3 - same difference between smaller and bigger number - favors smaller',
      },
      {
        num: 10,
        arr: [9, 10, 11, 12, 13, 14],
        expected: 1,
        descr: 'present in the array',
      },
      {
        num: 10,
        arr: [10, 11, 12, 13, 14],
        expected: 0,
        descr: 'present in the array on first position',
      },
      {
        num: 10,
        arr: [5, 6, 7, 8, 9, 10],
        expected: 5,
        descr: 'present in the array on last position',
      },
      {
        num: 10,
        arr: [11, 12, 13, 14, 15],
        expected: 0,
        descr: 'smaller than all in array',
      },
      {
        num: 10,
        arr: [],
        expected: -1,
        descr: 'empty array',
      },
    ].forEach(({ num, arr, expected, descr }) => {
      it(descr, () => {
        expect(closestIdx(num, arr)).toEqual(expected);
      });
    });
  });

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
        [
          {
            "name": "time",
            "value": [
              100,
              200,
              300,
            ],
          },
          {
            "name": "name",
            "value": [
              "a",
              "b",
              "c",
            ],
          },
          {
            "name": "value",
            "value": [
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
        [
          {
            "name": "time",
            "value": [
              100,
              200,
              300,
              400,
            ],
          },
          {
            "name": "name",
            "value": [
              "a",
              "b",
              "c",
              "d",
            ],
          },
          {
            "name": "value",
            "value": [
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
        [
          {
            "name": "time",
            "value": [
              200,
              300,
              400,
              500,
            ],
          },
          {
            "name": "name",
            "value": [
              "b",
              "c",
              "d",
              "e",
            ],
          },
          {
            "name": "value",
            "value": [
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
        [
          {
            "name": "time",
            "value": [
              400,
              500,
              501,
              502,
              503,
            ],
          },
          {
            "name": "name",
            "value": [
              "d",
              "e",
              "f",
              "g",
              "h",
            ],
          },
          {
            "name": "value",
            "value": [
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
        [
          {
            "name": "time",
            "value": [
              500,
              501,
              502,
              503,
              601,
            ],
          },
          {
            "name": "name",
            "value": [
              "e",
              "f",
              "g",
              "h",
              "i",
            ],
          },
          {
            "name": "value",
            "value": [
              5,
              6,
              7,
              8,
              9,
              10,
            ],
          },
          {
            "name": "value2",
            "value": [
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
      const options = { maxLength: 2 };
      const serializedFrame = frame.serialize((f) => ['time', 'name'].includes(f.name), options);
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

    it('should trim values and retain option override values', function () {
      const options = { maxLength: 2 };
      const trimValues = { maxLength: 1 };
      const serializedFrame = frame.serialize((f) => ['time', 'name'].includes(f.name), options, trimValues);
      expect(serializedFrame.fields).toEqual([
        {
          config: {},
          name: 'time',
          type: 'time',
          values: [300],
        },
        {
          config: {},
          name: 'name',
          type: 'string',
          values: ['c'],
        },
      ]);
      expect(serializedFrame.options.maxLength).toEqual(options.maxLength);
    });

    it('should use maxLength from options if its lower than maxLength from trimValues', function () {
      const options = { maxLength: 1 };
      const trimValues = { maxLength: 2 };
      const serializedFrame = frame.serialize((f) => ['time', 'name'].includes(f.name), options, trimValues);
      expect(serializedFrame.fields).toEqual([
        {
          config: {},
          name: 'time',
          type: 'time',
          values: [300],
        },
        {
          config: {},
          name: 'name',
          type: 'string',
          values: ['c'],
        },
      ]);
      expect(serializedFrame.options.maxLength).toEqual(options.maxLength);
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

    it('should support pushing new values matching the existing schema in `append` mode', function () {
      const frame = StreamingDataFrame.deserialize(
        StreamingDataFrame.fromDataFrameJSON(json, {
          maxLength: 5,
          maxDelta: 300,
        }).serialize()
      );
      expect(frame.length).toEqual(3);
      frame.pushNewValues([
        [601, 602],
        ['x', 'y'],
        [10, 11],
      ]);
      expect(frame.length).toEqual(3);
      expect(frame.fields.map((f) => ({ name: f.name, value: f.values.buffer }))).toMatchInlineSnapshot(`
        [
          {
            "name": "time",
            "value": [
              300,
              601,
              602,
            ],
          },
          {
            "name": "name",
            "value": [
              "c",
              "x",
              "y",
            ],
          },
          {
            "name": "value",
            "value": [
              3,
              10,
              11,
            ],
          },
        ]
      `);
    });

    it('should support pushing new values matching the existing schema in `replace` mode', function () {
      const frame = StreamingDataFrame.deserialize(
        StreamingDataFrame.fromDataFrameJSON(json, {
          maxLength: 5,
          maxDelta: 300,
          action: StreamingFrameAction.Replace,
        }).serialize()
      );
      expect(frame.length).toEqual(3);
      frame.pushNewValues([
        [601, 602],
        ['x', 'y'],
        [10, 11],
      ]);
      expect(frame.length).toEqual(2);
      expect(frame.fields.map((f) => ({ name: f.name, value: f.values.buffer }))).toMatchInlineSnapshot(`
        [
          {
            "name": "time",
            "value": [
              601,
              602,
            ],
          },
          {
            "name": "name",
            "value": [
              "x",
              "y",
            ],
          },
          {
            "name": "value",
            "value": [
              10,
              11,
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

    const copy = { ...stream } as unknown as DataFrame;
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
      [
        {
          "labels": undefined,
          "name": "time",
          "values": [
            100,
            200,
            300,
            400,
          ],
        },
        {
          "labels": {
            "sensor": "A",
          },
          "name": "speed",
          "values": [
            10,
            undefined,
            30,
            undefined,
          ],
        },
        {
          "labels": {
            "sensor": "A",
          },
          "name": "light",
          "values": [
            1,
            undefined,
            5,
            undefined,
          ],
        },
        {
          "labels": {
            "sensor": "B",
          },
          "name": "speed",
          "values": [
            15,
            20,
            undefined,
            undefined,
          ],
        },
        {
          "labels": {
            "sensor": "B",
          },
          "name": "light",
          "values": [
            2,
            3,
            undefined,
            undefined,
          ],
        },
        {
          "labels": {
            "sensor": "C",
          },
          "name": "speed",
          "values": [
            undefined,
            25,
            undefined,
            40,
          ],
        },
        {
          "labels": {
            "sensor": "C",
          },
          "name": "light",
          "values": [
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
      [
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
      {
        "info": {
          "action": "replace",
          "length": 3,
          "number": 1,
          "schemaChanged": true,
        },
        "values": [
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
      {
        "info": {
          "action": "append",
          "length": 2,
          "number": 2,
          "schemaChanged": false,
        },
        "values": [
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
      {
        "info": {
          "action": "append",
          "length": 1,
          "number": 3,
          "schemaChanged": false,
        },
        "values": [
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
      [
        [
          "sensor=A",
          "sensor=C",
        ],
        [
          [
            [
              300,
            ],
            [
              30,
            ],
          ],
          [
            [
              400,
            ],
            [
              40,
            ],
          ],
        ],
      ]
    `);

    let cJoined = join(cTables[1]);

    expect(cJoined).toMatchInlineSnapshot(`
      [
        [
          300,
          400,
        ],
        [
          30,
          undefined,
        ],
        [
          undefined,
          40,
        ],
      ]
    `);
  });
*/
});
