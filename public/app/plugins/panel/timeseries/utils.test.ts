import { createTheme, FieldType, createDataFrame, toDataFrame } from '@grafana/data';
import { TooltipDisplayMode } from '@grafana/schema';
import { LineInterpolation } from '@grafana/ui';

import { type AdHocFilterItem } from '../../../../../packages/grafana-ui/src/components/Table/TableNG/types';

import {
  getGroupedFilters,
  getTimezones,
  isTooltipScrollable,
  prepareGraphableFields,
  setClassicPaletteIdxs,
} from './utils';

describe('prepare timeseries graph', () => {
  it('errors with no time fields', () => {
    const input = [
      toDataFrame({
        fields: [
          { name: 'a', values: [1, 2, 3] },
          { name: 'b', values: ['a', 'b', 'c'] },
        ],
      }),
    ];
    const frames = prepareGraphableFields(input, createTheme());
    expect(frames).toBeNull();
  });

  it('does not needlessly copy clean arrays', () => {
    const values = [1, 2];

    const df = createDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, 2000] },
        { name: 'a', values },
      ],
    });
    const frames = prepareGraphableFields([df], createTheme());

    const field = frames![0].fields.find((f) => f.name === 'a');
    expect(field!.values).toBe(values);
  });

  it('requires a number or boolean value', () => {
    const input = [
      toDataFrame({
        fields: [
          { name: 'a', type: FieldType.time, values: [1, 2, 3] },
          { name: 'b', values: ['a', 'b', 'c'] },
        ],
      }),
    ];
    const frames = prepareGraphableFields(input, createTheme());
    expect(frames).toBeNull();
  });

  it('sets classic palette index on graphable fields', () => {
    const input = [
      toDataFrame({
        fields: [
          { name: 'a', type: FieldType.time, values: [1, 2, 3] },
          { name: 'b', type: FieldType.string, values: ['a', 'b', 'c'] },
          { name: 'c', type: FieldType.number, values: [1, 2, 3] },
          { name: 'd', type: FieldType.string, values: ['d', 'e', 'f'] },
          { name: 'e', type: FieldType.boolean, values: [true, false, true] },
        ],
      }),
    ];
    const frames = prepareGraphableFields(input, createTheme());
    expect(frames![0].fields.map((f) => f.state?.seriesIndex)).toEqual([undefined, undefined, 0, undefined, 1]);
  });

  it('will graph numbers and boolean values', () => {
    const input = [
      toDataFrame({
        fields: [
          { name: 'a', type: FieldType.time, values: [1, 2, 3] },
          { name: 'b', values: ['a', 'b', 'c'] },
          { name: 'c', values: [true, false, true] },
          { name: 'd', values: [100, 200, 300] },
        ],
      }),
    ];
    const frames = prepareGraphableFields(input, createTheme());
    const out = frames![0];

    expect(out.fields.map((f) => f.name)).toEqual(['a', 'b', 'c', 'd']);

    const field = out.fields.find((f) => f.name === 'c');
    expect(field?.display).toBeDefined();
    expect(field!.display!(1)).toMatchInlineSnapshot(`
      {
        "color": "#808080",
        "numeric": 1,
        "percent": 1,
        "prefix": undefined,
        "suffix": undefined,
        "text": "True",
      }
    `);
  });

  it('will convert NaN and Infinty to nulls', () => {
    const df = createDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [995, 9996, 9997, 9998, 9999] },
        { name: 'a', values: [-10, NaN, 10, -Infinity, +Infinity, null] },
      ],
    });
    const frames = prepareGraphableFields([df], createTheme());

    const field = frames![0].fields.find((f) => f.name === 'a');
    expect(field!.values).toMatchInlineSnapshot(`
      [
        -10,
        null,
        10,
        null,
        null,
        null,
      ]
    `);
  });

  it('will insert nulls given an interval value', () => {
    const df = createDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, config: { interval: 1 }, values: [1, 3, 6] },
        { name: 'a', values: [1, 2, 3] },
      ],
    });
    const frames = prepareGraphableFields([df], createTheme());

    const field = frames![0].fields.find((f) => f.name === 'a');
    expect(field!.values).toMatchInlineSnapshot(`
      [
        1,
        null,
        2,
        null,
        null,
        3,
      ]
    `);

    expect(frames![0].length).toEqual(6);
  });

  it('will insert and convert nulls to a configure "no value" value', () => {
    const df = createDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, config: { interval: 1 }, values: [1, 3, 6] },
        { name: 'a', config: { noValue: '20' }, values: [1, 2, 3] },
      ],
    });
    const frames = prepareGraphableFields([df], createTheme());

    const field = frames![0].fields.find((f) => f.name === 'a');
    expect(field!.values).toMatchInlineSnapshot(`
      [
        1,
        20,
        2,
        20,
        20,
        3,
      ]
    `);
    expect(frames![0].length).toEqual(6);
  });

  it('converts string time values to numeric', () => {
    const df = createDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: ['2020-01-01T00:00:00Z', '2020-01-02T00:00:00Z'] },
        { name: 'value', type: FieldType.number, values: [10, 20] },
      ],
    });

    const frames = prepareGraphableFields([df], createTheme());
    expect(frames).not.toBeNull();
    expect(typeof frames![0].fields[0].values[0]).toBe('number');
  });

  describe('boolean fields', () => {
    it('will set line interpolation to an appropriate mode for boolean fields', () => {
      const df = createDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          { name: 'a', type: FieldType.boolean, values: [true, false, true] },
        ],
      });

      const frames = prepareGraphableFields([df], createTheme());
      const field = frames![0].fields.find((f) => f.name === 'a');
      expect(field?.config.custom.lineInterpolation).toEqual(LineInterpolation.StepAfter);
      expect(df.fields[1].config?.custom).toBeUndefined();
    });

    // #112194 - mutating this value directly can cause a memory leak
    it('does not mutate the underlying lineInterpolation value', () => {
      const df = createDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          {
            name: 'a',
            type: FieldType.boolean,
            values: [true, false, true],
            config: { custom: { lineInterpolation: LineInterpolation.Smooth } },
          },
        ],
      });

      const frames = prepareGraphableFields([df], createTheme());
      expect(df.fields[1].config.custom.lineInterpolation).toEqual(LineInterpolation.Smooth);
      expect(frames![0].fields[1].config.custom.lineInterpolation).toEqual(LineInterpolation.StepAfter);
    });

    it('preserves StepBefore interpolation', () => {
      const df = createDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          {
            name: 'flag',
            type: FieldType.boolean,
            values: [true, false, true],
            config: { custom: { lineInterpolation: LineInterpolation.StepBefore } },
          },
        ],
      });

      const frames = prepareGraphableFields([df], createTheme());
      expect(frames![0].fields[1].config.custom.lineInterpolation).toBe(LineInterpolation.StepBefore);
    });

    it('converts null values correctly', () => {
      const df = createDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          { name: 'flag', type: FieldType.boolean, values: [true, null, false] },
        ],
      });

      const frames = prepareGraphableFields([df], createTheme());
      expect(frames![0].fields[1].values).toEqual([1, null, 0]);
    });
  });

  describe('enum fields', () => {
    it('handles a single enum field', () => {
      const df = createDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          {
            name: 'status',
            type: FieldType.enum,
            values: [0, 1, 0],
            config: { type: { enum: { text: ['ok', 'error'] } } },
          },
        ],
      });

      const frames = prepareGraphableFields([df], createTheme());
      expect(frames).not.toBeNull();
      expect(frames![0].fields[1].type).toBe(FieldType.enum);
    });

    it('re-enumerates multiple enum fields across frames', () => {
      const df1 = createDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2] },
          {
            name: 'e1',
            type: FieldType.enum,
            values: [0, 1],
            config: { type: { enum: { text: ['a', 'b'] } } },
          },
        ],
      });
      const df2 = createDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [3, 4] },
          {
            name: 'e2',
            type: FieldType.enum,
            values: [0, 1],
            config: { type: { enum: { text: ['c', 'd'] } } },
          },
        ],
      });

      const frames = prepareGraphableFields([df1, df2], createTheme());
      expect(frames).not.toBeNull();
      // Second enum field values should be offset by the length of the first enum's text
      expect(frames![1].fields[1].values).toEqual([2, 3]);
    });
  });

  describe('getGroupedFilters', () => {
    it('returns empty array if no field', () => {
      const df = createDataFrame({
        fields: [{ name: 'time', type: FieldType.time, values: [1, 2, 3] }],
      });

      expect(getGroupedFilters(df, 1, jest.fn())).toEqual([]);
    });

    it('returns empty array if no labels', () => {
      const df = createDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          {
            name: 'value',
            type: FieldType.number,
            values: [1, 2, 3],
          },
        ],
      });

      expect(getGroupedFilters(df, 1, jest.fn())).toEqual([]);
    });

    it('returns empty array if field not filterable', () => {
      const df = createDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          {
            name: 'value',
            type: FieldType.number,
            values: [1, 2, 3],
            labels: {
              test: 'value',
              label: 'value2',
            },
          },
        ],
      });

      expect(getGroupedFilters(df, 1, jest.fn())).toEqual([]);
    });

    it('returns grouped filters', () => {
      const df = createDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          {
            name: 'value',
            type: FieldType.number,
            values: [1, 2, 3],
            labels: {
              test: 'value',
              label: 'value2',
            },
            config: {
              filterable: true,
            },
          },
        ],
      });

      const filtersGroupingFn = (filters: AdHocFilterItem[]) => filters;

      expect(getGroupedFilters(df, 1, filtersGroupingFn)).toEqual([
        {
          key: 'test',
          operator: '=',
          value: 'value',
        },
        {
          key: 'label',
          operator: '=',
          value: 'value2',
        },
      ]);
    });
  });
});

describe('getTimezones', () => {
  it('returns defaultTimezone when timezones is undefined', () => {
    expect(getTimezones(undefined, 'browser')).toEqual(['browser']);
  });

  it('returns defaultTimezone when timezones is empty', () => {
    expect(getTimezones([], 'browser')).toEqual(['browser']);
  });

  it('replaces empty strings with the default timezone', () => {
    expect(getTimezones(['', 'UTC', ''], 'browser')).toEqual(['browser', 'UTC', 'browser']);
  });

  it('returns all provided timezones unchanged when non-empty', () => {
    expect(getTimezones(['UTC', 'America/New_York'], 'browser')).toEqual(['UTC', 'America/New_York']);
  });
});

describe('isTooltipScrollable', () => {
  it('returns false when mode is Single', () => {
    expect(isTooltipScrollable({ mode: TooltipDisplayMode.Single, maxHeight: 200 })).toBe(false);
  });

  it('returns false when mode is Multi but maxHeight is undefined', () => {
    expect(isTooltipScrollable({ mode: TooltipDisplayMode.Multi })).toBe(false);
  });

  it('returns true when mode is Multi and maxHeight is set', () => {
    expect(isTooltipScrollable({ mode: TooltipDisplayMode.Multi, maxHeight: 200 })).toBe(true);
  });
});

describe('setClassicPaletteIdxs', () => {
  it('assigns sequential seriesIndex to number and boolean fields', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          { name: 'a', type: FieldType.number, values: [1, 2, 3] },
          { name: 'b', type: FieldType.boolean, values: [true, false, true] },
        ],
      }),
    ];
    setClassicPaletteIdxs(frames, createTheme(), 0);
    expect(frames[0].fields[1].state?.seriesIndex).toBe(0);
    expect(frames[0].fields[2].state?.seriesIndex).toBe(1);
  });

  it('skips the field at skipFieldIdx', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          { name: 'a', type: FieldType.number, values: [1, 2, 3] },
          { name: 'b', type: FieldType.number, values: [4, 5, 6] },
        ],
      }),
    ];
    // Skip field index 1 ('a')
    setClassicPaletteIdxs(frames, createTheme(), 1);
    expect(frames[0].fields[1].state?.seriesIndex).toBeUndefined();
    expect(frames[0].fields[2].state?.seriesIndex).toBe(0);
  });

  it('matches compare frame series indices to the corresponding main frame', () => {
    const mainFrame = toDataFrame({
      refId: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2] },
        { name: 'value', type: FieldType.number, values: [10, 20] },
      ],
    });
    const compareFrame = toDataFrame({
      refId: 'A-compare',
      meta: { timeCompare: { isTimeShiftQuery: true, timeShift: '1d' } },
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2] },
        { name: 'value', type: FieldType.number, values: [5, 15] },
      ],
    });

    setClassicPaletteIdxs([mainFrame, compareFrame], createTheme(), 0);

    // Main frame gets index 0
    expect(mainFrame.fields[1].state?.seriesIndex).toBe(0);
    // Compare frame should match the main frame's series index
    expect(compareFrame.fields[1].state?.seriesIndex).toBe(0);
  });

  it('assigns sequential indices across multiple frames', () => {
    const frame1 = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2] },
        { name: 'a', type: FieldType.number, values: [1, 2] },
      ],
    });
    const frame2 = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2] },
        { name: 'b', type: FieldType.number, values: [3, 4] },
      ],
    });
    setClassicPaletteIdxs([frame1, frame2], createTheme(), 0);
    expect(frame1.fields[1].state?.seriesIndex).toBe(0);
    expect(frame2.fields[1].state?.seriesIndex).toBe(1);
  });

  it('falls back to sequential indices for compare frame without matching main', () => {
    const compareFrame = toDataFrame({
      refId: 'B-compare',
      meta: { timeCompare: { isTimeShiftQuery: true, timeShift: '1d' } },
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2] },
        { name: 'value', type: FieldType.number, values: [5, 15] },
      ],
    });

    setClassicPaletteIdxs([compareFrame], createTheme(), 0);
    expect(compareFrame.fields[1].state?.seriesIndex).toBe(0);
  });

  it('falls back to sequential indices when compare frame has mismatched field count', () => {
    const mainFrame = toDataFrame({
      refId: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2] },
        { name: 'val1', type: FieldType.number, values: [10, 20] },
        { name: 'val2', type: FieldType.number, values: [30, 40] },
      ],
    });
    const compareFrame = toDataFrame({
      refId: 'A-compare',
      meta: { timeCompare: { isTimeShiftQuery: true, timeShift: '1d' } },
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2] },
        { name: 'val1', type: FieldType.number, values: [5, 15] },
      ],
    });

    setClassicPaletteIdxs([mainFrame, compareFrame], createTheme(), 0);
    expect(mainFrame.fields[1].state?.seriesIndex).toBe(0);
    expect(mainFrame.fields[2].state?.seriesIndex).toBe(1);
    expect(compareFrame.fields[1].state?.seriesIndex).toBe(2);
  });

  it('falls back to sequential indices for compare frame without refId', () => {
    const compareFrame = toDataFrame({
      meta: { timeCompare: { isTimeShiftQuery: true, timeShift: '1d' } },
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2] },
        { name: 'val', type: FieldType.number, values: [5, 15] },
      ],
    });
    compareFrame.refId = undefined;

    setClassicPaletteIdxs([compareFrame], createTheme(), 0);
    expect(compareFrame.fields[1].state?.seriesIndex).toBe(0);
  });

  it('matches multiple compare frames to their respective main frames by index', () => {
    const main1 = toDataFrame({
      refId: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2] },
        { name: 'v1', type: FieldType.number, values: [10, 20] },
      ],
    });
    const main2 = toDataFrame({
      refId: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2] },
        { name: 'v2', type: FieldType.number, values: [30, 40] },
      ],
    });
    const compare1 = toDataFrame({
      refId: 'A-compare',
      meta: { timeCompare: { isTimeShiftQuery: true, timeShift: '1d' } },
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2] },
        { name: 'v1', type: FieldType.number, values: [5, 15] },
      ],
    });
    const compare2 = toDataFrame({
      refId: 'A-compare',
      meta: { timeCompare: { isTimeShiftQuery: true, timeShift: '1d' } },
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2] },
        { name: 'v2', type: FieldType.number, values: [25, 35] },
      ],
    });

    setClassicPaletteIdxs([main1, main2, compare1, compare2], createTheme(), 0);
    expect(main1.fields[1].state?.seriesIndex).toBe(0);
    expect(main2.fields[1].state?.seriesIndex).toBe(1);
    expect(compare1.fields[1].state?.seriesIndex).toBe(0);
    expect(compare2.fields[1].state?.seriesIndex).toBe(1);
  });

  it('does not assign seriesIndex to string or time fields', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2] },
          { name: 'label', type: FieldType.string, values: ['a', 'b'] },
          { name: 'value', type: FieldType.number, values: [10, 20] },
        ],
      }),
    ];
    setClassicPaletteIdxs(frames, createTheme(), 0);
    expect(frames[0].fields[0].state?.seriesIndex).toBeUndefined();
    expect(frames[0].fields[1].state?.seriesIndex).toBeUndefined();
    expect(frames[0].fields[2].state?.seriesIndex).toBe(0);
  });
});

describe('prepareGraphableFields with xNumFieldIdx', () => {
  it('uses numeric x axis when xNumFieldIdx is provided', () => {
    const df = createDataFrame({
      fields: [
        { name: 'x', type: FieldType.number, values: [1, 2, 3] },
        { name: 'y', type: FieldType.number, values: [10, 20, 30] },
      ],
    });
    const frames = prepareGraphableFields([df], createTheme(), undefined, 0);
    expect(frames).not.toBeNull();
    expect(frames![0].fields[0].name).toBe('x');
  });

  it('reorders fields so the numeric x field is first', () => {
    const df = createDataFrame({
      fields: [
        { name: 'a', type: FieldType.number, values: [1, 2, 3] },
        { name: 'x', type: FieldType.number, values: [10, 20, 30] },
        { name: 'b', type: FieldType.number, values: [4, 5, 6] },
      ],
    });

    const frames = prepareGraphableFields([df], createTheme(), undefined, 1);
    expect(frames).not.toBeNull();
    expect(frames![0].fields[0].name).toBe('x');
  });
});
