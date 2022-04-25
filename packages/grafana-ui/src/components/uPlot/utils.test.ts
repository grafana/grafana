import Units from 'ol/proj/Units';

import { FieldType, MutableDataFrame } from '@grafana/data';
import { BarAlignment, GraphDrawStyle, GraphTransform, LineInterpolation, StackingMode } from '@grafana/schema';

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
      { name: 'a', values: [-10, 20, 10] },
      { name: 'b', values: [10, 10, 10] },
      { name: 'c', values: [20, 20, 20] },
    ],
  });

  it('creates array from DataFrame', () => {
    expect(preparePlotData2(df, getStackingGroups(df))).toMatchInlineSnapshot(`
      Array [
        Array [
          9997,
          9998,
          9999,
        ],
        Array [
          -10,
          20,
          10,
        ],
        Array [
          10,
          10,
          10,
        ],
        Array [
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
          { name: 'a', values: [-10, 20, 10] },
          { name: 'b', values: [10, 10, 10] },
          { name: 'c', values: [20, 20, 20], config: { custom: { transform: GraphTransform.NegativeY } } },
        ],
      });
      expect(preparePlotData2(df, getStackingGroups(df))).toMatchInlineSnapshot(`
        Array [
          Array [
            9997,
            9998,
            9999,
          ],
          Array [
            -10,
            20,
            10,
          ],
          Array [
            10,
            10,
            10,
          ],
          Array [
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
          { name: 'a', values: [-10, 20, 10, 30] },
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
        Array [
          Array [
            9997,
            9998,
            9999,
            undefined,
          ],
          Array [
            -10,
            20,
            10,
            30,
          ],
          Array [
            10,
            10,
            10,
            null,
          ],
          Array [
            null,
            -20,
            -20,
            -20,
          ],
          Array [
            -20,
            -20,
            -20,
            null,
          ],
          Array [
            -20,
            null,
            -20,
            -20,
          ],
          Array [
            10,
            10,
            10,
            undefined,
          ],
          Array [
            undefined,
            -20,
            -20,
            -20,
          ],
          Array [
            -20,
            -20,
            -20,
            undefined,
          ],
          Array [
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
          { name: 'a', values: [-10, 20, 10], config: { custom: { transform: GraphTransform.Constant } } },
          { name: 'b', values: [10, 10, 10] },
          { name: 'c', values: [20, 20, 20] },
        ],
      });
      expect(preparePlotData2(df, getStackingGroups(df))).toMatchInlineSnapshot(`
        Array [
          Array [
            9997,
            9998,
            9999,
          ],
          Array [
            -10,
            -10,
            -10,
          ],
          Array [
            10,
            10,
            10,
          ],
          Array [
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
            values: [-10, 20, 10],
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
        Array [
          Array [
            9997,
            9998,
            9999,
          ],
          Array [
            -10,
            20,
            10,
          ],
          Array [
            10,
            10,
            10,
          ],
          Array [
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
            values: [-10, 20, 10],
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
        Array [
          Array [
            9997,
            9998,
            9999,
          ],
          Array [
            -10,
            20,
            10,
          ],
          Array [
            10,
            10,
            10,
          ],
          Array [
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
            values: [-10, 20, 10],
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
        Array [
          Array [
            9997,
            9998,
            9999,
          ],
          Array [
            -10,
            20,
            10,
          ],
          Array [
            10,
            10,
            10,
          ],
          Array [
            -30,
            0,
            -10,
          ],
          Array [
            -40,
            -10,
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
            values: [-10, 20, 10],
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
        Array [
          Array [
            9997,
            9998,
            9999,
          ],
          Array [
            -10,
            20,
            10,
          ],
          Array [
            10,
            10,
            10,
          ],
          Array [
            30,
            30,
            30,
          ],
          Array [
            1,
            2,
            3,
          ],
          Array [
            2,
            4,
            6,
          ],
          Array [
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
            values: [-10, 20, 10],
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
        Array [
          Array [
            9997,
            9998,
            9999,
          ],
          Array [
            -10,
            20,
            10,
          ],
          Array [
            10,
            10,
            10,
          ],
          Array [
            1,
            2,
            3,
          ],
          Array [
            1,
            2,
            3,
          ],
          Array [
            2,
            4,
            6,
          ],
        ]
      `);
    });
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
      Array [
        Object {
          "dir": 1,
          "series": Array [
            1,
          ],
        },
        Object {
          "dir": 1,
          "series": Array [
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
      ],
    });

    expect(getStackingGroups(df)).toMatchInlineSnapshot(`
      Array [
        Object {
          "dir": -1,
          "series": Array [
            1,
          ],
        },
        Object {
          "dir": 1,
          "series": Array [
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
      ],
    });

    expect(getStackingGroups(df)).toMatchInlineSnapshot(`
      Array [
        Object {
          "dir": 1,
          "series": Array [
            1,
            2,
            3,
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
      Array [
        Object {
          "dir": 1,
          "series": Array [
            1,
          ],
        },
        Object {
          "dir": 1,
          "series": Array [
            2,
          ],
        },
        Object {
          "dir": 1,
          "series": Array [
            3,
          ],
        },
        Object {
          "dir": 1,
          "series": Array [
            4,
          ],
        },
        Object {
          "dir": 1,
          "series": Array [
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
          config: { custom: { stacking: { mode: StackingMode.Normal } }, unit: Units.FEET },
        },
        {
          name: 'b',
          values: [1, 2, 3],
          config: { custom: { stacking: { mode: StackingMode.Normal } }, unit: Units.DEGREES },
        },
      ],
    });

    expect(getStackingGroups(df)).toMatchInlineSnapshot(`
      Array [
        Object {
          "dir": 1,
          "series": Array [
            1,
          ],
        },
        Object {
          "dir": 1,
          "series": Array [
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
      Array [
        Object {
          "dir": 1,
          "series": Array [
            1,
            2,
          ],
        },
        Object {
          "dir": 1,
          "series": Array [
            3,
          ],
        },
        Object {
          "dir": 1,
          "series": Array [
            4,
          ],
        },
        Object {
          "dir": 1,
          "series": Array [
            5,
          ],
        },
        Object {
          "dir": -1,
          "series": Array [
            6,
          ],
        },
      ]
    `);
  });
});
