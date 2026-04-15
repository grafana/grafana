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
