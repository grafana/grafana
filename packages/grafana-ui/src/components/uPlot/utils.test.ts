import { preparePlotData, timeFormatToTemplate } from './utils';
import { FieldType, MutableDataFrame } from '@grafana/data';
import { StackingMode } from './config';

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

describe('preparePlotData', () => {
  const df = new MutableDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [9997, 9998, 9999] },
      { name: 'a', values: [-10, 20, 10] },
      { name: 'b', values: [10, 10, 10] },
      { name: 'c', values: [20, 20, 20] },
    ],
  });

  it('creates array from DataFrame', () => {
    expect(preparePlotData(df)).toMatchInlineSnapshot(`
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
      expect(preparePlotData(df)).toMatchInlineSnapshot(`
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
      expect(preparePlotData(df)).toMatchInlineSnapshot(`
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
            0,
            30,
            20,
          ],
          Array [
            20,
            50,
            40,
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

      expect(preparePlotData(df)).toMatchInlineSnapshot(`
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
            0,
            30,
            20,
          ],
          Array [
            20,
            50,
            40,
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

      expect(preparePlotData(df)).toMatchInlineSnapshot(`
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
