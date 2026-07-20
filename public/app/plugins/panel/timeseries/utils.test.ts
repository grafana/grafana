import { createTheme, FieldType, createDataFrame, toDataFrame } from '@grafana/data';
import { LineInterpolation } from '@grafana/ui';

import { type AdHocFilterItem } from '../../../../../packages/grafana-ui/src/components/Table/TableNG/types';

import {
  getCompareSeriesIdentityKey,
  getGroupedFilters,
  getTimezones,
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

describe('getCompareSeriesIdentityKey', () => {
  it('prefers labels (with field name) when present', () => {
    const key = getCompareSeriesIdentityKey({
      name: 'Value',
      type: FieldType.number,
      config: {},
      values: [],
      labels: { pod: 'a' },
    });
    expect(key).toBe('Value{pod="a"}');
  });

  it('falls back to displayNameFromDS when there are no labels', () => {
    const key = getCompareSeriesIdentityKey({
      name: 'Value',
      type: FieldType.number,
      config: { displayNameFromDS: 'ServerA' },
      values: [],
    });
    expect(key).toBe('ServerA');
  });

  it('falls back to frame name + field name when no labels or displayNameFromDS', () => {
    const frame = toDataFrame({ name: 'B', fields: [{ name: 'Value', type: FieldType.number, values: [] }] });
    const key = getCompareSeriesIdentityKey({ name: 'Value', type: FieldType.number, config: {}, values: [] }, frame);
    expect(key).toBe('B:Value');
  });

  it('falls back to the field name when nothing else is available', () => {
    const key = getCompareSeriesIdentityKey({ name: 'Value', type: FieldType.number, config: {}, values: [] });
    expect(key).toBe('Value');
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

  it('matches compare fields by name when field counts differ across windows', () => {
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
    // val1 still pairs with the current-period val1 even though compare is missing val2
    expect(compareFrame.fields[1].state?.seriesIndex).toBe(0);
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

  it('matches multiple compare frames to their respective main frames by identity', () => {
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

/**
 * #126181 / #125103 — High-cardinality time comparison mismatch
 *
 * Symptoms when compare window label sets/order differ from the current window:
 * - Colors: compare series pick up the color of whichever current series sits at the same
 *   result-list index, so e.g. pod=b (comparison) can render in pod=a's color.
 * - Legend: names stay correct ("a (comparison)") but the series icon color is wrong,
 *   so legend pairing looks broken even though labels are right.
 * - Series pairing: dashed compare lines no longer visually track their solid counterparts.
 *
 * Root cause: setClassicPaletteIdxs previously matched compare frames to main frames by
 * position within a refId group. Fix: match by labels/name identity.
 *
 * Manual UI repro (Prometheus / similar):
 * 1. Enable panel time settings + time comparison (e.g. compare to 1 day ago).
 * 2. Query something like: sum by (pod) (rate(container_cpu_usage_seconds_total[5m]))
 *    on a workload where pods restart between windows (or force unstable series order).
 * 3. Before the fix: legend colors for "<pod> (comparison)" often disagree with "<pod>".
 * 4. After the fix: each compare series shares the classic-palette color of the same labels.
 */
describe('TimeComparison high cardinality (#126181)', () => {
  const compareMeta = { timeCompare: { isTimeShiftQuery: true, diffMs: -86400000 } };

  function makePodFrames(order: Array<'a' | 'b' | 'c'>, opts: { compare?: boolean; refId?: string } = {}) {
    const refId = opts.refId ?? (opts.compare ? 'A-compare' : 'A');
    return order.map((pod) =>
      toDataFrame({
        refId,
        meta: opts.compare ? compareMeta : undefined,
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2] },
          { name: 'Value', type: FieldType.number, values: [10, 20], labels: { pod } },
        ],
      })
    );
  }

  /**
   * Previous position-based pairing (pre-fix). Kept here so the mismatch stays reproducible
   * in CI even after the production code matches by identity.
   */
  function setClassicPaletteIdxsByPosition(frames: Array<ReturnType<typeof toDataFrame>>, skipFieldIdx?: number) {
    let seriesIndex = 0;
    const updateFieldDisplay = (field: (typeof frames)[0]['fields'][0], idx: number) => {
      field.state = { ...field.state, seriesIndex: idx };
    };
    const shouldProcessField = (field: (typeof frames)[0]['fields'][0], fieldIdx: number) =>
      fieldIdx !== skipFieldIdx && field.type === FieldType.number;

    const mainFramesByRefId = new Map<string, typeof frames>();
    for (const frame of frames) {
      if (!frame.meta?.timeCompare?.isTimeShiftQuery && frame.refId) {
        if (!mainFramesByRefId.has(frame.refId)) {
          mainFramesByRefId.set(frame.refId, []);
        }
        mainFramesByRefId.get(frame.refId)!.push(frame);
      }
    }

    const compareIndicesByRefId = new Map<string, number>();
    for (const frame of frames) {
      if (frame.meta?.timeCompare?.isTimeShiftQuery) {
        const baseRefId = frame.refId?.replace('-compare', '') ?? '';
        let compareIndex = compareIndicesByRefId.get(baseRefId) ?? 0;
        compareIndicesByRefId.set(baseRefId, compareIndex + 1);
        const mainFrame = mainFramesByRefId.get(baseRefId)?.[compareIndex];
        frame.fields.forEach((field, fieldIdx) => {
          if (!shouldProcessField(field, fieldIdx)) {
            return;
          }
          if (mainFrame && mainFrame.fields.length === frame.fields.length) {
            updateFieldDisplay(field, mainFrame.fields[fieldIdx].state?.seriesIndex ?? seriesIndex++);
          } else {
            updateFieldDisplay(field, seriesIndex++);
          }
        });
      } else {
        frame.fields.forEach((field, fieldIdx) => {
          if (shouldProcessField(field, fieldIdx)) {
            updateFieldDisplay(field, seriesIndex++);
          }
        });
      }
    }
  }

  it('repro: position pairing mis-colors when compare window returns series in a different order', () => {
    const [mainA, mainB] = makePodFrames(['a', 'b']);
    // Compare window returns b then a — common with Prometheus high-cardinality results.
    const [compareB, compareA] = makePodFrames(['b', 'a'], { compare: true });

    setClassicPaletteIdxsByPosition([mainA, mainB, compareB, compareA], 0);

    expect(mainA.fields[1].state?.seriesIndex).toBe(0);
    expect(mainB.fields[1].state?.seriesIndex).toBe(1);
    // Bug: compare frames take the Nth main frame's color, not the matching pod's.
    expect(compareB.fields[1].state?.seriesIndex).toBe(0); // should be 1 (pod b)
    expect(compareA.fields[1].state?.seriesIndex).toBe(1); // should be 0 (pod a)
  });

  it('fix: identity pairing keeps colors aligned when compare series are reordered', () => {
    const [mainA, mainB] = makePodFrames(['a', 'b']);
    const [compareB, compareA] = makePodFrames(['b', 'a'], { compare: true });

    setClassicPaletteIdxs([mainA, mainB, compareB, compareA], createTheme(), 0);

    expect(mainA.fields[1].state?.seriesIndex).toBe(0);
    expect(mainB.fields[1].state?.seriesIndex).toBe(1);
    expect(compareA.fields[1].state?.seriesIndex).toBe(0);
    expect(compareB.fields[1].state?.seriesIndex).toBe(1);
  });

  it('fix: identity pairing survives a missing series in the compare window', () => {
    const [mainA, mainB] = makePodFrames(['a', 'b']);
    const [compareB] = makePodFrames(['b'], { compare: true });

    setClassicPaletteIdxs([mainA, mainB, compareB], createTheme(), 0);

    expect(mainA.fields[1].state?.seriesIndex).toBe(0);
    expect(mainB.fields[1].state?.seriesIndex).toBe(1);
    expect(compareB.fields[1].state?.seriesIndex).toBe(1);
  });

  it('fix: compare-only series get their own palette index instead of stealing another color', () => {
    const [mainA] = makePodFrames(['a']);
    const [compareA, compareC] = makePodFrames(['a', 'c'], { compare: true });

    setClassicPaletteIdxs([mainA, compareA, compareC], createTheme(), 0);

    expect(mainA.fields[1].state?.seriesIndex).toBe(0);
    expect(compareA.fields[1].state?.seriesIndex).toBe(0);
    expect(compareC.fields[1].state?.seriesIndex).toBe(1);
  });

  it('prepareGraphableFields: matching labels share classic palette colors after compare reorder', () => {
    const theme = createTheme();
    const [mainA, mainB] = makePodFrames(['a', 'b']);
    const [compareB, compareA] = makePodFrames(['b', 'a'], { compare: true });

    for (const frame of [mainA, mainB, compareB, compareA]) {
      for (const field of frame.fields) {
        field.config = { ...field.config, custom: {} };
      }
    }

    const frames = prepareGraphableFields([mainA, mainB, compareB, compareA], theme);
    expect(frames).not.toBeNull();

    const mainFields = frames!.filter((f) => !f.meta?.timeCompare?.isTimeShiftQuery).map((f) => f.fields[1]);
    const compareFields = frames!.filter((f) => f.meta?.timeCompare?.isTimeShiftQuery).map((f) => f.fields[1]);

    const mainAField = mainFields.find((f) => f.labels?.pod === 'a')!;
    const mainBField = mainFields.find((f) => f.labels?.pod === 'b')!;
    const compareAField = compareFields.find((f) => f.labels?.pod === 'a')!;
    const compareBField = compareFields.find((f) => f.labels?.pod === 'b')!;

    expect(compareAField.state?.seriesIndex).toBe(mainAField.state?.seriesIndex);
    expect(compareBField.state?.seriesIndex).toBe(mainBField.state?.seriesIndex);

    const palette = theme.visualization.palette;
    const colorAt = (idx: number) => theme.visualization.getColorByName(palette[idx % palette.length]);
    expect(colorAt(compareAField.state!.seriesIndex!)).toBe(colorAt(mainAField.state!.seriesIndex!));
    expect(colorAt(compareBField.state!.seriesIndex!)).toBe(colorAt(mainBField.state!.seriesIndex!));
  });
});
