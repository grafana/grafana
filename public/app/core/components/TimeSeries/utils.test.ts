import type uPlot from 'uplot';

import {
  createDataFrame,
  createTheme,
  type DataFrame,
  dateTime,
  type DateTimeInput,
  type EventBus,
  FieldColorModeId,
  FieldType,
  type TimeRange,
} from '@grafana/data';
import { getTheme } from '@grafana/ui';
import { getComparisonFieldPairs } from 'app/plugins/panel/timeseries/utils';

import { getXAxisConfig, preparePlotConfigBuilder, UPLOT_DEFAULT_AXIS_GAP } from './utils';

/** Minimal time + value frame; enough to exercise the shared x-axis and cursor config. */
function makeTimeFrame(): DataFrame {
  return createDataFrame({
    fields: [
      { name: 'Time', type: FieldType.time, config: {}, values: [1000, 2000, 3000] },
      { name: 'Value', type: FieldType.number, config: {}, values: [10, 20, 30] },
    ],
  });
}

function makeTimeRange(from: number, to: number): TimeRange {
  return { from: dateTime(from), to: dateTime(to), raw: { from: dateTime(from), to: dateTime(to) } };
}

function buildBuilder(frame: DataFrame, overrides: Partial<Parameters<typeof preparePlotConfigBuilder>[0]> = {}) {
  return preparePlotConfigBuilder({
    frame,
    theme: createTheme(),
    timeZones: ['browser'],
    getTimeRange: () => makeTimeRange(1000, 3000),
    allFrames: [frame],
    renderers: [],
    ...overrides,
  });
}

describe('when fill below to option is used', () => {
  let eventBus: EventBus;
  // eslint-disable-next-line
  let renderers: any[];
  // eslint-disable-next-line
  let tests: any;

  beforeEach(() => {
    eventBus = {
      publish: jest.fn(),
      getStream: jest.fn(),
      subscribe: jest.fn(),
      removeAllListeners: jest.fn(),
      newScopedBus: jest.fn(),
    };
    renderers = [];

    tests = [
      {
        alignedFrame: {
          fields: [
            {
              config: {},
              values: [1667406900000, 1667407170000, 1667407185000],
              name: 'Time',
              state: { multipleFrames: true, displayName: 'Time', origin: { fieldIndex: 0, frameIndex: 0 } },
              type: FieldType.time,
            },
            {
              config: { displayNameFromDS: 'Test1', custom: { fillBelowTo: 'Test2' }, min: 0, max: 100 },
              values: [1, 2, 3],
              name: 'Value',
              state: { multipleFrames: true, displayName: 'Test1', origin: { fieldIndex: 1, frameIndex: 0 } },
              type: FieldType.number,
            },
            {
              config: { displayNameFromDS: 'Test2', min: 0, max: 100 },
              values: [4, 5, 6],
              name: 'Value',
              state: { multipleFrames: true, displayName: 'Test2', origin: { fieldIndex: 1, frameIndex: 1 } },
              type: FieldType.number,
            },
          ],
          length: 3,
        },
        allFrames: [
          {
            name: 'Test1',
            refId: 'A',
            fields: [
              {
                config: {},
                values: [1667406900000, 1667407170000, 1667407185000],
                name: 'Time',
                state: { multipleFrames: true, displayName: 'Time', origin: { fieldIndex: 0, frameIndex: 0 } },
                type: FieldType.time,
              },
              {
                config: { displayNameFromDS: 'Test1', custom: { fillBelowTo: 'Test2' }, min: 0, max: 100 },
                values: [1, 2, 3],
                name: 'Value',
                state: { multipleFrames: true, displayName: 'Test1', origin: { fieldIndex: 1, frameIndex: 0 } },
                type: FieldType.number,
              },
            ],
            length: 2,
          },
          {
            name: 'Test2',
            refId: 'B',
            fields: [
              {
                config: {},
                values: [1667406900000, 1667407170000, 1667407185000],
                name: 'Time',
                state: { multipleFrames: true, displayName: 'Time', origin: { fieldIndex: 0, frameIndex: 1 } },
                type: FieldType.time,
              },
              {
                config: { displayNameFromDS: 'Test2', min: 0, max: 100 },
                values: [1, 2, 3],
                name: 'Value',
                state: { multipleFrames: true, displayName: 'Test2', origin: { fieldIndex: 1, frameIndex: 1 } },
                type: FieldType.number,
              },
            ],
            length: 2,
          },
        ],
        expectedResult: 1,
      },
      {
        alignedFrame: {
          fields: [
            {
              config: {},
              values: [1667406900000, 1667407170000, 1667407185000],
              name: 'time',
              state: { multipleFrames: true, displayName: 'time', origin: { fieldIndex: 0, frameIndex: 0 } },
              type: FieldType.time,
            },
            {
              config: { custom: { fillBelowTo: 'below_value1' } },
              values: [1, 2, 3],
              name: 'value1',
              state: { multipleFrames: true, displayName: 'value1', origin: { fieldIndex: 1, frameIndex: 0 } },
              type: FieldType.number,
            },
            {
              config: { custom: { fillBelowTo: 'below_value2' } },
              values: [4, 5, 6],
              name: 'value2',
              state: { multipleFrames: true, displayName: 'value2', origin: { fieldIndex: 2, frameIndex: 0 } },
              type: FieldType.number,
            },
            {
              config: {},
              values: [4, 5, 6],
              name: 'below_value1',
              state: { multipleFrames: true, displayName: 'below_value1', origin: { fieldIndex: 1, frameIndex: 1 } },
              type: FieldType.number,
            },
            {
              config: {},
              values: [4, 5, 6],
              name: 'below_value2',
              state: { multipleFrames: true, displayName: 'below_value2', origin: { fieldIndex: 2, frameIndex: 1 } },
              type: FieldType.number,
            },
          ],
          length: 5,
        },
        allFrames: [
          {
            refId: 'A',
            fields: [
              {
                config: {},
                values: [1667406900000, 1667407170000, 1667407185000],
                name: 'time',
                state: { multipleFrames: true, displayName: 'time', origin: { fieldIndex: 0, frameIndex: 0 } },
                type: FieldType.time,
              },
              {
                config: { custom: { fillBelowTo: 'below_value1' } },
                values: [1, 2, 3],
                name: 'value1',
                state: { multipleFrames: true, displayName: 'value1', origin: { fieldIndex: 1, frameIndex: 0 } },
                type: FieldType.number,
              },
              {
                config: { custom: { fillBelowTo: 'below_value2' } },
                values: [4, 5, 6],
                name: 'value2',
                state: { multipleFrames: true, displayName: 'value2', origin: { fieldIndex: 2, frameIndex: 0 } },
                type: FieldType.number,
              },
            ],
            length: 3,
          },
          {
            refId: 'B',
            fields: [
              {
                config: {},
                values: [1667406900000, 1667407170000, 1667407185000],
                name: 'time',
                state: { multipleFrames: true, displayName: 'time', origin: { fieldIndex: 0, frameIndex: 1 } },
                type: FieldType.time,
              },
              {
                config: {},
                values: [4, 5, 6],
                name: 'below_value1',
                state: { multipleFrames: true, displayName: 'below_value1', origin: { fieldIndex: 1, frameIndex: 1 } },
                type: FieldType.number,
              },
              {
                config: {},
                values: [4, 5, 6],
                name: 'below_value2',
                state: { multipleFrames: true, displayName: 'below_value2', origin: { fieldIndex: 2, frameIndex: 1 } },
                type: FieldType.number,
              },
            ],
            length: 3,
          },
        ],
        expectedResult: 2,
      },
    ];
  });

  it('should verify if fill below to is set then builder bands are set', () => {
    for (const test of tests) {
      const builder = preparePlotConfigBuilder({
        frame: test.alignedFrame,
        //@ts-ignore
        theme: getTheme(),
        timeZones: ['browser'],
        getTimeRange: jest.fn(),
        eventBus,
        sync: jest.fn(),
        allFrames: test.allFrames,
        renderers,
      });

      //@ts-ignore
      expect(builder.bands.length).toBe(test.expectedResult);
    }
  });

  it('should verify if fill below to is not set then builder bands are empty', () => {
    tests[0].alignedFrame.fields[1].config.custom.fillBelowTo = undefined;
    tests[0].allFrames[0].fields[1].config.custom.fillBelowTo = undefined;
    tests[1].alignedFrame.fields[1].config.custom.fillBelowTo = undefined;
    tests[1].alignedFrame.fields[2].config.custom.fillBelowTo = undefined;
    tests[1].allFrames[0].fields[1].config.custom.fillBelowTo = undefined;
    tests[1].allFrames[0].fields[2].config.custom.fillBelowTo = undefined;
    tests[0].expectedResult = 0;
    tests[1].expectedResult = 0;

    for (const test of tests) {
      const builder = preparePlotConfigBuilder({
        frame: test.alignedFrame,
        //@ts-ignore
        theme: getTheme(),
        timeZones: ['browser'],
        getTimeRange: jest.fn(),
        eventBus,
        sync: jest.fn(),
        allFrames: test.allFrames,
        renderers,
      });

      //@ts-ignore
      expect(builder.bands.length).toBe(test.expectedResult);
    }
  });

  it('should verify if fill below to is set and field name is overriden then builder bands are set', () => {
    tests[0].alignedFrame.fields[2].config.displayName = 'newName';
    tests[0].alignedFrame.fields[2].state.displayName = 'newName';
    tests[0].allFrames[1].fields[1].config.displayName = 'newName';
    tests[0].allFrames[1].fields[1].state.displayName = 'newName';

    tests[1].alignedFrame.fields[3].config.displayName = 'newName';
    tests[1].alignedFrame.fields[3].state.displayName = 'newName';
    tests[1].allFrames[1].fields[1].config.displayName = 'newName';
    tests[1].allFrames[1].fields[1].state.displayName = 'newName';

    for (const test of tests) {
      const builder = preparePlotConfigBuilder({
        frame: test.alignedFrame,
        //@ts-ignore
        theme: getTheme(),
        timeZones: ['browser'],
        getTimeRange: jest.fn(),
        eventBus,
        sync: jest.fn(),
        allFrames: test.allFrames,
        renderers,
      });

      //@ts-ignore
      expect(builder.bands.length).toBe(test.expectedResult);
    }
  });
});

describe('time axis units', () => {
  it('should use default time unit formatting if no custom unit provided ', () => {
    const frame = createDataFrame({
      fields: [
        {
          config: {},
          values: [1667406900000, 1667407170000, 1667407185000],
          name: 'Time',
          type: FieldType.time,
        },
        {
          config: {},
          values: [1, 2, 3],
          name: 'Value',
          type: FieldType.number,
        },
        {
          config: {},
          values: [4, 5, 6],
          name: 'Value',
          type: FieldType.number,
        },
      ],
    });
    const eventBus = {
      publish: jest.fn(),
      getStream: jest.fn(),
      subscribe: jest.fn(),
      removeAllListeners: jest.fn(),
      newScopedBus: jest.fn(),
    };
    const builder = preparePlotConfigBuilder({
      frame,
      //@ts-ignore
      theme: getTheme(),
      timeZones: ['browser'],
      getTimeRange: jest.fn(),
      eventBus,
      sync: jest.fn(),
      allFrames: [frame],
      renderers: [],
    });
    const config = builder.getConfig();
    expect(config.axes![0]!.values).toEqual(expect.any(Function));
    // @ts-ignore
    expect(config.axes![0]!.values(config, [1667406900000, 1761316576114], 0, 100, 1000)).toEqual([
      '11:35:00',
      '09:36:16',
    ]);
  });

  it('should use custom time unit if provided ', () => {
    const frame = createDataFrame({
      fields: [
        {
          config: { unit: 'time: MM-DD' },
          values: [1667406900000, 1667407170000, 1667407185000],
          name: 'Time',
          state: { multipleFrames: true, displayName: 'Time', origin: { fieldIndex: 0, frameIndex: 0 } },
          type: FieldType.time,
          display: jest.fn((v) => ({ text: dateTime(v as DateTimeInput).format('MM-DD'), numeric: Number(v) })),
        },
        {
          config: {},
          values: [1, 2, 3],
          name: 'Value',
          state: { multipleFrames: true, displayName: 'Test1', origin: { fieldIndex: 1, frameIndex: 0 } },
          type: FieldType.number,
        },
        {
          config: {},
          values: [4, 5, 6],
          name: 'Value',
          state: { multipleFrames: true, displayName: 'Test2', origin: { fieldIndex: 1, frameIndex: 1 } },
          type: FieldType.number,
        },
      ],
    });
    const eventBus = {
      publish: jest.fn(),
      getStream: jest.fn(),
      subscribe: jest.fn(),
      removeAllListeners: jest.fn(),
      newScopedBus: jest.fn(),
    };
    const builder = preparePlotConfigBuilder({
      frame,
      //@ts-ignore
      theme: getTheme(),
      timeZones: ['browser'],
      getTimeRange: jest.fn(),
      eventBus,
      sync: jest.fn(),
      allFrames: [frame],
      renderers: [],
    });
    const config = builder.getConfig();
    expect(config.axes![0]!.values).toEqual(expect.any(Function));
    // @ts-ignore
    expect(config.axes![0]!.values(config, [1667406900000, 1761316576114], 0, 100, 1000)).toEqual(['11-02', '10-24']);
  });
});

describe('calculateAnnotationLaneSizes', () => {
  it('should not regress', () => {
    expect(getXAxisConfig()).toEqual(undefined);
    expect(getXAxisConfig(0)).toEqual(undefined);
  });
  it('should return config to resize x-axis size, gap, and ticks size', () => {
    expect(getXAxisConfig(2)).toEqual({
      gap: UPLOT_DEFAULT_AXIS_GAP,
      size: 36,
      ticks: {
        size: 19,
      },
    });
    expect(getXAxisConfig(3)).toEqual({
      gap: UPLOT_DEFAULT_AXIS_GAP,
      size: 43,
      ticks: {
        size: 26,
      },
    });
  });
});

describe('colorblind line style patterns', () => {
  const eventBus: EventBus = {
    publish: jest.fn(),
    getStream: jest.fn() as EventBus['getStream'],
    subscribe: jest.fn(),
    removeAllListeners: jest.fn(),
    newScopedBus: jest.fn(),
  };

  function buildWithLineStyle(lineStyle: object | undefined, fieldCount: number) {
    const fields: Array<Record<string, unknown>> = [
      {
        config: {},
        values: [1000, 2000, 3000],
        name: 'Time',
        state: { multipleFrames: false, displayName: 'Time', origin: { fieldIndex: 0, frameIndex: 0 } },
        type: FieldType.time,
      },
    ];

    for (let i = 0; i < fieldCount; i++) {
      fields.push({
        config: {
          color: { mode: FieldColorModeId.PaletteClassic },
          custom: lineStyle ? { lineStyle } : {},
        },
        values: [i + 1, i + 2, i + 3],
        name: `Series${i}`,
        state: {
          multipleFrames: false,
          displayName: `Series${i}`,
          origin: { fieldIndex: i + 1, frameIndex: 0 },
        },
        type: FieldType.number,
      });
    }

    const frame = createDataFrame({ fields });

    return preparePlotConfigBuilder({
      frame,
      // @ts-ignore
      theme: getTheme(),
      timeZones: ['browser'],
      getTimeRange: jest.fn(),
      eventBus,
      sync: jest.fn(),
      allFrames: [frame],
      renderers: [],
    });
  }

  it('should assign different patterns per series when colorblind line style is selected', () => {
    const builder = buildWithLineStyle({ fill: 'accessible' }, 3);
    const series = builder.getSeries();

    expect(series[0].props.lineStyle).toEqual({ fill: 'solid' });
    expect(series[1].props.lineStyle).toEqual({ fill: 'dash', dash: [10, 10] });
    expect(series[2].props.lineStyle).toEqual({ fill: 'dash', dash: [20, 10] });
  });

  it('should cycle patterns after 9 series', () => {
    const builder = buildWithLineStyle({ fill: 'accessible' }, 10);
    const series = builder.getSeries();

    // 10th series (index 9) wraps to first pattern (9 % 9 = 0)
    expect(series[9].props.lineStyle).toEqual({ fill: 'solid' });
  });

  it('should assign all 9 distinct patterns before cycling', () => {
    const builder = buildWithLineStyle({ fill: 'accessible' }, 9);
    const series = builder.getSeries();
    const styles = series.map((s) => JSON.stringify(s.props.lineStyle));
    const unique = new Set(styles);
    expect(unique.size).toBe(9);
  });

  it('should use only solid and dash fills (no dot patterns)', () => {
    const builder = buildWithLineStyle({ fill: 'accessible' }, 9);
    const series = builder.getSeries();

    for (const s of series) {
      expect(s.props.lineStyle?.fill).toMatch(/^(solid|dash)$/);
    }
  });

  it('should not modify non-colorblind line styles', () => {
    const dashStyle = { fill: 'dash', dash: [50, 50] };
    const builder = buildWithLineStyle(dashStyle, 2);
    const series = builder.getSeries();

    expect(series[0].props.lineStyle).toEqual(dashStyle);
    expect(series[1].props.lineStyle).toEqual(dashStyle);
  });

  it('should pass through solid line style unchanged', () => {
    const builder = buildWithLineStyle({ fill: 'solid' }, 2);
    const series = builder.getSeries();

    expect(series[0].props.lineStyle).toEqual({ fill: 'solid' });
    expect(series[1].props.lineStyle).toEqual({ fill: 'solid' });
  });

  it('should pass through undefined line style', () => {
    const builder = buildWithLineStyle(undefined, 2);
    const series = builder.getSeries();

    expect(series[0].props.lineStyle).toBeUndefined();
    expect(series[1].props.lineStyle).toBeUndefined();
  });

  it('should work with any color palette (decoupled from color mode)', () => {
    // Uses PaletteClassic (not colorblind palette) but colorblind line style
    const builder = buildWithLineStyle({ fill: 'accessible' }, 2);
    const series = builder.getSeries();

    expect(series[0].props.lineStyle).toEqual({ fill: 'solid' });
    expect(series[1].props.lineStyle).toEqual({ fill: 'dash', dash: [10, 10] });
  });

  it('should handle single series', () => {
    const builder = buildWithLineStyle({ fill: 'accessible' }, 1);
    const series = builder.getSeries();

    expect(series).toHaveLength(1);
    expect(series[0].props.lineStyle).toEqual({ fill: 'solid' });
  });
});

describe('cursor proximity', () => {
  // The hover.prox callback only reads `self.data`, so a minimal stand-in is enough to drive it.
  type MockUPlot = { data: Array<Array<number | null>> };

  function getHoverProx(builder: ReturnType<typeof preparePlotConfigBuilder>) {
    const prox = builder.getConfig().cursor?.hover?.prox;

    return prox as (self: MockUPlot, seriesIdx: number, hoveredIdx: number) => number | null;
  }

  it('uses no proximity limit when hovering a non-null value', () => {
    const prox = getHoverProx(buildBuilder(makeTimeFrame()));
    const u: MockUPlot = {
      data: [
        [1000, 2000, 3000],
        [10, null, 30],
      ],
    };

    expect(prox(u, 1, 0)).toBeNull();
  });

  it('limits proximity to 15px when hovering a null value', () => {
    const prox = getHoverProx(buildBuilder(makeTimeFrame()));
    const u: MockUPlot = {
      data: [
        [1000, 2000, 3000],
        [10, null, 30],
      ],
    };

    expect(prox(u, 1, 1)).toBe(15);
  });

  it('uses the configured hoverProximity for both hover and focus when provided', () => {
    const builder = buildBuilder(makeTimeFrame(), { hoverProximity: 42 });
    const prox = getHoverProx(builder);
    const u: MockUPlot = { data: [[1000], [null]] };

    // an explicit proximity overrides the null-value default
    expect(prox(u, 1, 0)).toBe(42);
    expect(builder.getConfig().cursor?.focus?.prox).toBe(42);
  });

  it('defaults focus proximity to 30px', () => {
    const builder = buildBuilder(makeTimeFrame());

    expect(builder.getConfig().cursor?.focus?.prox).toBe(30);
  });
});

describe('x-axis time range', () => {
  // The range callback ignores its uPlot arguments, so it can be called with none.
  function getXTimeRange(builder: ReturnType<typeof preparePlotConfigBuilder>) {
    const range = builder.getConfig().scales?.x?.range;
    return range as () => [number, number];
  }

  it('returns the current time range when not panning', () => {
    const builder = buildBuilder(makeTimeFrame(), { getTimeRange: () => makeTimeRange(1000, 5000) });

    expect(getXTimeRange(builder)()).toEqual([1000, 5000]);
  });

  it('returns the panned min/max while panning', () => {
    const builder = buildBuilder(makeTimeFrame(), { getTimeRange: () => makeTimeRange(1000, 5000) });
    builder.setState({ isPanning: true, min: 2000, max: 4000 });

    expect(getXTimeRange(builder)()).toEqual([2000, 4000]);
  });

  it('keeps panning while the props time range has not caught up', () => {
    const builder = buildBuilder(makeTimeFrame(), { getTimeRange: () => makeTimeRange(1000, 5000) });
    builder.setState({ isPanning: true, min: 2000, max: 4000, isTimeRangePending: true });

    expect(getXTimeRange(builder)()).toEqual([2000, 4000]);
    expect(builder.getState().isPanning).toBe(true);
  });

  it('commits the props time range and stops panning once it catches up', () => {
    const builder = buildBuilder(makeTimeFrame(), { getTimeRange: () => makeTimeRange(2000, 4000) });
    builder.setState({ isPanning: true, min: 2000, max: 4000, isTimeRangePending: true });

    expect(getXTimeRange(builder)()).toEqual([2000, 4000]);
    expect(builder.getState().isPanning).toBe(false);
  });
});

describe('comparison cursor point', () => {
  /**
   * Current-period + time-comparison pair, already aligned and joined the way GraphNG hands
   * it to preparePlotConfigBuilder: shared `state.seriesIndex` (assigned by setClassicPaletteIdxs
   * so the pair renders in one color) and `state.origin` pointing back into allFrames.
   */
  function makeComparePair(): { alignedFrame: DataFrame; allFrames: DataFrame[] } {
    const current: DataFrame = {
      refId: 'A',
      length: 2,
      fields: [
        { name: 'Time', type: FieldType.time, config: {}, values: [1000, 2000] },
        { name: 'Value', type: FieldType.number, config: {}, values: [10, 20] },
      ],
    };

    const compare: DataFrame = {
      refId: 'A-compare',
      length: 2,
      meta: { timeCompare: { diffMs: -1000, isTimeShiftQuery: true } },
      fields: [
        { name: 'Time', type: FieldType.time, config: {}, values: [1000, 2000] },
        { name: 'Value', type: FieldType.number, config: {}, values: [5, 8] },
      ],
    };

    const alignedFrame: DataFrame = {
      length: 2,
      fields: [
        {
          name: 'Time',
          type: FieldType.time,
          config: {},
          values: [1000, 2000],
          state: { origin: { frameIndex: 0, fieldIndex: 0 } },
        },
        {
          name: 'Value',
          type: FieldType.number,
          config: {},
          values: [10, 20],
          state: { seriesIndex: 0, origin: { frameIndex: 0, fieldIndex: 1 } },
        },
        {
          name: 'Value',
          type: FieldType.number,
          config: {},
          values: [5, 8],
          state: { seriesIndex: 0, origin: { frameIndex: 1, fieldIndex: 1 } },
        },
      ],
    };

    return { alignedFrame, allFrames: [current, compare] };
  }

  /** Minimal uPlot stand-in covering only what the cursor point hook reads. */
  interface MockUPlot {
    over: HTMLDivElement;
    data: Array<Array<number | null>>;
    series: Array<{ show: boolean; scale: string }>;
    cursor: {
      event: Event | null;
      idxs: Array<number | null>;
      points: {
        size: (u: unknown, i: number) => number;
        width: (u: unknown, i: number, size: number) => number;
        fill: (u: unknown, i: number) => string;
        stroke: (u: unknown, i: number) => string;
      };
    };
    valToPos: (val: number, scale: string) => number;
  }

  function makeMockUPlot(overrides: Partial<MockUPlot> = {}): MockUPlot {
    return {
      over: document.createElement('div'),
      data: [
        [1000, 2000],
        [10, 20],
        [5, 8],
      ],
      series: [
        { show: true, scale: 'x' },
        { show: true, scale: 'y' },
        { show: true, scale: 'y' },
      ],
      cursor: {
        event: new MouseEvent('mousemove'),
        idxs: [1, 1, 1],
        points: {
          size: () => 8,
          width: (_u, _i, size) => size / 4,
          fill: () => '#ff0000',
          stroke: () => '#ff000080',
        },
      },
      // stand-in projection: x -> val/10, y -> 100 - val
      valToPos: (val, scale) => (scale === 'x' ? val / 10 : 100 - val),
      ...overrides,
    };
  }

  /**
   * The pairing derivation is injected by the panel rather than imported by the config builder, so
   * these tests wire in the real one to exercise the same path production takes.
   */
  function buildComparisonBuilder(frame: DataFrame, allFrames: DataFrame[]) {
    return buildBuilder(frame, { allFrames, getComparisonFieldPairs });
  }

  /**
   * Casts the mock for hook invocation. The hooks read a small, well-defined slice of the
   * uPlot instance; confining the assertion to one helper keeps it out of the tests.
   */
  function asUPlot(u: MockUPlot): uPlot {
    // @ts-expect-error MockUPlot implements only the surface the cursor point hooks touch
    return u;
  }

  /** Runs init + setSeries(hoveredIdx) + setCursor, returning the point element (if any). */
  function hover(
    builder: ReturnType<typeof preparePlotConfigBuilder>,
    u: MockUPlot,
    hoveredSeriesIdx: number | null
  ): HTMLElement | null {
    const hooks = builder.getConfig().hooks ?? {};
    const asU = asUPlot(u);

    hooks.init?.forEach((hook) => hook?.(asU, {} as uPlot.Options, []));
    hooks.setSeries?.forEach((hook) => hook?.(asU, hoveredSeriesIdx, {}));
    hooks.setCursor?.forEach((hook) => hook?.(asU));

    return u.over.querySelector('.u-cursor-pt');
  }

  it('derives the pairing from the frame the config is built against', () => {
    const { alignedFrame, allFrames } = makeComparePair();

    // bidirectional, in aligned field index space (field 0 is the x field)
    expect(getComparisonFieldPairs(alignedFrame, allFrames)).toEqual(
      new Map([
        [1, 2],
        [2, 1],
      ])
    );
  });

  it('adds no cursor point when there is no comparison series', () => {
    const frame = makeTimeFrame();
    const builder = buildComparisonBuilder(frame, [frame]);

    expect(hover(builder, makeMockUPlot(), 1)).toBeNull();
  });

  it('adds no cursor point when the panel supplies no pairing derivation', () => {
    // other GraphNG-based panels do not pass getComparisonFieldPairs at all
    const { alignedFrame, allFrames } = makeComparePair();
    const builder = buildBuilder(alignedFrame, { allFrames });

    expect(hover(builder, makeMockUPlot(), 1)).toBeNull();
  });

  it('positions the point on the paired series at the hovered index', () => {
    const { alignedFrame, allFrames } = makeComparePair();
    const builder = buildComparisonBuilder(alignedFrame, allFrames);

    // hovering series 1 (current, y=20) should mark series 2 (compare, y=8) at the same x
    const point = hover(builder, makeMockUPlot(), 1);

    // x: 2000/10 = 200, y: 100 - 8 = 92
    expect(point?.style.transform).toBe('translate(200px, 92px)');
  });

  it('positions the point on the current-period series when hovering the comparison series', () => {
    const { alignedFrame, allFrames } = makeComparePair();
    const builder = buildComparisonBuilder(alignedFrame, allFrames);

    const point = hover(builder, makeMockUPlot(), 2);

    // pairs back to series 1 (y=20): x 2000/10 = 200, y 100 - 20 = 80
    expect(point?.style.transform).toBe('translate(200px, 80px)');
  });

  it('sizes and colors the point from the resolved cursor point config', () => {
    const { alignedFrame, allFrames } = makeComparePair();
    const builder = buildComparisonBuilder(alignedFrame, allFrames);

    const point = hover(builder, makeMockUPlot(), 1);

    expect(point?.style.width).toBe('8px');
    expect(point?.style.height).toBe('8px');
    // centered on the datapoint
    expect(point?.style.marginLeft).toBe('-4px');
    expect(point?.style.marginTop).toBe('-4px');
    expect(point?.style.borderWidth).toBe('2px');
    expect(point?.style.background).toBe('rgb(255, 0, 0)');
  });

  it('hides the point when the paired series has no value at the hovered index', () => {
    const { alignedFrame, allFrames } = makeComparePair();
    const builder = buildComparisonBuilder(alignedFrame, allFrames);
    const u = makeMockUPlot({
      data: [
        [1000, 2000],
        [10, 20],
        [5, null],
      ],
    });

    expect(hover(builder, u, 1)?.style.transform).toBe('translate(-10px, -10px)');
  });

  it('hides the point when the paired series is toggled off in the legend', () => {
    const { alignedFrame, allFrames } = makeComparePair();
    const builder = buildComparisonBuilder(alignedFrame, allFrames);
    const u = makeMockUPlot({
      series: [
        { show: true, scale: 'x' },
        { show: true, scale: 'y' },
        { show: false, scale: 'y' },
      ],
    });

    expect(hover(builder, u, 1)?.style.transform).toBe('translate(-10px, -10px)');
  });

  it('hides the point when no series is within cursor proximity', () => {
    const { alignedFrame, allFrames } = makeComparePair();
    const builder = buildComparisonBuilder(alignedFrame, allFrames);

    // uPlot reports a null series once the cursor leaves focus.prox
    expect(hover(builder, makeMockUPlot(), null)?.style.transform).toBe('translate(-10px, -10px)');
  });

  it('hides the point for cursor updates synced from another panel', () => {
    const { alignedFrame, allFrames } = makeComparePair();
    const builder = buildComparisonBuilder(alignedFrame, allFrames);
    // uPlot leaves cursor.event null when the update came from a synced panel
    const u = makeMockUPlot({ cursor: { ...makeMockUPlot().cursor, event: null } });

    expect(hover(builder, u, 1)?.style.transform).toBe('translate(-10px, -10px)');
  });
});
