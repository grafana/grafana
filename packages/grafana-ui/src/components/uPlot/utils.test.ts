import { FieldMatcherID, fieldMatchers, FieldType, MutableDataFrame } from '@grafana/data';
import { BarAlignment, GraphDrawStyle, GraphTransform, LineInterpolation, StackingMode } from '@grafana/schema';

import { preparePlotFrame } from '../GraphNG/utils';

import { getStackingGroups, preparePlotData2, timeFormatToTemplate } from './utils';

describe('timeFormatToTemplate', () => {
  it.each`
    format           | expected
    ${'HH:mm:ss'}    | ${'{HH}:{mm}:{ss}'}
    ${'HH:mm'}       | ${'{HH}:{mm}'}
    ${'MM/DD HH:mm'} | ${'{MM}/{DD} {HH}:{mm}'}
    ${'MM/DD'}       | ${'{MM}/{DD}'}
    ${'YYYY-MM'}     | ${'{YYYY}-{MM}'}
    ${'YYYY'}        | ${'{YYYY}'}
  `('should convert $format to $expected', ({ format, expected }) => {
    expect(timeFormatToTemplate(format)).toEqual(expected);
  });
});

describe('preparePlotData2', () => {
  const df = new MutableDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [9997, 9998, 9999] },
      { name: 'a', values: [-10, -20, 10] },
      { name: 'b', values: [10, 10, 10] },
      { name: 'c', values: [20, 20, 20] },
    ],
  });

  it('creates array from DataFrame', () => {
    expect(preparePlotData2(df, getStackingGroups(df))).toMatchInlineSnapshot(`
      [
        [
          9997,
          9998,
          9999,
        ],
        [
          -10,
          -20,
          10,
        ],
        [
          10,
          10,
          10,
        ],
        [
          20,
          20,
          20,
        ],
      ]
    `);
  });

  describe('transforms', () => {
    it('negative-y transform', () => {
      const df = new MutableDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [9997, 9998, 9999] },
          { name: 'a', values: [-10, -20, 10] },
          { name: 'b', values: [10, 10, 10] },
          { name: 'c', values: [20, 20, 20], config: { custom: { transform: GraphTransform.NegativeY } } },
        ],
      });
      expect(preparePlotData2(df, getStackingGroups(df))).toMatchInlineSnapshot(`
        [
          [
            9997,
            9998,
            9999,
          ],
          [
            -10,
            -20,
            10,
          ],
          [
            10,
            10,
            10,
          ],
          [
            -20,
            -20,
            -20,
          ],
        ]
      `);
    });

    it('negative-y transform with null/undefined values', () => {
      const df = new MutableDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [9997, 9998, 9999] },
          { name: 'a', values: [-10, -20, 10, -30] },
          { name: 'b', values: [10, 10, 10, null] },
          { name: 'c', values: [null, 20, 20, 20], config: { custom: { transform: GraphTransform.NegativeY } } },
          { name: 'd', values: [20, 20, 20, null], config: { custom: { transform: GraphTransform.NegativeY } } },
          { name: 'e', values: [20, null, 20, 20], config: { custom: { transform: GraphTransform.NegativeY } } },
          { name: 'f', values: [10, 10, 10, undefined] },
          { name: 'g', values: [undefined, 20, 20, 20], config: { custom: { transform: GraphTransform.NegativeY } } },
          { name: 'h', values: [20, 20, 20, undefined], config: { custom: { transform: GraphTransform.NegativeY } } },
          { name: 'i', values: [20, undefined, 20, 20], config: { custom: { transform: GraphTransform.NegativeY } } },
        ],
      });
      expect(preparePlotData2(df, getStackingGroups(df))).toMatchInlineSnapshot(`
        [
          [
            9997,
            9998,
            9999,
            undefined,
          ],
          [
            -10,
            -20,
            10,
            -30,
          ],
          [
            10,
            10,
            10,
            null,
          ],
          [
            null,
            -20,
            -20,
            -20,
          ],
          [
            -20,
            -20,
            -20,
            null,
          ],
          [
            -20,
            null,
            -20,
            -20,
          ],
          [
            10,
            10,
            10,
            undefined,
          ],
          [
            undefined,
            -20,
            -20,
            -20,
          ],
          [
            -20,
            -20,
            -20,
            undefined,
          ],
          [
            -20,
            undefined,
            -20,
            -20,
          ],
        ]
      `);
    });
    it('constant transform', () => {
      const df = new MutableDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [9997, 9998, 9999] },
          { name: 'a', values: [-10, -20, 10], config: { custom: { transform: GraphTransform.Constant } } },
          { name: 'b', values: [10, 10, 10] },
          { name: 'c', values: [20, 20, 20] },
        ],
      });
      expect(preparePlotData2(df, getStackingGroups(df))).toMatchInlineSnapshot(`
        [
          [
            9997,
            9998,
            9999,
          ],
          [
            -10,
            undefined,
            undefined,
          ],
          [
            10,
            10,
            10,
          ],
          [
            20,
            20,
            20,
          ],
        ]
      `);
    });
  });
  describe('stacking', () => {
    it('none', () => {
      const df = new MutableDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [9997, 9998, 9999] },
          {
            name: 'a',
            values: [-10, -20, 10],
            config: { custom: { stacking: { mode: StackingMode.None } } },
          },
          {
            name: 'b',
            values: [10, 10, 10],
            config: { custom: { stacking: { mode: StackingMode.None } } },
          },
          {
            name: 'c',
            values: [20, 20, 20],
            config: { custom: { stacking: { mode: StackingMode.None } } },
          },
        ],
      });
      expect(preparePlotData2(df, getStackingGroups(df))).toMatchInlineSnapshot(`
        [
          [
            9997,
            9998,
            9999,
          ],
          [
            -10,
            -20,
            10,
          ],
          [
            10,
            10,
            10,
          ],
          [
            20,
            20,
            20,
          ],
        ]
      `);
    });

    it('standard', () => {
      const df = new MutableDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [9997, 9998, 9999] },
          {
            name: 'a',
            values: [-10, -20, 10],
            config: { custom: { stacking: { mode: StackingMode.Normal, group: 'stackA' } } },
          },
          {
            name: 'b',
            values: [10, 10, 10],
            config: { custom: { stacking: { mode: StackingMode.Normal, group: 'stackA' } } },
          },
          {
            name: 'c',
            values: [20, 20, 20],
            config: { custom: { stacking: { mode: StackingMode.Normal, group: 'stackA' } } },
          },
        ],
      });
      expect(preparePlotData2(df, getStackingGroups(df))).toMatchInlineSnapshot(`
        [
          [
            9997,
            9998,
            9999,
          ],
          [
            -10,
            -20,
            10,
          ],
          [
            10,
            10,
            10,
          ],
          [
            30,
            30,
            30,
          ],
        ]
      `);
    });

    it('standard with negative y transform', () => {
      const df = new MutableDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [9997, 9998, 9999] },
          {
            name: 'a',
            values: [-10, -20, 10],
            config: { custom: { stacking: { mode: StackingMode.Normal, group: 'stackA' } } },
          },
          {
            name: 'b',
            values: [10, 10, 10],
            config: { custom: { stacking: { mode: StackingMode.Normal, group: 'stackA' } } },
          },
          {
            name: 'c',
            values: [20, 20, 20],
            config: {
              custom: { stacking: { mode: StackingMode.Normal, group: 'stackA' }, transform: GraphTransform.NegativeY },
            },
          },
          {
            name: 'd',
            values: [10, 10, 10],
            config: {
              custom: { stacking: { mode: StackingMode.Normal, group: 'stackA' }, transform: GraphTransform.NegativeY },
            },
          },
        ],
      });
      expect(preparePlotData2(df, getStackingGroups(df))).toMatchInlineSnapshot(`
        [
          [
            9997,
            9998,
            9999,
          ],
          [
            -10,
            -20,
            10,
          ],
          [
            10,
            10,
            10,
          ],
          [
            -30,
            -40,
            -10,
          ],
          [
            -40,
            -50,
            -20,
          ],
        ]
      `);
    });

    it('standard with multiple groups', () => {
      const df = new MutableDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [9997, 9998, 9999] },
          {
            name: 'a',
            values: [-10, -20, 10],
            config: { custom: { stacking: { mode: StackingMode.Normal, group: 'stackA' } } },
          },
          {
            name: 'b',
            values: [10, 10, 10],
            config: { custom: { stacking: { mode: StackingMode.Normal, group: 'stackA' } } },
          },
          {
            name: 'c',
            values: [20, 20, 20],
            config: { custom: { stacking: { mode: StackingMode.Normal, group: 'stackA' } } },
          },
          {
            name: 'd',
            values: [1, 2, 3],
            config: { custom: { stacking: { mode: StackingMode.Normal, group: 'stackB' } } },
          },
          {
            name: 'e',
            values: [1, 2, 3],
            config: { custom: { stacking: { mode: StackingMode.Normal, group: 'stackB' } } },
          },
          {
            name: 'f',
            values: [1, 2, 3],
            config: { custom: { stacking: { mode: StackingMode.Normal, group: 'stackB' } } },
          },
        ],
      });

      expect(preparePlotData2(df, getStackingGroups(df))).toMatchInlineSnapshot(`
        [
          [
            9997,
            9998,
            9999,
          ],
          [
            -10,
            -20,
            10,
          ],
          [
            10,
            10,
            10,
          ],
          [
            30,
            30,
            30,
          ],
          [
            1,
            2,
            3,
          ],
          [
            2,
            4,
            6,
          ],
          [
            3,
            6,
            9,
          ],
        ]
      `);
    });

    it('standard with multiple groups and hidden fields', () => {
      const df = new MutableDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [9997, 9998, 9999] },
          {
            name: 'a',
            values: [-10, -20, 10],
            config: { custom: { stacking: { mode: StackingMode.Normal, group: 'stackA' }, hideFrom: { viz: true } } },
          },
          {
            // Will ignore a series as stacking base as it's hidden from viz
            name: 'b',
            values: [10, 10, 10],
            config: { custom: { stacking: { mode: StackingMode.Normal, group: 'stackA' } } },
          },
          {
            name: 'd',
            values: [1, 2, 3],
            config: { custom: { stacking: { mode: StackingMode.Normal, group: 'stackB' } } },
          },
          {
            name: 'e',
            values: [1, 2, 3],
            config: { custom: { stacking: { mode: StackingMode.Normal, group: 'stackB' }, hideFrom: { viz: true } } },
          },
          {
            // Will ignore e series as stacking base as it's hidden from viz
            name: 'f',
            values: [1, 2, 3],
            config: { custom: { stacking: { mode: StackingMode.Normal, group: 'stackB' } } },
          },
        ],
      });

      expect(preparePlotData2(df, getStackingGroups(df))).toMatchInlineSnapshot(`
        [
          [
            9997,
            9998,
            9999,
          ],
          [
            -10,
            -20,
            10,
          ],
          [
            10,
            10,
            10,
          ],
          [
            1,
            2,
            3,
          ],
          [
            1,
            2,
            3,
          ],
          [
            2,
            4,
            6,
          ],
        ]
      `);
    });
  });

  it('accumulates stacks only at indices where stacking group has at least 1 value', () => {
    // extracted data from plot in panel-graph/graph-ng-stacking2.json
    const frameData = [
      [[1639976945832], [1000]],
      [
        [1639803285888, 1639976945832, 1640150605776, 1641192565440],
        [2500, 600, 350, 500],
      ],
      [
        [1639803285888, 1639976945832, 1640150605776, 1640324265720],
        [28000, 3100, 36000, 2800],
      ],
      [
        [1639976945832, 1640324265720, 1640497925664],
        [255, 651, 50],
      ],
      [
        [1639803285888, 1639976945832],
        [5000, 1231],
      ],
      [
        [
          1639455966000, 1639629625944, 1639803285888, 1639976945832, 1640150605776, 1640324265720, 1640497925664,
          1640671585608, 1640845245552, 1641018905496,
        ],
        [122, 123, 12345, 23456, 34567, 12345, 8000, 3000, 1000, 21],
      ],
      [[1641539885328], [20]],
      [
        [1641192565440, 1641539885328],
        [210, 321],
      ],
      [
        [1640671585608, 1641539885328],
        [210, 210],
      ],
      [
        [1639803285888, 1639976945832, 1640150605776, 1640497925664, 1640845245552],
        [250, 852, 1234, 321, 432],
      ],
      [
        [
          1640324265720, 1640497925664, 1640671585608, 1640845245552, 1641018905496, 1641192565440, 1641366225384,
          1641539885328, 1641713545272, 1641887205216, 1642060865160, 1642234525104, 1642408185048,
        ],
        [543, 18000, 17000, 12000, 8500, 8000, 5000, 3000, 2500, 2200, 3000, 1520, 665.35],
      ],
      [[1641887205216], [800]],
      [
        [
          1640150605776, 1640324265720, 1640497925664, 1640671585608, 1640845245552, 1641018905496, 1641192565440,
          1641366225384, 1641539885328, 1641713545272, 1641887205216, 1642060865160, 1642234525104,
        ],
        [14173, 14805, 5600, 5950, 775, 725, 1450, 3175, 1850, 1025, 2700, 4825, 3600],
      ],
      [[1642234525104], [1675]],
      [[1640150605776], [433.16]],
      [
        [
          1640324265720, 1640497925664, 1640671585608, 1640845245552, 1641018905496, 1641192565440, 1641366225384,
          1641539885328, 1641713545272, 1641887205216, 1642060865160, 1642234525104, 1642408185048,
        ],
        [
          41250, 45150, 45870.16, 38728.17, 39931.77, 39831.8, 38252.06, 44332.92, 51359.74, 56155.84, 55676.92,
          55323.84, 13830.96,
        ],
      ],
      [
        [1640845245552, 1641018905496],
        [52.89, 569.57],
      ],
      [
        [
          1641018905496, 1641192565440, 1641366225384, 1641539885328, 1641713545272, 1641887205216, 1642060865160,
          1642234525104, 1642408185048,
        ],
        [2140.34, 4074.92, 1557.85, 1097.74, 692.06, 758.67, 957.56, 1470.49, 198.18],
      ],
    ];

    const names = 'abcdefghijklmnopqrstuvwxyz'.split('').reverse();

    const dfs = frameData.map(([xs, ys]) => {
      const df = new MutableDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: xs },
          {
            name: names.pop()!,
            values: ys,
            config: { custom: { stacking: { mode: StackingMode.Normal, group: 'A' } } },
          },
        ],
      });

      return df;
    });

    const df = preparePlotFrame(dfs, {
      x: fieldMatchers.get(FieldMatcherID.firstTimeField).get({}),
      y: fieldMatchers.get(FieldMatcherID.numeric).get({}),
    })!;

    expect(preparePlotData2(df, getStackingGroups(df))).toMatchInlineSnapshot(`
      [
        [
          1639455966000,
          1639629625944,
          1639803285888,
          1639976945832,
          1640150605776,
          1640324265720,
          1640497925664,
          1640671585608,
          1640845245552,
          1641018905496,
          1641192565440,
          1641366225384,
          1641539885328,
          1641713545272,
          1641887205216,
          1642060865160,
          1642234525104,
          1642408185048,
        ],
        [
          0,
          0,
          0,
          1000,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
        ],
        [
          0,
          0,
          2500,
          1600,
          350,
          0,
          0,
          0,
          0,
          0,
          500,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
        ],
        [
          0,
          0,
          30500,
          4700,
          36350,
          2800,
          0,
          0,
          0,
          0,
          500,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
        ],
        [
          0,
          0,
          30500,
          4955,
          36350,
          3451,
          50,
          0,
          0,
          0,
          500,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
        ],
        [
          0,
          0,
          35500,
          6186,
          36350,
          3451,
          50,
          0,
          0,
          0,
          500,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
        ],
        [
          122,
          123,
          47845,
          29642,
          70917,
          15796,
          8050,
          3000,
          1000,
          21,
          500,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
        ],
        [
          122,
          123,
          47845,
          29642,
          70917,
          15796,
          8050,
          3000,
          1000,
          21,
          500,
          0,
          20,
          0,
          0,
          0,
          0,
          0,
        ],
        [
          122,
          123,
          47845,
          29642,
          70917,
          15796,
          8050,
          3000,
          1000,
          21,
          710,
          0,
          341,
          0,
          0,
          0,
          0,
          0,
        ],
        [
          122,
          123,
          47845,
          29642,
          70917,
          15796,
          8050,
          3210,
          1000,
          21,
          710,
          0,
          551,
          0,
          0,
          0,
          0,
          0,
        ],
        [
          122,
          123,
          48095,
          30494,
          72151,
          15796,
          8371,
          3210,
          1432,
          21,
          710,
          0,
          551,
          0,
          0,
          0,
          0,
          0,
        ],
        [
          122,
          123,
          48095,
          30494,
          72151,
          16339,
          26371,
          20210,
          13432,
          8521,
          8710,
          5000,
          3551,
          2500,
          2200,
          3000,
          1520,
          665.35,
        ],
        [
          122,
          123,
          48095,
          30494,
          72151,
          16339,
          26371,
          20210,
          13432,
          8521,
          8710,
          5000,
          3551,
          2500,
          3000,
          3000,
          1520,
          665.35,
        ],
        [
          122,
          123,
          48095,
          30494,
          86324,
          31144,
          31971,
          26160,
          14207,
          9246,
          10160,
          8175,
          5401,
          3525,
          5700,
          7825,
          5120,
          665.35,
        ],
        [
          122,
          123,
          48095,
          30494,
          86324,
          31144,
          31971,
          26160,
          14207,
          9246,
          10160,
          8175,
          5401,
          3525,
          5700,
          7825,
          6795,
          665.35,
        ],
        [
          122,
          123,
          48095,
          30494,
          86757.16,
          31144,
          31971,
          26160,
          14207,
          9246,
          10160,
          8175,
          5401,
          3525,
          5700,
          7825,
          6795,
          665.35,
        ],
        [
          122,
          123,
          48095,
          30494,
          86757.16,
          72394,
          77121,
          72030.16,
          52935.17,
          49177.77,
          49991.8,
          46427.06,
          49733.92,
          54884.74,
          61855.84,
          63501.92,
          62118.84,
          14496.31,
        ],
        [
          122,
          123,
          48095,
          30494,
          86757.16,
          72394,
          77121,
          72030.16,
          52988.06,
          49747.34,
          49991.8,
          46427.06,
          49733.92,
          54884.74,
          61855.84,
          63501.92,
          62118.84,
          14496.31,
        ],
        [
          122,
          123,
          48095,
          30494,
          86757.16,
          72394,
          77121,
          72030.16,
          52988.06,
          51887.67999999999,
          54066.72,
          47984.909999999996,
          50831.659999999996,
          55576.799999999996,
          62614.509999999995,
          64459.479999999996,
          63589.329999999994,
          14694.49,
        ],
      ]
    `);
  });
});

describe('auto stacking groups', () => {
  test('split on stacking mode', () => {
    const df = new MutableDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [0, 1, 2] },
        {
          name: 'b',
          values: [1, 2, 3],
          config: { custom: { stacking: { mode: StackingMode.Percent } } },
        },
        {
          name: 'c',
          values: [4, 5, 6],
          config: { custom: { stacking: { mode: StackingMode.Normal } } },
        },
      ],
    });

    expect(getStackingGroups(df)).toMatchInlineSnapshot(`
      [
        {
          "dir": 1,
          "series": [
            1,
          ],
        },
        {
          "dir": 1,
          "series": [
            2,
          ],
        },
      ]
    `);
  });

  test('split pos/neg', () => {
    // since we expect most series to be Pos, we try to bail early when scanning all values
    // as soon as we find a value >= 0, it's assumed Pos, else Neg

    const df = new MutableDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [0, 1, 2] },
        {
          name: 'a',
          values: [-1, null, -3],
          config: { custom: { stacking: { mode: StackingMode.Normal } } },
        },
        {
          name: 'b',
          values: [1, 2, 3],
          config: { custom: { stacking: { mode: StackingMode.Normal } } },
        },
        {
          name: 'c',
          values: [0, 0, 0],
          config: { custom: { stacking: { mode: StackingMode.Normal } } },
        },
        {
          name: 'd',
          values: [null, -0, null],
          config: { custom: { stacking: { mode: StackingMode.Normal } } },
        },
      ],
    });

    expect(getStackingGroups(df)).toMatchInlineSnapshot(`
      [
        {
          "dir": -1,
          "series": [
            1,
            4,
          ],
        },
        {
          "dir": 1,
          "series": [
            2,
            3,
          ],
        },
      ]
    `);
  });

  test('split pos/neg with NegY', () => {
    const df = new MutableDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [0, 1, 2] },
        {
          name: 'a',
          values: [-1, null, -3],
          config: { custom: { stacking: { mode: StackingMode.Normal }, transform: GraphTransform.NegativeY } },
        },
        {
          name: 'b',
          values: [1, 2, 3],
          config: { custom: { stacking: { mode: StackingMode.Normal } } },
        },
        {
          name: 'c',
          values: [0, 0, 0],
          config: { custom: { stacking: { mode: StackingMode.Normal } } },
        },
        {
          name: 'd',
          values: [-0, null, -3],
          config: { custom: { stacking: { mode: StackingMode.Normal }, transform: GraphTransform.NegativeY } },
        },
      ],
    });

    expect(getStackingGroups(df)).toMatchInlineSnapshot(`
      [
        {
          "dir": 1,
          "series": [
            1,
            2,
            3,
            4,
          ],
        },
      ]
    `);
  });

  test('split on drawStyle, lineInterpolation, barAlignment', () => {
    const df = new MutableDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [0, 1, 2] },
        {
          name: 'a',
          values: [1, 2, 3],
          config: {
            custom: {
              drawStyle: GraphDrawStyle.Bars,
              barAlignment: BarAlignment.After,
              stacking: { mode: StackingMode.Normal },
            },
          },
        },
        {
          name: 'b',
          values: [1, 2, 3],
          config: {
            custom: {
              drawStyle: GraphDrawStyle.Bars,
              barAlignment: BarAlignment.Before,
              stacking: { mode: StackingMode.Normal },
            },
          },
        },
        {
          name: 'c',
          values: [1, 2, 3],
          config: {
            custom: {
              drawStyle: GraphDrawStyle.Line,
              lineInterpolation: LineInterpolation.Linear,
              stacking: { mode: StackingMode.Normal },
            },
          },
        },
        {
          name: 'd',
          values: [1, 2, 3],
          config: {
            custom: {
              drawStyle: GraphDrawStyle.Line,
              lineInterpolation: LineInterpolation.Smooth,
              stacking: { mode: StackingMode.Normal },
            },
          },
        },
        {
          name: 'e',
          values: [1, 2, 3],
          config: { custom: { drawStyle: GraphDrawStyle.Points, stacking: { mode: StackingMode.Normal } } },
        },
      ],
    });

    expect(getStackingGroups(df)).toMatchInlineSnapshot(`
      [
        {
          "dir": 1,
          "series": [
            1,
          ],
        },
        {
          "dir": 1,
          "series": [
            2,
          ],
        },
        {
          "dir": 1,
          "series": [
            3,
          ],
        },
        {
          "dir": 1,
          "series": [
            4,
          ],
        },
        {
          "dir": 1,
          "series": [
            5,
          ],
        },
      ]
    `);
  });

  test('split on axis & units (scaleKey)', () => {
    const df = new MutableDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [0, 1, 2] },
        {
          name: 'a',
          values: [1, 2, 3],
          config: { custom: { stacking: { mode: StackingMode.Normal } }, unit: 'ft' },
        },
        {
          name: 'b',
          values: [1, 2, 3],
          config: { custom: { stacking: { mode: StackingMode.Normal } }, unit: 'degrees' },
        },
      ],
    });

    expect(getStackingGroups(df)).toMatchInlineSnapshot(`
      [
        {
          "dir": 1,
          "series": [
            1,
          ],
        },
        {
          "dir": 1,
          "series": [
            2,
          ],
        },
      ]
    `);
  });

  test('split on explicit stacking group & mode & pos/neg w/NegY', () => {
    const df = new MutableDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [0, 1, 2] },
        {
          name: 'a',
          values: [1, 2, 3],
          config: { custom: { stacking: { mode: StackingMode.Normal, group: 'A' } } },
        },
        {
          name: 'b',
          values: [1, 2, 3],
          config: { custom: { stacking: { mode: StackingMode.Normal, group: 'A' } } },
        },
        {
          name: 'c',
          values: [1, 2, 3],
          config: { custom: { stacking: { mode: StackingMode.Percent, group: 'A' } } },
        },
        {
          name: 'd',
          values: [1, 2, 3],
          config: { custom: { stacking: { mode: StackingMode.Normal, group: 'B' } } },
        },
        {
          name: 'e',
          values: [1, 2, 3],
          config: { custom: { stacking: { mode: StackingMode.Percent, group: 'B' } } },
        },
        {
          name: 'e',
          values: [1, 2, 3],
          config: {
            custom: { stacking: { mode: StackingMode.Percent, group: 'B' }, transform: GraphTransform.NegativeY },
          },
        },
      ],
    });

    expect(getStackingGroups(df)).toMatchInlineSnapshot(`
      [
        {
          "dir": 1,
          "series": [
            1,
            2,
          ],
        },
        {
          "dir": 1,
          "series": [
            3,
          ],
        },
        {
          "dir": 1,
          "series": [
            4,
          ],
        },
        {
          "dir": 1,
          "series": [
            5,
          ],
        },
        {
          "dir": -1,
          "series": [
            6,
          ],
        },
      ]
    `);
  });
});
