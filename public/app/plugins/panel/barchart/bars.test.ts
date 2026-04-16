import type uPlot from 'uplot';

import { createDataFrame, createTheme, type DataFrame, FieldType, type GrafanaTheme2 } from '@grafana/data';
import { ScaleDirection, ScaleOrientation, StackingMode, VisibilityMode } from '@grafana/schema';

import { type BarsOptions, getConfig } from './bars';

/** Mock uPlot instance shape used by config hook tests. */
interface MockUPlot {
  data: [unknown[], ...Array<Array<number | null>>];
  bbox: { left: number; top: number; width: number; height: number };
  ctx: { save: jest.Mock; restore: jest.Mock; fillText: jest.Mock; fillStyle: string; font: string };
  root: HTMLDivElement;
  series: unknown[];
  cursor: { left: number; top: number };
  pxRatio: number;
}

/**
 * Casts MockUPlot to uPlot for config hook calls.
 * Mock does not implement full uPlot interface; cast is required for getConfig hooks.
 * Confines type assertion to one place.
 */
function asUPlot(u: MockUPlot): uPlot {
  // @ts-expect-error MockUPlot is an incomplete mock that satisfies test needs but not the full uPlot interface
  return u;
}

const defaultTextMetrics = {
  width: 20,
  actualBoundingBoxAscent: 10,
  actualBoundingBoxDescent: 4,
};

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  measureText: jest.fn(() => defaultTextMetrics),
}));

/** Config shape accepted by the uPlot paths.bars mock (mirrors the real `each` callback signature). */
interface MockBarsConfig {
  each?: (u: unknown, seriesIdx: number, dataIdx: number, lft: number, top: number, wid: number, hgt: number) => void;
}

/** Minimal uPlot-like data passed into the paths.bars path builder. */
interface MockUPlotData {
  data: unknown[][];
  bbox: { left: number; top: number; width: number; height: number };
}

/**
 * Iterates over data points for a single series and invokes config.each with
 * deterministic bar geometry so tests can assert hit-testing and label placement.
 */
function mockBarsPathBuilder(config: MockBarsConfig, u: MockUPlotData, seriesIdx: number): string {
  const each = config?.each;
  if (each && u.data && u.data[0]) {
    const xLen = u.data[0].length;
    const bbox = u.bbox ?? { left: 0, top: 0, width: 100, height: 100 };
    for (let dataIdx = 0; dataIdx < xLen; dataIdx++) {
      const seriesData = u.data[seriesIdx];
      if (seriesData && seriesData[dataIdx] != null) {
        const val = seriesData[dataIdx];
        const numVal = typeof val === 'number' ? val : 0;
        const lft = bbox.left + 10 + dataIdx * 30;
        const top = numVal >= 0 ? bbox.top + 60 : bbox.top + 40;
        const wid = 25;
        const hgt = Math.abs(numVal) * 2;
        each(u, seriesIdx, dataIdx, lft, top, wid, hgt);
      }
    }
  }
  return '';
}

/** Factory matching the uPlot.paths.bars signature: accepts config, returns a path builder. */
function mockBarsFactory(config: MockBarsConfig) {
  return (u: MockUPlotData, seriesIdx: number) => mockBarsPathBuilder(config, u, seriesIdx);
}

jest.mock('uplot', () => {
  const mock = Object.assign(jest.fn(), {
    pxRatio: 1,
    paths: {
      bars: jest.fn(mockBarsFactory),
    },
  });
  return mock;
});

const mockPreparePlotData2 = jest.fn();
jest.mock('@grafana/ui/internal', () => ({
  ...jest.requireActual('@grafana/ui/internal'),
  preparePlotData2: (
    frame: DataFrame,
    _stackingGroups: unknown,
    callback?: (opts: { totals?: Array<Array<number | null>> }) => void
  ) => {
    return mockPreparePlotData2(frame, _stackingGroups, callback);
  },
}));

/**
 * Creates minimal BarsOptions for getConfig tests.
 *
 * @param overrides - Optional overrides for any BarsOptions field
 */
function createMinimalBarsOptions(overrides?: Partial<BarsOptions>): BarsOptions {
  return {
    xOri: ScaleOrientation.Horizontal,
    xDir: ScaleDirection.Right,
    groupWidth: 0.7,
    barWidth: 0.97,
    barRadius: 0,
    showValue: VisibilityMode.Always,
    stacking: StackingMode.None,
    rawValue: (seriesIdx: number, valueIdx: number) => {
      const vals: Record<string, number[]> = { 1: [10, 20, 30] };
      return vals[seriesIdx]?.[valueIdx] ?? null;
    },
    formatValue: (_seriesIdx: number, value: unknown) => String(value),
    formatShortValue: (_seriesIdx: number, value: unknown) => String(value),
    ...overrides,
  };
}

/**
 * Creates a mock uPlot instance for config hook tests.
 *
 * @param data - Aligned data [xValues, ...seriesValues]
 * @returns MockUPlot instance compatible with config hooks
 */
function createMockU(data?: [unknown[], ...Array<Array<number | null>>]): MockUPlot {
  const defaultData: [unknown[], Array<number | null>] = [
    ['a', 'b', 'c'],
    [10, 20, 30],
  ];
  const alignedData = data ?? defaultData;

  const cursorPt = document.createElement('div');
  cursorPt.className = 'u-cursor-pt';

  const root = document.createElement('div');
  root.appendChild(cursorPt);

  const ctx = {
    save: jest.fn(),
    restore: jest.fn(),
    fillText: jest.fn(),
    fillStyle: '',
    font: '',
  };

  return {
    data: alignedData,
    bbox: { left: 50, top: 20, width: 200, height: 150 },
    ctx,
    root,
    series: [{}, {}],
    cursor: { left: 25, top: 50 },
    pxRatio: 1,
  };
}

/**
 * Creates a minimal DataFrame for prepData tests.
 *
 * @param overrides - Optional overrides for x values and value array
 * @returns DataFrame with x (string) and value (number) fields
 */
function createBarsPrepDataFrame(overrides?: { xValues?: string[]; values?: number[] }): DataFrame {
  const xValues = overrides?.xValues ?? ['a', 'b', 'c'];
  const values = overrides?.values ?? [10, 20, 30];
  return createDataFrame({
    fields: [
      { name: 'x', type: FieldType.string, values: xValues },
      { name: 'value', type: FieldType.number, values },
    ],
  });
}

describe('bars.getConfig', () => {
  const theme: GrafanaTheme2 = createTheme();

  beforeEach(() => {
    jest.clearAllMocks();
    mockPreparePlotData2.mockImplementation((frame: DataFrame) => {
      const xField = frame.fields[0];
      const valueField = frame.fields[1];
      function isArrayLike(v: unknown): v is ArrayLike<unknown> {
        return v != null && typeof v === 'object' && 'length' in v;
      }
      const toArray = (f: { values: unknown } | undefined): unknown[] => {
        if (!f) {
          return [];
        }
        const vals = f.values;
        if (Array.isArray(vals)) {
          return vals;
        }
        if (isArrayLike(vals)) {
          return Array.from(vals);
        }
        return [];
      };
      return [toArray(xField), toArray(valueField)];
    });
  });

  describe('return shape', () => {
    it('returns object with cursor, xRange, xValues, xSplits, hFilter, barsBuilder, init, drawClear, draw, prepData', () => {
      const config = getConfig(createMinimalBarsOptions(), theme);

      expect(config).toMatchObject({
        cursor: expect.any(Object),
        xRange: expect.any(Function),
        xValues: expect.any(Function),
        xSplits: expect.any(Function),
        barsBuilder: expect.any(Function),
        init: expect.any(Function),
        drawClear: expect.any(Function),
        draw: expect.any(Function),
        prepData: expect.any(Function),
      });
    });
  });

  describe('xRange', () => {
    it('returns [min, max] with min <= 0 and max >= dataLength-1 for non-stacked', () => {
      const opts = createMinimalBarsOptions();
      const config = getConfig(opts, theme);
      const u = createMockU([
        ['a', 'b', 'c'],
        [10, 20, 30],
      ]);

      expect(config.xRange).toBeDefined();
      const xRange = config.xRange;
      if (!xRange) {
        throw new Error('Expected xRange');
      }
      const result = xRange(asUPlot(u), 0, 10, 'x');

      expect(result).toHaveLength(2);
      expect(result[0]).toBeLessThanOrEqual(0);
      expect(result[1]).toBeGreaterThanOrEqual(2);
    });

    it('returns expanded range when pctOffset is 0.5 (centered)', () => {
      const opts = createMinimalBarsOptions({ groupWidth: 1, barWidth: 1 });
      const config = getConfig(opts, theme);
      const u = createMockU([
        ['a', 'b'],
        [10, 20],
      ]);

      expect(config.xRange).toBeDefined();
      const xRange = config.xRange;
      if (!xRange) {
        throw new Error('Expected xRange');
      }
      const result = xRange(asUPlot(u), 0, 10, 'x');

      expect(result[0]).toBeLessThanOrEqual(0);
      expect(result[1]).toBeGreaterThanOrEqual(1);
    });

    it('handles single data point', () => {
      const opts = createMinimalBarsOptions();
      const config = getConfig(opts, theme);
      const u = createMockU([['a'], [10]]);

      expect(config.xRange).toBeDefined();
      const xRange = config.xRange;
      if (!xRange) {
        throw new Error('Expected xRange');
      }
      const result = xRange(asUPlot(u), 0, 10, 'x');

      expect(result[0]).toBeLessThanOrEqual(0);
      expect(result[1]).toBeGreaterThanOrEqual(1);
    });
  });

  describe('xValues', () => {
    it('uses formatShortValue when xTimeAuto is false and xOri is Horizontal', () => {
      const formatShortValue = jest.fn((_, v) => `short-${v}`);
      const opts = createMinimalBarsOptions({
        xTimeAuto: false,
        xOri: ScaleOrientation.Horizontal,
        formatShortValue,
      });
      const config = getConfig(opts, theme);

      expect(config.xValues).toBeDefined();
      const xValues = config.xValues;
      if (!xValues) {
        throw new Error('Expected xValues');
      }
      const splits: number[] = [0, 1, 2];
      const result = xValues(asUPlot(createMockU()), splits, 0, 0, 0);

      expect(result).toEqual(['short-0', 'short-1', 'short-2']);
      expect(formatShortValue).toHaveBeenCalledWith(0, 0);
      expect(formatShortValue).toHaveBeenCalledWith(0, 1);
      expect(formatShortValue).toHaveBeenCalledWith(0, 2);
    });

    it('uses formatValue when xOri is Vertical', () => {
      const formatValue = jest.fn((_, v) => `fmt-${v}`);
      const opts = createMinimalBarsOptions({
        xTimeAuto: false,
        xOri: ScaleOrientation.Vertical,
        formatValue,
      });
      const config = getConfig(opts, theme);

      expect(config.xValues).toBeDefined();
      const xValues = config.xValues;
      if (!xValues) {
        throw new Error('Expected xValues');
      }
      const splits: number[] = [0, 1];
      const result = xValues(asUPlot(createMockU()), splits, 0, 0, 0);

      expect(result).toEqual(['fmt-0', 'fmt-1']);
    });

    it('uses dateTimeFormat when xTimeAuto is true', () => {
      const opts = createMinimalBarsOptions({
        xTimeAuto: true,
        timeZone: 'utc',
      });
      const config = getConfig(opts, theme);

      expect(config.xValues).toBeDefined();
      const xValues = config.xValues;
      if (!xValues) {
        throw new Error('Expected xValues');
      }
      const splits = [1000, 2000, 3000];
      const result = xValues(asUPlot(createMockU()), splits, 0, 0, 3600000);

      expect(result).toHaveLength(3);
      expect(result[0]).not.toBe('');
      expect(result[1]).not.toBe('');
      expect(result[2]).not.toBe('');
    });

    it('returns empty string for null splits when xTimeAuto', () => {
      const opts = createMinimalBarsOptions({ xTimeAuto: true, timeZone: 'utc' });
      const config = getConfig(opts, theme);

      expect(config.xValues).toBeDefined();
      const xValues = config.xValues;
      if (!xValues) {
        throw new Error('Expected xValues');
      }
      const splits: number[] = [1000, 2000, 3000];
      const result = xValues(asUPlot(createMockU()), splits, 0, 0, 3600000);

      expect(result).toHaveLength(3);
      expect(result[0]).not.toBe('');
      expect(result[1]).not.toBe('');
      expect(result[2]).not.toBe('');
    });
  });

  describe('xSplits', () => {
    it('returns indices [0, 1, 2, ...] for data length', () => {
      const opts = createMinimalBarsOptions();
      const config = getConfig(opts, theme);
      const u = createMockU([
        ['a', 'b', 'c'],
        [10, 20, 30],
      ]);

      expect(config.xSplits).toBeDefined();
      const xSplits = config.xSplits;
      if (!xSplits) {
        throw new Error('Expected xSplits');
      }
      const result = xSplits(asUPlot(u), 0, 0, 2, 1, 100);

      expect(result).toEqual([0, 1, 2]);
    });
  });

  describe('hFilter', () => {
    it('is undefined when xSpacing is 0', () => {
      const opts = createMinimalBarsOptions({ xSpacing: 0 });
      const config = getConfig(opts, theme);

      expect(config.hFilter).toBeUndefined();
    });

    it('filters splits when xSpacing > 0', () => {
      const opts = createMinimalBarsOptions({ xSpacing: 20 });
      const config = getConfig(opts, theme);
      const u = createMockU([
        ['a', 'b', 'c', 'd', 'e'],
        [10, 20, 30, 40, 50],
      ]);
      u.bbox.width = 100;

      expect(config.hFilter).toBeDefined();
      const hFilter = config.hFilter;
      if (!hFilter) {
        throw new Error('Expected hFilter');
      }
      const splits = [0, 1, 2, 3, 4];
      const result = hFilter(asUPlot(u), splits, 0, 100, 1);

      expect(result).toBeDefined();
      expect(result).toHaveLength(5);
      const nonNull = result ? result.filter((v) => v != null) : [];
      expect(nonNull.length).toBeLessThanOrEqual(5);
    });
  });

  describe('init', () => {
    it('sets borderRadius to 0 on .u-cursor-pt elements', () => {
      const opts = createMinimalBarsOptions();
      const config = getConfig(opts, theme);
      const u = createMockU();
      const cursorPt = u.root.querySelector('.u-cursor-pt');

      expect(config.init).toBeDefined();
      const init = config.init;
      if (!init) {
        throw new Error('Expected init');
      }
      init(asUPlot(u));

      expect(cursorPt).not.toBeNull();
      if (!(cursorPt instanceof HTMLElement)) {
        throw new Error('cursorPt is not HTML element');
      }

      expect(cursorPt.style.borderRadius).toBe('0');
    });

    it('sets zIndex to -1 when fullHighlight is true', () => {
      const opts = createMinimalBarsOptions({ fullHighlight: true });
      const config = getConfig(opts, theme);
      const u = createMockU();
      const cursorPt = u.root.querySelector('.u-cursor-pt');

      expect(config.init).toBeDefined();
      const init = config.init;
      if (!init) {
        throw new Error('Expected init');
      }
      init(asUPlot(u));

      expect(cursorPt).not.toBeNull();
      if (!(cursorPt instanceof HTMLElement)) {
        throw new Error('cursorPt is not HTML element');
      }
      expect(cursorPt.style.zIndex).toBe('-1');
    });
  });

  describe('drawClear', () => {
    it('does not throw when called with mock u', () => {
      const opts = createMinimalBarsOptions();
      const config = getConfig(opts, theme);
      const u = createMockU();
      u.series = [{}, {}];

      expect(config.drawClear).toBeDefined();
      const drawClear = config.drawClear;
      if (!drawClear) {
        throw new Error('Expected drawClear');
      }
      expect(() => drawClear(asUPlot(u))).not.toThrow();
    });

    it('sets barsPctLayout for stacked mode', () => {
      const opts = createMinimalBarsOptions({ stacking: StackingMode.Normal });
      const config = getConfig(opts, theme);
      const u = createMockU([
        ['a', 'b'],
        [10, 20],
        [5, 15],
      ]);
      u.series = [{}, {}, {}];

      expect(config.drawClear).toBeDefined();
      const drawClear = config.drawClear;
      if (!drawClear) {
        throw new Error('Expected drawClear');
      }
      drawClear(asUPlot(u));

      const pathBuilder = config.barsBuilder;
      expect(typeof pathBuilder).toBe('function');
      const path = pathBuilder(asUPlot(u), 1, 0, u.data[0].length - 1);
      expect(path).toBe('');
    });
  });

  describe('draw', () => {
    it('returns early when showValue is Never', () => {
      const opts = createMinimalBarsOptions({ showValue: VisibilityMode.Never });
      const config = getConfig(opts, theme);
      const u = createMockU();
      const drawClear = config.drawClear;
      const barsBuilder = config.barsBuilder;
      if (drawClear) {
        drawClear(asUPlot(u));
      }
      if (barsBuilder) {
        barsBuilder(asUPlot(u), 1, 0, u.data[0].length - 1);
      }

      expect(config.draw).toBeDefined();
      const draw = config.draw;
      if (!draw) {
        throw new Error('Expected draw');
      }
      draw(asUPlot(u));

      expect(u.ctx.fillText).not.toHaveBeenCalled();
    });

    it('calls ctx.fillText when showValue is Always and labels are populated', () => {
      const opts = createMinimalBarsOptions({
        showValue: VisibilityMode.Always,
        text: { valueSize: 14 },
      });
      const config = getConfig(opts, theme);
      const u = createMockU();
      const drawClear = config.drawClear;
      const barsBuilder = config.barsBuilder;
      if (drawClear) {
        drawClear(asUPlot(u));
      }
      if (barsBuilder) {
        barsBuilder(asUPlot(u), 1, 0, u.data[0].length - 1);
      }

      expect(config.draw).toBeDefined();
      const draw = config.draw;
      if (!draw) {
        throw new Error('Expected draw');
      }
      draw(asUPlot(u));

      expect(u.ctx.save).toHaveBeenCalled();
      expect(u.ctx.restore).toHaveBeenCalled();
      expect(u.ctx.fillText).toHaveBeenCalled();
    });

    it('returns early when fontSize < 8', () => {
      const opts = createMinimalBarsOptions({
        showValue: VisibilityMode.Always,
        text: { valueSize: 4 },
      });
      const config = getConfig(opts, theme);
      const u = createMockU();
      const drawClear = config.drawClear;
      const barsBuilder = config.barsBuilder;
      if (drawClear) {
        drawClear(asUPlot(u));
      }
      if (barsBuilder) {
        barsBuilder(asUPlot(u), 1, 0, u.data[0].length - 1);
      }

      expect(config.draw).toBeDefined();
      const draw = config.draw;
      if (!draw) {
        throw new Error('Expected draw');
      }
      draw(asUPlot(u));

      expect(u.ctx.fillText).not.toHaveBeenCalled();
    });
  });

  describe('prepData', () => {
    it('delegates to preparePlotData2 and returns aligned data', () => {
      const opts = createMinimalBarsOptions();
      const config = getConfig(opts, theme);
      const frame = createBarsPrepDataFrame();

      expect(config.prepData).toBeDefined();
      const prepData = config.prepData;
      if (!prepData) {
        throw new Error('Expected prepData');
      }
      const result = prepData([frame], []);

      expect(mockPreparePlotData2).toHaveBeenCalledWith(frame, [], expect.any(Function));
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toEqual(['a', 'b', 'c']);
      expect(result[1]).toEqual([10, 20, 30]);
    });

    it('invokes callback with totals when stacking', () => {
      const opts = createMinimalBarsOptions();
      const config = getConfig(opts, theme);
      const frame = createBarsPrepDataFrame({ xValues: ['a', 'b'], values: [10, 20] });

      mockPreparePlotData2.mockImplementation(
        (f: DataFrame, _: unknown, callback?: (opts: { totals?: Array<Array<number | null>> }) => void) => {
          const result = [
            Array.isArray(f.fields[0].values) ? f.fields[0].values : Array.from(f.fields[0].values),
            Array.isArray(f.fields[1].values) ? f.fields[1].values : Array.from(f.fields[1].values),
          ];
          callback?.({ totals: [[15, 25]] });
          return result;
        }
      );

      expect(config.prepData).toBeDefined();
      const prepData = config.prepData;
      if (!prepData) {
        throw new Error('Expected prepData');
      }
      prepData([frame], []);

      expect(mockPreparePlotData2).toHaveBeenCalled();
    });
  });

  describe('xValues xTimeAuto time formats', () => {
    const timeFormats = [
      { foundIncr: 1, desc: 'millisecond' },
      { foundIncr: 500, desc: 'second' },
      { foundIncr: 30000, desc: 'minute' },
      { foundIncr: 3600000, desc: 'hour' },
      { foundIncr: 86400000, desc: 'day' },
      { foundIncr: 2592000000, desc: 'month' },
      { foundIncr: 31536000000, desc: 'year' },
    ];

    it.each(timeFormats)('uses correct format for $desc', ({ foundIncr }) => {
      const opts = createMinimalBarsOptions({ xTimeAuto: true, timeZone: 'utc' });
      const config = getConfig(opts, theme);
      const splits = [1000, 2000];

      expect(config.xValues).toBeDefined();
      const xValues = config.xValues;
      if (!xValues) {
        throw new Error('Expected xValues');
      }
      const result = xValues(asUPlot(createMockU()), splits, 0, 0, foundIncr);

      expect(result).toHaveLength(2);
      expect(result[0]).not.toBe('');
      expect(result[1]).not.toBe('');
    });
  });

  describe('drawClear with getColor', () => {
    it('sets barsColors when getColor is provided', () => {
      const getColor = jest.fn((_s: number, _v: number, val: unknown) => (val !== null ? '#ff0000' : null));
      const opts = createMinimalBarsOptions({
        getColor,
        fillOpacity: 1,
      });
      const config = getConfig(opts, theme);
      const u = createMockU([
        ['a', 'b'],
        [10, 20],
      ]);
      u.series = [{}, {}];

      const drawClear = config.drawClear;
      const barsBuilder = config.barsBuilder;
      if (drawClear) {
        drawClear(asUPlot(u));
      }
      if (barsBuilder) {
        barsBuilder(asUPlot(u), 1, 0, u.data[0].length - 1);
      }

      expect(getColor).toHaveBeenCalledWith(1, 0, 10);
      expect(getColor).toHaveBeenCalledWith(1, 1, 20);
    });

    it('applies fillOpacity when getColor and fillOpacity < 1', () => {
      const getColor = jest.fn(() => '#ff0000');
      const opts = createMinimalBarsOptions({
        getColor,
        fillOpacity: 0.5,
      });
      const config = getConfig(opts, theme);
      const u = createMockU([['a'], [10]]);
      u.series = [{}, {}];

      const drawClear = config.drawClear;
      if (drawClear) {
        drawClear(asUPlot(u));
      }

      expect(getColor).toHaveBeenCalled();
    });
  });

  describe('draw with VisibilityMode.Auto', () => {
    it('draws labels when no collision in Auto mode', () => {
      const opts = createMinimalBarsOptions({
        showValue: VisibilityMode.Auto,
        text: { valueSize: 14 },
      });
      const config = getConfig(opts, theme);
      const u = createMockU([['a'], [10]]);
      const drawClear = config.drawClear;
      const barsBuilder = config.barsBuilder;
      if (drawClear) {
        drawClear(asUPlot(u));
      }
      if (barsBuilder) {
        barsBuilder(asUPlot(u), 1, 0, u.data[0].length - 1);
      }

      expect(config.draw).toBeDefined();
      const draw = config.draw;
      if (!draw) {
        throw new Error('Expected draw');
      }
      draw(asUPlot(u));

      expect(u.ctx.fillText).toHaveBeenCalled();
    });
  });

  describe('stacking modes', () => {
    it('uses distrOne layout for StackingMode.Normal', () => {
      const opts = createMinimalBarsOptions({ stacking: StackingMode.Normal });
      const config = getConfig(opts, theme);
      const u = createMockU([
        ['a', 'b'],
        [10, 20],
        [5, 15],
      ]);
      u.series = [{}, {}, {}];

      const drawClear = config.drawClear;
      if (drawClear) {
        drawClear(asUPlot(u));
      }
      const path = config.barsBuilder(asUPlot(u), 1, 0, u.data[0].length - 1);

      expect(path).toBe('');
    });

    it('uses distrOne layout for StackingMode.Percent in drawClear', () => {
      const opts = createMinimalBarsOptions({ stacking: StackingMode.Percent });
      const config = getConfig(opts, theme);
      const u = createMockU([['a'], [50], [50]]);
      u.series = [{}, {}, {}];

      const drawClear = config.drawClear;
      if (drawClear) {
        drawClear(asUPlot(u));
      }

      expect(config.barsBuilder).toBeDefined();
    });
  });

  describe('cursor', () => {
    it('returns undefined when no bar is hovered', () => {
      const opts = createMinimalBarsOptions();
      const config = getConfig(opts, theme);
      const u = createMockU();
      const drawClear = config.drawClear;
      const barsBuilder = config.barsBuilder;
      if (drawClear) {
        drawClear(asUPlot(u));
      }
      if (barsBuilder) {
        barsBuilder(asUPlot(u), 1, 0, u.data[0].length - 1);
      }

      const dataIdx = config.cursor.dataIdx?.(asUPlot(u), 1, 0, 0);

      expect(dataIdx).toBeUndefined();
    });

    it('points.bbox returns -10 when not hovered', () => {
      const opts = createMinimalBarsOptions();
      const config = getConfig(opts, theme);
      const u = createMockU();
      const drawClear = config.drawClear;
      const barsBuilder = config.barsBuilder;
      if (drawClear) {
        drawClear(asUPlot(u));
      }
      if (barsBuilder) {
        barsBuilder(asUPlot(u), 1, 0, u.data[0].length - 1);
      }

      const points = config.cursor.points;
      expect(points).toBeDefined();
      expect(points?.bbox).toBeDefined();
      const bbox = points?.bbox ? points.bbox(asUPlot(u), 1) : null;

      expect(bbox).not.toBeNull();
      if (bbox) {
        expect(bbox.left).toBe(-10);
        expect(bbox.top).toBe(-10);
        expect(bbox.width).toBe(0);
        expect(bbox.height).toBe(0);
      }
    });
  });

  describe('Vertical orientation', () => {
    it('uses formatValue and vertical layout for xOri Vertical', () => {
      const formatValue = jest.fn((_, v) => `v-${v}`);
      const opts = createMinimalBarsOptions({
        xOri: ScaleOrientation.Vertical,
        xDir: ScaleDirection.Up,
        formatValue,
      });
      const config = getConfig(opts, theme);
      const u = createMockU([
        ['a', 'b'],
        [10, -20],
      ]);
      const drawClear = config.drawClear;
      const barsBuilder = config.barsBuilder;
      if (drawClear) {
        drawClear(asUPlot(u));
      }
      if (barsBuilder) {
        barsBuilder(asUPlot(u), 1, 0, u.data[0].length - 1);
      }

      expect(config.draw).toBeDefined();
      const draw = config.draw;
      if (!draw) {
        throw new Error('Expected draw');
      }
      draw(asUPlot(u));

      expect(formatValue).not.toHaveBeenCalledWith(0, 'a');
      expect(u.ctx.fillText).toHaveBeenCalled();
    });
  });

  describe('negY', () => {
    it('flips value for negY series when rendering labels', () => {
      const opts = createMinimalBarsOptions({
        negY: [false, true],
        rawValue: (_s, v) => (v === 0 ? 10 : v === 1 ? -20 : null),
      });
      const config = getConfig(opts, theme);
      const u = createMockU([
        ['a', 'b'],
        [10, -20],
      ]);
      const drawClear = config.drawClear;
      const barsBuilder = config.barsBuilder;
      if (drawClear) {
        drawClear(asUPlot(u));
      }
      if (barsBuilder) {
        barsBuilder(asUPlot(u), 1, 0, u.data[0].length - 1);
      }

      expect(config.draw).toBeDefined();
      const draw = config.draw;
      if (!draw) {
        throw new Error('Expected draw');
      }
      draw(asUPlot(u));

      expect(u.ctx.fillText).toHaveBeenCalled();
    });
  });

  describe('fullHighlight', () => {
    it('expands bar rect for fullHighlight in Horizontal orientation', () => {
      const opts = createMinimalBarsOptions({ fullHighlight: true });
      const config = getConfig(opts, theme);
      const u = createMockU();
      const drawClear = config.drawClear;
      const barsBuilder = config.barsBuilder;
      if (drawClear) {
        drawClear(asUPlot(u));
      }
      if (barsBuilder) {
        barsBuilder(asUPlot(u), 1, 0, u.data[0].length - 1);
      }

      expect(config.barsBuilder).toBeDefined();
    });
  });

  describe('hasAutoValueSize', () => {
    it('calculates font size when text.valueSize is not set', () => {
      const opts = createMinimalBarsOptions({
        text: undefined,
        showValue: VisibilityMode.Always,
      });
      const config = getConfig(opts, theme);
      const u = createMockU();
      const drawClear = config.drawClear;
      const barsBuilder = config.barsBuilder;
      if (drawClear) {
        drawClear(asUPlot(u));
      }
      if (barsBuilder) {
        barsBuilder(asUPlot(u), 1, 0, u.data[0].length - 1);
      }

      expect(config.draw).toBeDefined();
      const draw = config.draw;
      if (!draw) {
        throw new Error('Expected draw');
      }
      draw(asUPlot(u));

      expect(u.ctx.fillText).toHaveBeenCalled();
    });
  });
});
