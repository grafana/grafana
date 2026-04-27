import uPlot from 'uplot';

import { createDataFrame, createTheme, DataFrameType, dateTime, FieldType } from '@grafana/data';
import { AxisPlacement, HeatmapCellLayout, ScaleDistribution } from '@grafana/schema';
import { type UPlotConfigBuilder } from '@grafana/ui';

import { type HeatmapData } from './fields';
import { HeatmapSelectionMode } from './panelcfg.gen';
import {
  applyExplicitMinMax,
  boundedMinMax,
  calculateBucketExpansionFactor,
  calculateYSizeDivisor,
  heatmapPathsDense,
  heatmapPathsPoints,
  heatmapPathsSparse,
  prepConfig,
  toLogBase,
  valuesToFills,
} from './utils';

type Nullable = number | null;
type DataX = number[];
type DataY = Array<number | null>;
type SparseHeatmap = [DataX, DataY, Nullable[], Nullable[]];
type DenseHeatmap = [number[], Nullable[], Nullable[]];
/** Points data for exemplar markers: [xValues, yValues] */
type PointsData = [DataX, DataY];

/** Mock canvas context used by path builder tests. */
type MockCtx = {
  save: jest.Mock;
  restore: jest.Mock;
  rect: jest.Mock;
  clip: jest.Mock;
  fillStyle: string;
  fill: jest.Mock;
};

/**
 * Mock CanvasRenderingContext2D
 */
function createMockCtx(): MockCtx {
  return {
    save: jest.fn(),
    restore: jest.fn(),
    rect: jest.fn(),
    clip: jest.fn(),
    fillStyle: '',
    fill: jest.fn(),
  };
}

function createMockU(data: SparseHeatmap | DenseHeatmap | PointsData, ctx?: MockCtx): uPlot {
  return {
    // @ts-expect-error partial mock — only the fields consumed by path builders
    data: { 1: data },
    // @ts-expect-error partial mock — only the fields consumed by path builders
    ctx: ctx ?? createMockCtx(),
    bbox: { left: 0, top: 0, width: 100, height: 100 },
  };
}

/**
 * Sparse heatmap data: xMax, yMin, yMax, count per cell.
 * 4 cells with distinct xMax (100, 200) and y bounds (1-4, 4-16).
 */
const sparseHeatmapData: SparseHeatmap = [
  [100, 200, 100, 200],
  [1, 1, 4, 4],
  [4, 4, 16, 16],
  [5, 10, 15, 20],
];

/**
 * Creates a minimal uPlot instance for range callback tests.
 * Uses the real uPlot constructor so the instance satisfies uPlot types.
 */
function createMinimalUPlot(
  scaleKey: string,
  overrides?: { data?: uPlot.AlignedData; log?: number; height?: number }
): uPlot {
  const scaleConfig: uPlot.Scale = overrides?.log ? { log: 2 } : {};
  const opts: uPlot.Options = {
    width: 100,
    height: overrides?.height ?? 100,
    series: [{}, {}],
    scales: {
      x: {},
      [scaleKey]: scaleConfig,
    },
  };
  const data: uPlot.AlignedData = overrides?.data ?? [
    [0, 1],
    [0, 1],
  ];
  const target = document.createElement('div');
  const u = new uPlot(opts, data, target);
  if (overrides?.data) {
    u.setData(overrides.data);
  }
  return u;
}

/**
 * Extracts the x-scale range function and scale key from a prepConfig builder.
 * @throws Error if the x scale or its range function is missing
 */
function getXScaleRangeInfo(builder: UPlotConfigBuilder): {
  range: uPlot.Range.Function;
  scaleKey: string;
} {
  const xScale = builder.scales.find((s) => s.props.scaleKey === 'x');
  const range = xScale?.props.range;
  const scaleKey = xScale?.props.scaleKey ?? '';
  if (typeof range !== 'function' || !scaleKey) {
    throw new Error('Expected x scale with range function');
  }
  return { range, scaleKey };
}

/**
 * Extracts the y-scale range function and scale key from a prepConfig builder.
 * @throws Error if the y scale or its range function is missing
 */
function getYScaleRangeInfo(builder: UPlotConfigBuilder): {
  range: uPlot.Range.Function;
  scaleKey: string;
} {
  const yScale = builder.scales.find((s) => s.props.scaleKey.startsWith('y_'));
  const range = yScale?.props.range;
  const scaleKey = yScale?.props.scaleKey ?? '';
  if (typeof range !== 'function' || !scaleKey) {
    throw new Error('Expected y scale with range function');
  }
  return { range, scaleKey };
}

/**
 * Creates a uPlot.orient mock that invokes the draw callback with the given data and scales.
 * Used by heatmap path builder tests (dense, sparse, and points).
 */
function createOrientMock(
  data: SparseHeatmap | DenseHeatmap | PointsData,
  config: {
    scaleX?: Partial<uPlot.Scale>;
    scaleY?: Partial<uPlot.Scale>;
    rect?: jest.Mock;
    valToPosX?: (v: number) => number;
    valToPosY?: (v: number) => number;
  } = {}
) {
  const rect = config.rect ?? jest.fn();
  const scaleX: uPlot.Scale = { distr: 1, min: 0, max: 2000, log: 2, ...config.scaleX };
  const scaleY: uPlot.Scale = { distr: 1, min: 0, max: 2, log: 2, ...config.scaleY };
  const valToPos = (v: number) => v;
  const valToPosX = config.valToPosX ?? valToPos;
  const valToPosY = config.valToPosY ?? valToPos;

  return (u: uPlot, seriesIdx: number, drawCallback: uPlot.OrientCallback) => {
    drawCallback(
      {},
      data[0],
      data[1],
      scaleX,
      scaleY,
      valToPosX,
      valToPosY,
      0,
      0,
      100,
      100,
      jest.fn(),
      jest.fn(),
      rect,
      jest.fn(),
      jest.fn()
    );
  };
}

/**
 * Extracts the y-axis splits and values callbacks from a prepConfig builder (ordinal y-axis only).
 */
function getYAxisSplitsAndValues(builder: UPlotConfigBuilder): {
  splits: uPlot.Axis.Splits;
  values: uPlot.Axis.Values;
  scaleKey: string;
} | null {
  const config = builder.getConfig();
  const yScale = builder.scales.find((s) => s.props.scaleKey.startsWith('y_'));
  const scaleKey = yScale?.props.scaleKey ?? '';
  if (!scaleKey) {
    return null;
  }
  const axis = config.axes?.find((a) => a.scale === scaleKey);
  if (!axis?.splits || !axis?.values) {
    return null;
  }
  return { splits: axis.splits, values: axis.values, scaleKey };
}

describe('prepConfig', () => {
  const theme = createTheme();
  const timeRange = { from: dateTime(1000), to: dateTime(3000), raw: { from: 'now-1h', to: 'now' } };

  /**
   * Creates minimal HeatmapData for prepConfig tests.
   * Dense heatmap cells: x, y, count with 3x3 grid.
   */
  function createMinimalHeatmapData(overrides?: Partial<HeatmapData>): HeatmapData {
    const heatmap = createDataFrame({
      meta: { type: DataFrameType.HeatmapCells },
      fields: [
        { name: 'x', type: FieldType.time, values: [1000, 1000, 1000, 2000, 2000, 2000, 3000, 3000, 3000] },
        { name: 'y', type: FieldType.number, values: [0, 1, 2, 0, 1, 2, 0, 1, 2] },
        { name: 'count', type: FieldType.number, values: [5, 10, 15, 10, 20, 25, 15, 20, 30] },
      ],
    });

    return {
      heatmap,
      ...overrides,
    };
  }

  it('returns UPlotConfigBuilder for valid heatmap data', () => {
    const dataRef = { current: createMinimalHeatmapData() };

    const builder = prepConfig({
      dataRef,
      theme,
      timeZone: 'utc',
      getTimeRange: () => timeRange,
      exemplarColor: 'rgba(255,0,255,0.7)',
      yAxisConfig: { axisPlacement: AxisPlacement.Left },
    });

    expect(builder).toBeDefined();
    expect(builder.addScale).toBeDefined();
    expect(builder.addAxis).toBeDefined();
    expect(builder.addSeries).toBeDefined();
  });

  it('returns builder early when heatmap has no y field', () => {
    const heatmap = createDataFrame({
      meta: { type: DataFrameType.HeatmapCells },
      fields: [{ name: 'x', type: FieldType.time, values: [1000, 2000] }],
    });
    const dataRef = {
      current: {
        heatmap,
      },
    };

    const builder = prepConfig({
      dataRef,
      theme,
      timeZone: 'utc',
      getTimeRange: () => timeRange,
      exemplarColor: 'rgba(255,0,255,0.7)',
      yAxisConfig: { axisPlacement: AxisPlacement.Left },
    });

    expect(builder).toBeDefined();
  });

  it('uses isTime=false when first field is not time', () => {
    const heatmap = createDataFrame({
      meta: { type: DataFrameType.HeatmapCells },
      fields: [
        { name: 'x', type: FieldType.number, values: [1, 2, 3] },
        { name: 'y', type: FieldType.number, values: [0, 1, 2] },
        { name: 'count', type: FieldType.number, values: [5, 10, 15] },
      ],
    });
    const dataRef = {
      current: {
        heatmap,
      },
    };

    const builder = prepConfig({
      dataRef,
      theme,
      timeZone: 'utc',
      getTimeRange: () => timeRange,
      exemplarColor: 'rgba(255,0,255,0.7)',
      yAxisConfig: { axisPlacement: AxisPlacement.Left },
    });

    expect(builder).toBeDefined();
  });

  it('accepts optional cellGap, hideLE, hideGE, selectionMode, rowsFrame', () => {
    const dataRef = { current: createMinimalHeatmapData() };

    const builder = prepConfig({
      dataRef,
      theme,
      timeZone: 'utc',
      getTimeRange: () => timeRange,
      exemplarColor: 'red',
      yAxisConfig: { axisPlacement: AxisPlacement.Left },
      cellGap: 2,
      hideLE: 0,
      hideGE: 100,
      selectionMode: HeatmapSelectionMode.Xy,
      rowsFrame: { yBucketScale: { type: ScaleDistribution.Log, log: 2 } },
    });

    expect(builder).toBeDefined();
  });

  describe('x-scale range callback', () => {
    it('returns time range when x-axis is time (isTime=true)', () => {
      const dataRef = { current: createMinimalHeatmapData() };
      const builder = prepConfig({
        dataRef,
        theme,
        timeZone: 'utc',
        getTimeRange: () => timeRange,
        exemplarColor: 'red',
        yAxisConfig: { axisPlacement: AxisPlacement.Left },
      });
      const { range, scaleKey } = getXScaleRangeInfo(builder);
      const u = createMinimalUPlot(scaleKey);
      const result = range(u, 0, 1, scaleKey);
      expect(result[0]).toBe(1000);
      expect(result[1]).toBe(3000);
    });

    /**
     * Creates minimal HeatmapData with numeric x-axis (isTime=false) for x-scale range tests.
     */
    function createNonTimeHeatmapData(overrides?: Partial<HeatmapData>): HeatmapData {
      const heatmap = createDataFrame({
        meta: { type: DataFrameType.HeatmapCells },
        fields: [
          { name: 'x', type: FieldType.number, values: [1, 2, 3] },
          { name: 'y', type: FieldType.number, values: [0, 1, 2] },
          { name: 'count', type: FieldType.number, values: [5, 10, 15] },
        ],
      });
      return {
        heatmap,
        xBucketSize: 2,
        ...overrides,
      };
    }

    it('returns [dataMin - xBucketSize, dataMax] for le xLayout', () => {
      const dataRef = {
        current: createNonTimeHeatmapData({ xLayout: HeatmapCellLayout.le, xBucketSize: 4 }),
      };
      const builder = prepConfig({
        dataRef,
        theme,
        timeZone: 'utc',
        getTimeRange: () => timeRange,
        exemplarColor: 'red',
        yAxisConfig: { axisPlacement: AxisPlacement.Left },
      });
      const { range, scaleKey } = getXScaleRangeInfo(builder);
      const u = createMinimalUPlot(scaleKey);
      const result = range(u, 10, 20, scaleKey);
      expect(result[0]).toBe(6);
      expect(result[1]).toBe(20);
    });

    it('returns [dataMin, dataMax + xBucketSize] for ge xLayout', () => {
      const dataRef = {
        current: createNonTimeHeatmapData({ xLayout: HeatmapCellLayout.ge, xBucketSize: 4 }),
      };
      const builder = prepConfig({
        dataRef,
        theme,
        timeZone: 'utc',
        getTimeRange: () => timeRange,
        exemplarColor: 'red',
        yAxisConfig: { axisPlacement: AxisPlacement.Left },
      });
      const { range, scaleKey } = getXScaleRangeInfo(builder);
      const u = createMinimalUPlot(scaleKey);
      const result = range(u, 10, 20, scaleKey);
      expect(result[0]).toBe(10);
      expect(result[1]).toBe(24);
    });

    it('returns [dataMin - offset, dataMax + offset] for unknown xLayout (offset = xBucketSize/2)', () => {
      const dataRef = {
        current: createNonTimeHeatmapData({ xLayout: HeatmapCellLayout.unknown, xBucketSize: 4 }),
      };
      const builder = prepConfig({
        dataRef,
        theme,
        timeZone: 'utc',
        getTimeRange: () => timeRange,
        exemplarColor: 'red',
        yAxisConfig: { axisPlacement: AxisPlacement.Left },
      });
      const { range, scaleKey } = getXScaleRangeInfo(builder);
      const u = createMinimalUPlot(scaleKey);
      const result = range(u, 10, 20, scaleKey);
      expect(result[0]).toBe(8);
      expect(result[1]).toBe(22);
    });
  });

  describe('y-scale range callback', () => {
    /**
     * Creates minimal sparse HeatmapData (yMin + yMax fields) for range callback tests.
     */
    function createSparseHeatmapData(overrides?: Partial<HeatmapData>): HeatmapData {
      const heatmap = createDataFrame({
        meta: { type: DataFrameType.HeatmapCells },
        fields: [
          { name: 'x', type: FieldType.time, values: [1000, 1000, 2000, 2000] },
          { name: 'yMin', type: FieldType.number, values: [1, 4, 1, 4] },
          { name: 'yMax', type: FieldType.number, values: [4, 16, 4, 16] },
          { name: 'count', type: FieldType.number, values: [5, 10, 15, 20] },
        ],
      });
      return {
        heatmap,
        ...overrides,
      };
    }

    describe('sparse heatmap', () => {
      const sparseData: uPlot.AlignedData = [
        [0, 1, 2],
        [0, 1, 4, 16],
        [0, 5, 16, 64],
      ];

      it('expands dataMax by bucket factor from yMin/yMax and applies explicit min/max', () => {
        const dataRef = { current: createSparseHeatmapData() };
        const builder = prepConfig({
          dataRef,
          theme,
          timeZone: 'utc',
          getTimeRange: () => timeRange,
          exemplarColor: 'red',
          yAxisConfig: { axisPlacement: AxisPlacement.Left, min: 2, max: 64 },
          rowsFrame: { yBucketScale: { type: ScaleDistribution.Linear } },
        });
        const { range, scaleKey } = getYScaleRangeInfo(builder);
        const u = createMinimalUPlot(scaleKey, { data: sparseData });
        const result = range(u, 1, 16, scaleKey);
        expect(result[0]).toBe(2);
        expect(result[1]).toBe(64);
      });

      it('uses uPlot.rangeLog for sparse log scale and snaps explicit min/max to magnitude', () => {
        const dataRef = { current: createSparseHeatmapData() };
        const builder = prepConfig({
          dataRef,
          theme,
          timeZone: 'utc',
          getTimeRange: () => timeRange,
          exemplarColor: 'red',
          yAxisConfig: { axisPlacement: AxisPlacement.Left, min: 2, max: 64 },
          rowsFrame: { yBucketScale: { type: ScaleDistribution.Log, log: 2 } },
        });
        const { range, scaleKey } = getYScaleRangeInfo(builder);
        const u = createMinimalUPlot(scaleKey, { data: sparseData, log: 2 });
        const result = range(u, 1, 64, scaleKey);
        expect(result[0]).toEqual(2);
        expect(result[1]).toEqual(64);
      });
    });

    describe('dense heatmap', () => {
      it('expands linear range by yBucketSize/2 for unknown yLayout', () => {
        const dataRef = { current: createMinimalHeatmapData({ yBucketSize: 2, yLayout: HeatmapCellLayout.unknown }) };
        const builder = prepConfig({
          dataRef,
          theme,
          timeZone: 'utc',
          getTimeRange: () => timeRange,
          exemplarColor: 'red',
          yAxisConfig: { axisPlacement: AxisPlacement.Left },
        });
        const { range, scaleKey } = getYScaleRangeInfo(builder);
        const u = createMinimalUPlot(scaleKey);
        const result = range(u, 0, 2, scaleKey);
        expect(result[0]).toBe(-1);
        expect(result[1]).toBe(3);
      });

      it('expands linear range by full yBucketSize for le yLayout', () => {
        const dataRef = { current: createMinimalHeatmapData({ yBucketSize: 2, yLayout: HeatmapCellLayout.le }) };
        const builder = prepConfig({
          dataRef,
          theme,
          timeZone: 'utc',
          getTimeRange: () => timeRange,
          exemplarColor: 'red',
          yAxisConfig: { axisPlacement: AxisPlacement.Left },
        });
        const { range, scaleKey } = getYScaleRangeInfo(builder);
        const u = createMinimalUPlot(scaleKey);
        const result = range(u, 2, 8, scaleKey);
        expect(result[0]).toBe(0);
        expect(result[1]).toBe(8);
      });

      it('expands linear range by full yBucketSize for ge yLayout', () => {
        const dataRef = { current: createMinimalHeatmapData({ yBucketSize: 2, yLayout: HeatmapCellLayout.ge }) };
        const builder = prepConfig({
          dataRef,
          theme,
          timeZone: 'utc',
          getTimeRange: () => timeRange,
          exemplarColor: 'red',
          yAxisConfig: { axisPlacement: AxisPlacement.Left },
        });
        const { range, scaleKey } = getYScaleRangeInfo(builder);
        const u = createMinimalUPlot(scaleKey);
        const result = range(u, 2, 8, scaleKey);
        expect(result[0]).toBe(2);
        expect(result[1]).toBe(10);
      });

      it('applies explicit min/max for linear scale', () => {
        const dataRef = { current: createMinimalHeatmapData({ yBucketSize: 1, yLayout: HeatmapCellLayout.unknown }) };
        const builder = prepConfig({
          dataRef,
          theme,
          timeZone: 'utc',
          getTimeRange: () => timeRange,
          exemplarColor: 'red',
          yAxisConfig: { axisPlacement: AxisPlacement.Left, min: 0, max: 100 },
        });
        const { range, scaleKey } = getYScaleRangeInfo(builder);
        const u = createMinimalUPlot(scaleKey);
        const result = range(u, 1, 2, scaleKey);
        expect(result[0]).toBe(0);
        expect(result[1]).toBe(100);
      });

      it('expands log range by sqrt(factor) for unknown yLayout', () => {
        const dataRef = { current: createMinimalHeatmapData({ yLayout: HeatmapCellLayout.unknown }) };
        const builder = prepConfig({
          dataRef,
          theme,
          timeZone: 'utc',
          getTimeRange: () => timeRange,
          exemplarColor: 'red',
          yAxisConfig: { axisPlacement: AxisPlacement.Left },
          rowsFrame: { yBucketScale: { type: ScaleDistribution.Log, log: 2 } },
        });
        const { range, scaleKey } = getYScaleRangeInfo(builder);
        const u = createMinimalUPlot(scaleKey, { log: 2 });
        const result = range(u, 1, 4, scaleKey);
        expect(result[0]).toEqual(0.7071067811865475);
        expect(result[1]).toEqual(5.656854249492381);
      });

      it('expands log range by dividing scaleMin for le yLayout', () => {
        const dataRef = { current: createMinimalHeatmapData({ yLayout: HeatmapCellLayout.le }) };
        const builder = prepConfig({
          dataRef,
          theme,
          timeZone: 'utc',
          getTimeRange: () => timeRange,
          exemplarColor: 'red',
          yAxisConfig: { axisPlacement: AxisPlacement.Left },
          rowsFrame: { yBucketScale: { type: ScaleDistribution.Log, log: 2 } },
        });
        const { range, scaleKey } = getYScaleRangeInfo(builder);
        const u = createMinimalUPlot(scaleKey, { log: 2 });
        const result = range(u, 2, 8, scaleKey);
        expect(result[0]).toEqual(1);
        expect(result[1]).toEqual(8);
      });

      it('expands log range by multiplying scaleMax for ge yLayout', () => {
        const dataRef = { current: createMinimalHeatmapData({ yLayout: HeatmapCellLayout.ge }) };
        const builder = prepConfig({
          dataRef,
          theme,
          timeZone: 'utc',
          getTimeRange: () => timeRange,
          exemplarColor: 'red',
          yAxisConfig: { axisPlacement: AxisPlacement.Left },
          rowsFrame: { yBucketScale: { type: ScaleDistribution.Log, log: 2 } },
        });
        const { range, scaleKey } = getYScaleRangeInfo(builder);
        const u = createMinimalUPlot(scaleKey, { log: 2 });
        const result = range(u, 2, 8, scaleKey);
        expect(result[0]).toBe(2);
        expect(result[1]).toEqual(16);
      });

      it('uses calculateBucketFactor from yValues when yBucketScale is provided', () => {
        const dataRef = { current: createMinimalHeatmapData({ yLayout: HeatmapCellLayout.le }) };
        const builder = prepConfig({
          dataRef,
          theme,
          timeZone: 'utc',
          getTimeRange: () => timeRange,
          exemplarColor: 'red',
          yAxisConfig: { axisPlacement: AxisPlacement.Left },
          rowsFrame: { yBucketScale: { type: ScaleDistribution.Log, log: 2 } },
        });
        const { range, scaleKey } = getYScaleRangeInfo(builder);
        const denseDataWithYValues: uPlot.AlignedData = [
          [0, 1, 2, 3, 4],
          [0, 1, 2, 4, 8],
        ];
        const u = createMinimalUPlot(scaleKey, { data: denseDataWithYValues, log: 2 });
        const result = range(u, 1, 8, scaleKey);
        expect(result[0]).toEqual(0.5);
        expect(result[1]).toEqual(8);
      });

      it('snaps to log magnitude when ySizeDivisor is set and dataMin/dataMax are non-integer log', () => {
        const dataRef = { current: createMinimalHeatmapData({ yLayout: HeatmapCellLayout.unknown }) };
        const builder = prepConfig({
          dataRef,
          theme,
          timeZone: 'utc',
          getTimeRange: () => timeRange,
          exemplarColor: 'red',
          yAxisConfig: { axisPlacement: AxisPlacement.Left },
          ySizeDivisor: 2,
          rowsFrame: { yBucketScale: { type: ScaleDistribution.Log, log: 2 } },
        });
        const { range, scaleKey } = getYScaleRangeInfo(builder);
        const u = createMinimalUPlot(scaleKey, { log: 2 });
        const result = range(u, 3, 6, scaleKey);
        expect(result[0]).toEqual(1.414213562373095);
        expect(result[1]).toEqual(11.313708498984761);
      });

      it('applies explicit min/max for log scale snapping to magnitude', () => {
        const dataRef = { current: createMinimalHeatmapData({ yLayout: HeatmapCellLayout.unknown }) };
        const builder = prepConfig({
          dataRef,
          theme,
          timeZone: 'utc',
          getTimeRange: () => timeRange,
          exemplarColor: 'red',
          yAxisConfig: { axisPlacement: AxisPlacement.Left, min: 4, max: 32 },
          rowsFrame: { yBucketScale: { type: ScaleDistribution.Log, log: 2 } },
        });
        const { range, scaleKey } = getYScaleRangeInfo(builder);
        const u = createMinimalUPlot(scaleKey, { log: 2 });
        const result = range(u, 1, 16, scaleKey);
        expect(result[0]).toEqual(4);
        expect(result[1]).toEqual(32);
      });

      it('skips expansion when bucketSize is undefined', () => {
        const dataRef = {
          current: createMinimalHeatmapData({
            yBucketSize: undefined,
            yLayout: HeatmapCellLayout.unknown,
          }),
        };
        const builder = prepConfig({
          dataRef,
          theme,
          timeZone: 'utc',
          getTimeRange: () => timeRange,
          exemplarColor: 'red',
          yAxisConfig: { axisPlacement: AxisPlacement.Left },
        });
        const { range, scaleKey } = getYScaleRangeInfo(builder);
        const u = createMinimalUPlot(scaleKey);
        const result = range(u, 1, 2, scaleKey);
        expect(result[0]).toBe(1);
        expect(result[1]).toBe(2);
      });
    });
  });

  describe('ordinal y-axis splits and values', () => {
    /**
     * Creates HeatmapData with ordinal y display (meta.custom.yOrdinalDisplay).
     * Used to exercise the splits and values callbacks for ordinalY (index) on the y-axis
     */
    function createOrdinalHeatmapData(overrides?: Partial<HeatmapData>): HeatmapData {
      const heatmap = createDataFrame({
        meta: {
          type: DataFrameType.HeatmapCells,
          custom: {
            yOrdinalDisplay: ['0.005', '0.01', '0.025', '0.05', '0.1', '0.25', '0.5', '1', '2.5', '5'],
          },
        },
        fields: [
          { name: 'x', type: FieldType.time, values: [1000, 1000, 1000, 2000, 2000, 2000] },
          { name: 'y', type: FieldType.number, values: [0, 1, 2, 0, 1, 2] },
          { name: 'count', type: FieldType.number, values: [5, 10, 15, 10, 20, 25] },
        ],
      });
      return {
        heatmap,
        ...overrides,
      };
    }

    it('splits returns [0, 1] when yOrdinalDisplay is missing', () => {
      const heatmap = createDataFrame({
        meta: { type: DataFrameType.HeatmapCells, custom: {} },
        fields: [
          { name: 'x', type: FieldType.time, values: [1000, 2000] },
          { name: 'y', type: FieldType.number, values: [0, 1] },
          { name: 'count', type: FieldType.number, values: [5, 10] },
        ],
      });
      const dataRef = {
        current: {
          heatmap,
        },
      };
      if (heatmap.meta) {
        heatmap.meta.custom = { yOrdinalDisplay: ['A', 'B'] };
      }
      const builder = prepConfig({
        dataRef,
        theme,
        timeZone: 'utc',
        getTimeRange: () => timeRange,
        exemplarColor: 'red',
        yAxisConfig: { axisPlacement: AxisPlacement.Left },
      });
      const info = getYAxisSplitsAndValues(builder);
      expect(info).not.toBeNull();
      if (!info) {
        throw new Error('Expected info');
      }
      if (heatmap.meta) {
        heatmap.meta.custom = {};
      }
      const u = createMinimalUPlot(info.scaleKey, { height: 100 });
      if (typeof info.splits !== 'function') {
        throw new Error('Expected splits to be a function');
      }
      const splits = info.splits(u, 0, 0, 1, 0, 0);
      expect(splits).toEqual([0, 1]);
    });

    it('splits returns indices for unknown yLayout', () => {
      const dataRef = { current: createOrdinalHeatmapData({ yLayout: HeatmapCellLayout.unknown }) };
      const builder = prepConfig({
        dataRef,
        theme,
        timeZone: 'utc',
        getTimeRange: () => timeRange,
        exemplarColor: 'red',
        yAxisConfig: { axisPlacement: AxisPlacement.Left },
      });
      const info = getYAxisSplitsAndValues(builder);
      expect(info).not.toBeNull();
      if (!info) {
        throw new Error('Expected info');
      }
      const u = createMinimalUPlot(info.scaleKey, { height: 200 });
      if (typeof info.splits !== 'function') {
        throw new Error('Expected splits to be a function');
      }
      const splits = info.splits(u, 0, 0, 1, 0, 0);
      expect(splits).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('splits unshifts -1 for le yLayout', () => {
      const dataRef = { current: createOrdinalHeatmapData({ yLayout: HeatmapCellLayout.le }) };
      const builder = prepConfig({
        dataRef,
        theme,
        timeZone: 'utc',
        getTimeRange: () => timeRange,
        exemplarColor: 'red',
        yAxisConfig: { axisPlacement: AxisPlacement.Left },
      });
      const info = getYAxisSplitsAndValues(builder);
      expect(info).not.toBeNull();
      if (!info) {
        throw new Error('Expected info');
      }
      const u = createMinimalUPlot(info.scaleKey, { height: 200 });
      if (typeof info.splits !== 'function') {
        throw new Error('Expected splits to be a function');
      }
      const splits = info.splits(u, 0, 0, 1, 0, 0);
      expect(splits[0]).toBe(-1);
      expect(splits).toContain(0);
      expect(splits).toContain(9);
    });

    it('splits pushes length for ge yLayout', () => {
      const dataRef = { current: createOrdinalHeatmapData({ yLayout: HeatmapCellLayout.ge }) };
      const builder = prepConfig({
        dataRef,
        theme,
        timeZone: 'utc',
        getTimeRange: () => timeRange,
        exemplarColor: 'red',
        yAxisConfig: { axisPlacement: AxisPlacement.Left },
      });
      const info = getYAxisSplitsAndValues(builder);
      expect(info).not.toBeNull();
      if (!info) {
        throw new Error('Expected info');
      }
      const u = createMinimalUPlot(info.scaleKey, { height: 200 });
      if (typeof info.splits !== 'function') {
        throw new Error('Expected splits to be a function');
      }
      const splits = info.splits(u, 0, 0, 1, 0, 0);
      expect(splits[splits.length - 1]).toBe(10);
      expect(splits).toContain(0);
      expect(splits).toContain(9);
    });

    it('splits returns only first and last when height < 60', () => {
      const dataRef = { current: createOrdinalHeatmapData() };
      const builder = prepConfig({
        dataRef,
        theme,
        timeZone: 'utc',
        getTimeRange: () => timeRange,
        exemplarColor: 'red',
        yAxisConfig: { axisPlacement: AxisPlacement.Left },
      });
      const info = getYAxisSplitsAndValues(builder);
      expect(info).not.toBeNull();
      if (!info) {
        throw new Error('Expected info');
      }
      const u = createMinimalUPlot(info.scaleKey, { height: 50 });
      if (typeof info.splits !== 'function') {
        throw new Error('Expected splits to be a function');
      }
      const splits = info.splits(u, 0, 0, 1, 0, 0);
      expect(splits).toEqual([0, 9]);
    });

    it('splits thins when (height - 15) / splits.length < 10', () => {
      const dataRef = { current: createOrdinalHeatmapData() };
      const builder = prepConfig({
        dataRef,
        theme,
        timeZone: 'utc',
        getTimeRange: () => timeRange,
        exemplarColor: 'red',
        yAxisConfig: { axisPlacement: AxisPlacement.Left },
      });
      const info = getYAxisSplitsAndValues(builder);
      expect(info).not.toBeNull();
      if (!info) {
        throw new Error('Expected info');
      }
      const u = createMinimalUPlot(info.scaleKey, { height: 100 });
      if (typeof info.splits !== 'function') {
        throw new Error('Expected splits to be a function');
      }
      const splits = info.splits(u, 0, 0, 1, 0, 0);
      expect(splits.length).toBeLessThan(10);
      expect(splits.length).toBeGreaterThan(2);
    });

    it('values maps splits to yOrdinalDisplay labels', () => {
      const dataRef = { current: createOrdinalHeatmapData() };
      const builder = prepConfig({
        dataRef,
        theme,
        timeZone: 'utc',
        getTimeRange: () => timeRange,
        exemplarColor: 'red',
        yAxisConfig: { axisPlacement: AxisPlacement.Left },
      });
      const info = getYAxisSplitsAndValues(builder);
      expect(info).not.toBeNull();
      if (!info) {
        throw new Error('Expected info');
      }
      const u = createMinimalUPlot(info.scaleKey, { height: 200 });
      if (typeof info.splits !== 'function') {
        throw new Error('Expected splits to be a function');
      }
      const splits = info.splits(u, 0, 0, 1, 0, 0);
      if (typeof info.values !== 'function') {
        throw new Error('Expected values to be a function');
      }
      const values = info.values(u, splits, 0, 0, 0);
      expect(values[0]).toBe('0.005');
      expect(values[values.length - 1]).toBe('5');
    });

    it('values returns yMinDisplay for v < 0 (Prometheus le style)', () => {
      const heatmap = createDataFrame({
        meta: {
          type: DataFrameType.HeatmapCells,
          custom: {
            yOrdinalDisplay: ['0.005', '0.01', '0.05'],
            yMinDisplay: '0.0',
          },
        },
        fields: [
          { name: 'x', type: FieldType.time, values: [1000, 2000] },
          { name: 'yMax', type: FieldType.number, values: [0, 1, 2, 0, 1, 2] },
          { name: 'count', type: FieldType.number, values: [5, 10, 15, 10, 20, 25] },
        ],
      });
      const dataRef = {
        current: {
          heatmap,
        },
      };
      const builder = prepConfig({
        dataRef,
        theme,
        timeZone: 'utc',
        getTimeRange: () => timeRange,
        exemplarColor: 'red',
        yAxisConfig: { axisPlacement: AxisPlacement.Left },
      });
      const info = getYAxisSplitsAndValues(builder);
      expect(info).not.toBeNull();
      if (!info) {
        throw new Error('Expected info');
      }
      const u = createMinimalUPlot(info.scaleKey, { height: 100 });
      if (typeof info.values !== 'function') {
        throw new Error('Expected values to be a function');
      }
      const values = info.values(u, [-1, 0, 1, 2], 0, 0, 0);
      expect(values[0]).toBe('0.0');
      expect(values[1]).toBe('0.005');
    });

    it('values returns splits when yOrdinalDisplay is missing', () => {
      const heatmap = createDataFrame({
        meta: { type: DataFrameType.HeatmapCells, custom: { yOrdinalDisplay: ['A', 'B'] } },
        fields: [
          { name: 'x', type: FieldType.time, values: [1000, 2000] },
          { name: 'y', type: FieldType.number, values: [0, 1] },
          { name: 'count', type: FieldType.number, values: [5, 10] },
        ],
      });
      const dataRef = {
        current: {
          heatmap,
        },
      };
      const builder = prepConfig({
        dataRef,
        theme,
        timeZone: 'utc',
        getTimeRange: () => timeRange,
        exemplarColor: 'red',
        yAxisConfig: { axisPlacement: AxisPlacement.Left },
      });
      const info = getYAxisSplitsAndValues(builder);
      expect(info).not.toBeNull();
      if (!info) {
        throw new Error('Expected info');
      }
      if (heatmap.meta) {
        heatmap.meta.custom = {};
      }
      const u = createMinimalUPlot(info.scaleKey, { height: 100 });
      if (typeof info.values !== 'function') {
        throw new Error('Expected values to be a function');
      }
      const values = info.values(u, [0, 1], 0, 0, 0);
      expect(values).toEqual([0, 1]);
    });
  });

  describe('cursor (dataIdx, focus.dist, points.bbox)', () => {
    const denseHeatmapData: DenseHeatmap = [
      [1000, 1000, 1000, 2000, 2000, 2000, 3000, 3000, 3000],
      [0, 1, 2, 0, 1, 2, 0, 1, 2],
      [5, 10, 15, 10, 20, 25, 15, 20, 30],
    ];

    const originalDevicePixelRatio = global.devicePixelRatio;
    beforeEach(() => {
      Object.defineProperty(global, 'devicePixelRatio', { value: 1, configurable: true });
    });
    afterEach(() => {
      Object.defineProperty(global, 'devicePixelRatio', { value: originalDevicePixelRatio, configurable: true });
    });

    /**
     * Creates HeatmapData with heatmapColors for cursor tests.
     * Uses valToPos mapping 0-3000 -> 0-100 (x) and 0-2 -> 0-100 (y) so rects fall in qt (0,0,100,100).
     */
    function createHeatmapDataForCursor(): HeatmapData {
      return {
        ...createMinimalHeatmapData(),
        heatmapColors: {
          values: [0, 1, 2, 0, 1, 2, 0, 1, 2],
          palette: ['#000', '#333', '#666'],
          minValue: 5,
          maxValue: 30,
        },
      };
    }

    /**
     * Builds prepConfig for cursor tests and returns the cursor config.
     * @param selectionMode - Optional selection mode override
     */
    function buildCursorConfig(selectionMode?: HeatmapSelectionMode) {
      const dataRef = { current: createHeatmapDataForCursor() };
      const builder = prepConfig({
        dataRef,
        theme,
        timeZone: 'utc',
        getTimeRange: () => timeRange,
        exemplarColor: 'rgba(255,0,255,0.7)',
        yAxisConfig: { axisPlacement: AxisPlacement.Left },
        selectionMode,
      });
      const cursor = builder.getConfig().cursor;
      if (!cursor) {
        throw new Error('Expected cursor config');
      }
      return cursor;
    }

    /**
     * Creates a prepConfig builder with cursor-test heatmap data, populates the internal
     * quadtree via mocked uPlot.orient, and returns the cursor config + mock uPlot.
     */
    function buildCursorWithQuadtree() {
      const dataRef = { current: createHeatmapDataForCursor() };
      const builder = prepConfig({
        dataRef,
        theme,
        timeZone: 'utc',
        getTimeRange: () => timeRange,
        exemplarColor: 'rgba(255,0,255,0.7)',
        yAxisConfig: { axisPlacement: AxisPlacement.Left },
      });

      const config = builder.getConfig();
      const drawClearHook = config.hooks?.drawClear?.[0];
      const heatmapPathBuilder = config.series?.[1]?.paths;
      const cursor = config.cursor;

      if (!drawClearHook || !heatmapPathBuilder || !cursor) {
        throw new Error('Expected drawClear, heatmap paths, and cursor');
      }

      const mockU = createMockU(denseHeatmapData);
      Object.assign(mockU, {
        data: { 1: denseHeatmapData },
        bbox: { left: 0, top: 0, width: 100, height: 100 },
        cursor: { left: 60, top: 50 },
        series: [{}, {}, {}],
      });

      const orientSpy = jest.spyOn(uPlot, 'orient').mockImplementation(
        createOrientMock(denseHeatmapData, {
          scaleX: { min: 0, max: 3000 },
          scaleY: { min: 0, max: 2 },
          valToPosX: (v) => (v / 3000) * 100,
          valToPosY: (v) => (v / 2) * 100,
        })
      );

      drawClearHook(mockU);
      heatmapPathBuilder(mockU, 1, 0, 9);
      orientSpy.mockRestore();

      return { cursor, mockU };
    }

    it('returns dataIdx from quadtree when cursor is over a cell (seriesIdx 1)', () => {
      const { cursor, mockU } = buildCursorWithQuadtree();

      if (!cursor.dataIdx) {
        throw new Error('Expected cursor.dataIdx');
      }

      const dataIdx = cursor.dataIdx(mockU, 1, 0, 1500);
      expect(typeof dataIdx).toBe('number');
      expect(dataIdx).toBeGreaterThanOrEqual(0);
      expect(dataIdx).toBeLessThan(9);
    });

    it('returns null from dataIdx when seriesIdx is not 1', () => {
      const cursor = buildCursorConfig();

      if (!cursor.dataIdx) {
        throw new Error('Expected cursor.dataIdx');
      }

      // @ts-expect-error partial mock — only cursor position needed
      const mockU: uPlot = { cursor: { left: 60, top: 50 } };

      expect(cursor.dataIdx(mockU, 0, 0, 0)).toBeNull();
    });

    it('focus.dist returns 0 when hRect matches seriesIdx, Infinity otherwise', () => {
      const { cursor, mockU } = buildCursorWithQuadtree();

      if (!cursor.dataIdx || !cursor.focus?.dist) {
        throw new Error('Expected cursor.dataIdx and cursor.focus.dist');
      }

      cursor.dataIdx(mockU, 1, 0, 1500);

      expect(cursor.focus.dist(mockU, 1, 0, 0, 0)).toBe(0);
      expect(cursor.focus.dist(mockU, 2, 0, 0, 0)).toBe(Infinity);
    });

    it('points.bbox returns rect when hovered, off-canvas when not', () => {
      const { cursor, mockU } = buildCursorWithQuadtree();

      if (!cursor.dataIdx || !cursor.points?.bbox) {
        throw new Error('Expected cursor.dataIdx and cursor.points.bbox');
      }

      cursor.dataIdx(mockU, 1, 0, 1500);

      const bboxResult = cursor.points.bbox(mockU, 1);
      expect(bboxResult).toMatchObject({
        left: expect.any(Number),
        top: expect.any(Number),
        width: expect.any(Number),
        height: expect.any(Number),
      });
      expect(bboxResult.left).toBeGreaterThanOrEqual(-10);
      expect(bboxResult.top).toBeGreaterThanOrEqual(-10);

      const bboxNotHovered = cursor.points.bbox(mockU, 2);
      expect(bboxNotHovered).toMatchObject({ left: -10, top: -10, width: 0, height: 0 });
    });

    it('cursor.drag reflects selectionMode (X, Y, Xy)', () => {
      expect(buildCursorConfig(HeatmapSelectionMode.X).drag).toMatchObject({ x: true, y: false });
      expect(buildCursorConfig(HeatmapSelectionMode.Y).drag).toMatchObject({ x: false, y: true });
      expect(buildCursorConfig(HeatmapSelectionMode.Xy).drag).toMatchObject({ x: true, y: true });
    });
  });
});

describe('heatmapPathsDense', () => {
  const fillIndex: Array<CanvasRenderingContext2D['fillStyle']> = ['#000'];
  const minimalPathbuilderOpts = {
    each: jest.fn(),
    disp: {
      fill: {
        values: () => [0],
        index: fillIndex,
      },
    },
  };

  it('returns a path builder function', () => {
    const pathBuilder = heatmapPathsDense(minimalPathbuilderOpts);
    expect(typeof pathBuilder).toBe('function');
    expect(pathBuilder.length).toBe(2); // (u, seriesIdx)
  });

  it('accepts optional gap, hideLE, hideGE, xAlign, yAlign, ySizeDivisor', () => {
    const pathBuilder = heatmapPathsDense({
      ...minimalPathbuilderOpts,
      gap: 2,
      hideLE: 0,
      hideGE: 100,
      xAlign: 0,
      yAlign: -1,
      ySizeDivisor: 2,
    });
    expect(typeof pathBuilder).toBe('function');
  });

  describe('draws and fills dense heatmap grid cells', () => {
    /**
     * Dense heatmap data: 2 columns x 3 rows.
     * xs: [1000, 1000, 1000, 2000, 2000, 2000], ys: [0, 1, 2, 0, 1, 2], counts: [5, 10, 15, 10, 20, 25]
     */
    const denseHeatmapData: DenseHeatmap = [
      [1000, 1000, 1000, 2000, 2000, 2000],
      [0, 1, 2, 0, 1, 2],
      [5, 10, 15, 10, 20, 25],
    ];

    /**
     * Invokes heatmapPathsDense path builder by mocking uPlot.orient to capture and run the draw callback.
     * Returns the rect and each mocks for assertions.
     */
    function invokeDensePathBuilder(
      opts: Parameters<typeof heatmapPathsDense>[0],
      overrides?: {
        data?: SparseHeatmap | DenseHeatmap;
        scaleXDistr?: number;
        scaleYDistr?: number;
        scaleYLog?: 10 | 2;
        ctx?: MockCtx;
      }
    ): { rect: jest.Mock; each: jest.Mock; ctx?: MockCtx } {
      const rect = jest.fn();
      const each = jest.fn();
      const data: SparseHeatmap | DenseHeatmap = overrides?.data ?? denseHeatmapData;
      const pathBuilder = heatmapPathsDense({ ...opts, each });
      const orientSpy = jest.spyOn(uPlot, 'orient').mockImplementation(
        createOrientMock(data, {
          scaleX: overrides?.scaleXDistr != null ? { distr: overrides.scaleXDistr } : undefined,
          scaleY:
            overrides?.scaleYDistr != null || overrides?.scaleYLog != null
              ? {
                  ...(overrides.scaleYDistr != null && { distr: overrides.scaleYDistr }),
                  ...(overrides.scaleYLog != null && { log: overrides.scaleYLog }),
                }
              : undefined,
          rect,
        })
      );
      const mockU = createMockU(data, overrides?.ctx);
      pathBuilder(mockU, 1);
      orientSpy.mockRestore();
      return overrides?.ctx ? { rect, each, ctx: overrides.ctx } : { rect, each };
    }

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('draws rect for each visible cell and calls each callback', () => {
      const { rect, each } = invokeDensePathBuilder({
        ...minimalPathbuilderOpts,
        disp: {
          fill: {
            values: () => [0, 1, 2, 0, 1, 2],
            index: ['#a', '#b', '#c'],
          },
        },
      });
      [
        [1000, -1],
        [1000, 0],
        [1000, 1],
        [2000, -1],
        [2000, 0],
        [2000, 1],
      ].forEach((pair, idx) => {
        expect(rect).toHaveBeenCalledWith(expect.anything(), pair[0], pair[1], 999, 1);
        expect(each).toHaveBeenCalledWith(expect.anything(), 1, idx, pair[0], pair[1], 999, 1);
      });
    });

    it('filters cells by hideLE and hideGE', () => {
      const { rect } = invokeDensePathBuilder({
        ...minimalPathbuilderOpts,
        hideLE: 8,
        hideGE: 22,
        disp: {
          fill: {
            values: () => [0, 1, 2, 0, 1, 2],
            index: ['#a', '#b', '#c'],
          },
        },
      });
      expect(rect).toHaveBeenNthCalledWith(1, expect.anything(), 1000, 0, 999, 1);
      expect(rect).toHaveBeenNthCalledWith(2, expect.anything(), 1000, 1, 999, 1);
      expect(rect).toHaveBeenNthCalledWith(3, expect.anything(), 2000, -1, 999, 1);
    });

    it.each([['#ff0000', '#00ff00', '#0000ff'], undefined])(
      'uses fillPalette from disp.fill.index when provided',
      (palette) => {
        const { rect } = invokeDensePathBuilder({
          ...minimalPathbuilderOpts,
          disp: {
            fill: {
              values: () => [0, 1, 2, 0, 1, 2],
              index: palette as [],
            },
          },
        });
        expect(rect).toHaveBeenNthCalledWith(1, expect.anything(), 1000, -1, 999, 1);
        expect(rect).toHaveBeenNthCalledWith(2, expect.anything(), 1000, 0, 999, 1);
        expect(rect).toHaveBeenNthCalledWith(3, expect.anything(), 1000, 1, 999, 1);
        expect(rect).toHaveBeenNthCalledWith(4, expect.anything(), 2000, -1, 999, 1);
        expect(rect).toHaveBeenNthCalledWith(5, expect.anything(), 2000, 0, 999, 1);
        expect(rect).toHaveBeenNthCalledWith(6, expect.anything(), 2000, 1, 999, 1);
      }
    );

    it('calls ctx.save, rect, restore for each fill path', () => {
      const ctx = createMockCtx();
      invokeDensePathBuilder(minimalPathbuilderOpts, { ctx });
      expect(ctx.save).toHaveBeenCalledWith();
      expect(ctx.rect).toHaveBeenCalledWith(0, 0, 100, 100);
      expect(ctx.restore).toHaveBeenCalledWith();
    });
  });
});

describe('heatmapPathsPoints', () => {
  /**
   * Points data: [xValues, yValues] for exemplar markers.
   * 3 points at (100,1), (200,2), (300,3).
   */
  const pointsData: PointsData = [
    [100, 200, 300],
    [1, 2, 3],
  ];

  const minimalPointsOpts = {
    each: jest.fn(),
  };

  /**
   * Invokes heatmapPathsPoints path builder by mocking uPlot.orient to capture and run the draw callback.
   */
  function invokePointsPathBuilder(
    opts: Parameters<typeof heatmapPathsPoints>[0],
    exemplarColor: string,
    overrides?: {
      data?: PointsData;
      scaleY?: Partial<uPlot.Scale>;
      yLayout?: HeatmapCellLayout;
      ctx?: MockCtx;
      valToPosY?: (v: number) => number;
    }
  ): { rect: jest.Mock; each: jest.Mock; valToPosY?: jest.Mock } {
    const rect = jest.fn();
    const each = jest.fn();
    const data = overrides?.data ?? pointsData;
    const valToPosY = overrides?.valToPosY ?? ((v: number) => v);
    const pathBuilder = heatmapPathsPoints({ ...opts, each }, exemplarColor, overrides?.yLayout);
    const orientSpy = jest.spyOn(uPlot, 'orient').mockImplementation(
      createOrientMock(data, {
        scaleX: { min: 0, max: 400 },
        scaleY: overrides?.scaleY ?? { distr: 1, min: 0, max: 4 },
        rect,
        valToPosY,
      })
    );
    const mockU = createMockU(data, overrides?.ctx);
    pathBuilder(mockU, 1);
    orientSpy.mockRestore();
    const result: { rect: jest.Mock; each: jest.Mock; valToPosY?: jest.Mock } = { rect, each };
    if (typeof valToPosY === 'function' && 'mock' in valToPosY) {
      result.valToPosY = valToPosY as jest.Mock;
    }
    return result;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a path builder function', () => {
    const pathBuilder = heatmapPathsPoints(minimalPointsOpts, 'rgba(255,0,255,0.7)');
    expect(typeof pathBuilder).toBe('function');
    expect(pathBuilder.length).toBe(2); // (u, seriesIdx)
  });

  it('accepts optional yLayout', () => {
    const pathBuilder = heatmapPathsPoints(minimalPointsOpts, 'red', HeatmapCellLayout.le);
    expect(typeof pathBuilder).toBe('function');
  });

  describe('draws and fills exemplar points', () => {
    it('draws rect for each point and calls each callback', () => {
      const { rect, each } = invokePointsPathBuilder(minimalPointsOpts, 'rgba(255,0,255,0.7)');

      // rect
      expect(rect).toHaveBeenNthCalledWith(1, expect.anything(), 96, -3, 8, 8);
      expect(rect).toHaveBeenNthCalledWith(2, expect.anything(), 196, -2, 8, 8);
      expect(rect).toHaveBeenNthCalledWith(3, expect.anything(), 296, -1, 8, 8);

      //each
      expect(each).toHaveBeenNthCalledWith(1, expect.anything(), 1, 0, 96, -3, 8, 8);
      expect(each).toHaveBeenNthCalledWith(2, expect.anything(), 1, 1, 196, -2, 8, 8);
      expect(each).toHaveBeenNthCalledWith(3, expect.anything(), 1, 2, 296, -1, 8, 8);
    });

    it('calls each with correct (u, seriesIdx, dataIdx, lft, top, wid, hgt)', () => {
      const { each } = invokePointsPathBuilder(minimalPointsOpts, 'magenta');

      expect(each).toHaveBeenNthCalledWith(1, expect.anything(), 1, 0, 96, -3, 8, 8);
      expect(each).toHaveBeenNthCalledWith(2, expect.anything(), 1, 1, 196, -2, 8, 8);
      expect(each).toHaveBeenNthCalledWith(3, expect.anything(), 1, 2, 296, -1, 8, 8);
    });

    it('applies yShift -0.5 when yLayout is le (ordinal)', () => {
      const valToPosY = jest.fn((v: number) => v);
      const { valToPosY: spy } = invokePointsPathBuilder(minimalPointsOpts, 'red', {
        yLayout: HeatmapCellLayout.le,
        scaleY: { distr: 1, min: 0, max: 4 },
        valToPosY,
      });

      expect(spy).toHaveBeenNthCalledWith(1, 0.5, expect.anything(), 100, 0);
      expect(spy).toHaveBeenNthCalledWith(2, 1.5, expect.anything(), 100, 0);
      expect(spy).toHaveBeenNthCalledWith(3, 2.5, expect.anything(), 100, 0);
    });

    it('applies yShift 0.5 when yLayout is ge (ordinal)', () => {
      const valToPosY = jest.fn((v: number) => v);
      const { valToPosY: spy } = invokePointsPathBuilder(minimalPointsOpts, 'red', {
        yLayout: HeatmapCellLayout.ge,
        scaleY: { distr: 1, min: 0, max: 4 },
        valToPosY,
      });

      expect(spy).toHaveBeenNthCalledWith(1, 1.5, expect.anything(), 100, 0);
      expect(spy).toHaveBeenNthCalledWith(2, 2.5, expect.anything(), 100, 0);
      expect(spy).toHaveBeenNthCalledWith(3, 3.5, expect.anything(), 100, 0);
    });

    it('skips yShift when scaleY is sparse heatmap (distr 3, log 2)', () => {
      const valToPosY = jest.fn((v: number) => v);
      const { valToPosY: spy } = invokePointsPathBuilder(minimalPointsOpts, 'red', {
        yLayout: HeatmapCellLayout.le,
        scaleY: { distr: 3, log: 2, min: 0.5, max: 16 },
        valToPosY,
      });

      expect(spy).toHaveBeenNthCalledWith(1, 1, expect.anything(), 100, 0);
      expect(spy).toHaveBeenNthCalledWith(2, 2, expect.anything(), 100, 0);
      expect(spy).toHaveBeenNthCalledWith(3, 3, expect.anything(), 100, 0);
    });
  });
});

describe('heatmapPathsSparse', () => {
  const fillIndex: Array<CanvasRenderingContext2D['fillStyle']> = ['#000'];
  const minimalPathbuilderOpts = {
    each: jest.fn(),
    disp: {
      fill: {
        values: () => [0],
        index: fillIndex,
      },
    },
  };
  describe('draws and fills sparse heatmap grid cells', () => {
    /**
     * Invokes heatmapPathsSparse path builder by mocking uPlot.orient to capture and run the draw callback.
     */
    function invokeSparsePathBuilder(
      opts: Parameters<typeof heatmapPathsSparse>[0],
      overrides?: { ctx?: MockCtx }
    ): { rect: jest.Mock; each: jest.Mock } {
      const rect = jest.fn();
      const each = jest.fn();
      const pathBuilder = heatmapPathsSparse({ ...opts, each });
      const orientSpy = jest.spyOn(uPlot, 'orient').mockImplementation(
        createOrientMock(sparseHeatmapData, {
          scaleX: { max: 200 },
          scaleY: { max: 16 },
          rect,
        })
      );
      const mockU = createMockU(sparseHeatmapData, overrides?.ctx);
      pathBuilder(mockU, 1);
      orientSpy.mockRestore();
      return { rect, each };
    }

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('draws rect for each visible cell and calls each callback', () => {
      const { rect, each } = invokeSparsePathBuilder({
        ...minimalPathbuilderOpts,
        disp: {
          fill: {
            values: () => [0, 1, 2, 3],
            index: ['#a', '#b', '#c', '#d'],
          },
        },
      });
      expect(rect).toHaveBeenNthCalledWith(1, expect.anything(), 0.5, 4.5, 99, 1);
      expect(rect).toHaveBeenNthCalledWith(2, expect.anything(), 100.5, 4.5, 99, 1);
      expect(rect).toHaveBeenNthCalledWith(3, expect.anything(), 0.5, 16.5, 99, 1);
      expect(rect).toHaveBeenNthCalledWith(4, expect.anything(), 100.5, 16.5, 99, 1);

      expect(each).toHaveBeenNthCalledWith(1, expect.anything(), 1, 0, 0.5, 4.5, 99, 1);
      expect(each).toHaveBeenNthCalledWith(2, expect.anything(), 1, 1, 100.5, 4.5, 99, 1);
      expect(each).toHaveBeenNthCalledWith(3, expect.anything(), 1, 2, 0.5, 16.5, 99, 1);
      expect(each).toHaveBeenNthCalledWith(4, expect.anything(), 1, 3, 100.5, 16.5, 99, 1);
    });

    it('filters cells by hideLE and hideGE', () => {
      const { rect, each } = invokeSparsePathBuilder({
        ...minimalPathbuilderOpts,
        hideLE: 8,
        hideGE: 18,
        disp: {
          fill: {
            values: () => [0, 1, 2, 3],
            index: ['#a', '#b', '#c', '#d'],
          },
        },
      });
      expect(rect).toHaveBeenNthCalledWith(1, expect.anything(), 100.5, 4.5, 99, 1);
      expect(rect).toHaveBeenNthCalledWith(2, expect.anything(), 0.5, 16.5, 99, 1);

      expect(each).toHaveBeenNthCalledWith(1, expect.anything(), 1, 1, 100.5, 4.5, 99, 1);
      expect(each).toHaveBeenNthCalledWith(2, expect.anything(), 1, 2, 0.5, 16.5, 99, 1);
    });

    it('skips cells when count <= hideLE or count >= hideGE', () => {
      const { rect } = invokeSparsePathBuilder({
        ...minimalPathbuilderOpts,
        hideLE: 20,
        hideGE: 100,
        disp: {
          fill: {
            values: () => [0, 1, 2, 3],
            index: ['#a', '#b', '#c', '#d'],
          },
        },
      });
      expect(rect).not.toHaveBeenCalled();
    });

    it('calls ctx.save, rect, clip, fill, restore', () => {
      const ctx = createMockCtx();
      invokeSparsePathBuilder(minimalPathbuilderOpts, { ctx });
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.rect).toHaveBeenCalledWith(0, 0, 100, 100);
      expect(ctx.clip).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
    });

    it('uses Math.round for tile bounds when gap >= CRISP_EDGES_GAP_MIN (4)', () => {
      const { rect } = invokeSparsePathBuilder({
        ...minimalPathbuilderOpts,
        gap: 5,
        disp: {
          fill: {
            values: () => [0, 1, 2, 3],
            index: ['#a', '#b', '#c', '#d'],
          },
        },
      });
      expect(rect).toHaveBeenNthCalledWith(1, expect.anything(), 2.5, 6.5, 95, 1);
      expect(rect).toHaveBeenNthCalledWith(2, expect.anything(), 102.5, 6.5, 95, 1);
      expect(rect).toHaveBeenNthCalledWith(3, expect.anything(), 2.5, 18.5, 95, 1);
      expect(rect).toHaveBeenNthCalledWith(4, expect.anything(), 102.5, 18.5, 95, 1);
    });
  });
});

describe('toLogBase', () => {
  it('returns 10 when value is 10', () => {
    expect(toLogBase(10)).toBe(10);
  });

  it('returns 2 when value is 2', () => {
    expect(toLogBase(2)).toBe(2);
  });

  it('returns 2 (default) when value is undefined', () => {
    expect(toLogBase(undefined)).toBe(2);
  });

  it('returns 2 (default) for invalid values', () => {
    expect(toLogBase(5)).toBe(2);
    expect(toLogBase(0)).toBe(2);
    expect(toLogBase(-1)).toBe(2);
    expect(toLogBase(100)).toBe(2);
  });
});

describe('applyExplicitMinMax', () => {
  it('returns original values when no explicit values provided', () => {
    const [min, max] = applyExplicitMinMax(0, 100, undefined, undefined);
    expect(min).toBe(0);
    expect(max).toBe(100);
  });

  it('applies explicit min only', () => {
    const [min, max] = applyExplicitMinMax(0, 100, 10, undefined);
    expect(min).toBe(10);
    expect(max).toBe(100);
  });

  it('applies explicit max only', () => {
    const [min, max] = applyExplicitMinMax(0, 100, undefined, 90);
    expect(min).toBe(0);
    expect(max).toBe(90);
  });

  it('applies both explicit min and max', () => {
    const [min, max] = applyExplicitMinMax(0, 100, 20, 80);
    expect(min).toBe(20);
    expect(max).toBe(80);
  });

  it('handles negative values', () => {
    const [min, max] = applyExplicitMinMax(-50, 50, -10, 10);
    expect(min).toBe(-10);
    expect(max).toBe(10);
  });

  it('handles explicit min = 0', () => {
    const [min, max] = applyExplicitMinMax(10, 100, 0, undefined);
    expect(min).toBe(0);
    expect(max).toBe(100);
  });

  it('handles explicit max = 0', () => {
    const [min, max] = applyExplicitMinMax(-100, -10, undefined, 0);
    expect(min).toBe(-100);
    expect(max).toBe(0);
  });

  it('handles null scaleMin', () => {
    const [min, max] = applyExplicitMinMax(null, 100, 10, undefined);
    expect(min).toBe(10);
    expect(max).toBe(100);
  });

  it('handles null scaleMax', () => {
    const [min, max] = applyExplicitMinMax(0, null, undefined, 90);
    expect(min).toBe(0);
    expect(max).toBe(90);
  });

  it('preserves null when no explicit value provided', () => {
    const [min, max] = applyExplicitMinMax(null, null, undefined, undefined);
    expect(min).toBe(null);
    expect(max).toBe(null);
  });
});

describe('calculateBucketExpansionFactor', () => {
  describe('valid bucket factor calculation', () => {
    it('calculates factor from first bucket with valid values', () => {
      const yMinValues = [1, 4, 16];
      const yMaxValues = [4, 16, 64];
      const factor = calculateBucketExpansionFactor(yMinValues, yMaxValues);
      expect(factor).toBe(4);
    });

    it('calculates factor from exponential buckets', () => {
      const yMinValues = [1, 2, 4, 8];
      const yMaxValues = [2, 4, 8, 16];
      const factor = calculateBucketExpansionFactor(yMinValues, yMaxValues);
      expect(factor).toBe(2);
    });

    it('handles fractional factors', () => {
      const yMinValues = [10, 15, 20];
      const yMaxValues = [15, 20, 25];
      const factor = calculateBucketExpansionFactor(yMinValues, yMaxValues);
      expect(factor).toBe(1.5);
    });
  });

  describe('division by zero handling', () => {
    it('finds valid factor from second bucket when first bucket starts at 0', () => {
      const yMinValues = [0, 1, 4, 16];
      const yMaxValues = [1, 4, 16, 64];
      const factor = calculateBucketExpansionFactor(yMinValues, yMaxValues);
      expect(factor).toBe(4); // Uses second bucket: 4/1 = 4
    });

    it('finds valid factor from third bucket when first two fail', () => {
      const yMinValues = [0, 0, 1, 4];
      const yMaxValues = [1, 4, 4, 16];
      const factor = calculateBucketExpansionFactor(yMinValues, yMaxValues);
      expect(factor).toBe(4); // Uses third bucket: 4/1 = 4
    });

    it('returns 1 when all buckets start at 0', () => {
      const yMinValues = [0, 0, 0];
      const yMaxValues = [1, 4, 16];
      const factor = calculateBucketExpansionFactor(yMinValues, yMaxValues);
      expect(factor).toBe(1);
    });
  });

  describe('negative values', () => {
    it('handles negative bucket ranges', () => {
      const yMinValues = [-16, -4, -1];
      const yMaxValues = [-4, -1, 0];
      const factor = calculateBucketExpansionFactor(yMinValues, yMaxValues);
      expect(factor).toBe(0.25); // -4/-16 = 0.25
    });

    it('skips zero but allows negative values when finding fallback', () => {
      const yMinValues = [0, -4, -1];
      const yMaxValues = [1, -1, 0];
      const factor = calculateBucketExpansionFactor(yMinValues, yMaxValues);
      expect(factor).toBe(0.25); // Uses second bucket: -1/-4 = 0.25
    });

    it('handles mixed positive and negative buckets', () => {
      const yMinValues = [-10, -5, 0, 5];
      const yMaxValues = [-5, 0, 5, 10];
      const factor = calculateBucketExpansionFactor(yMinValues, yMaxValues);
      expect(factor).toBe(0.5); // -5/-10 = 0.5
    });
  });

  describe('edge cases', () => {
    it('returns 1 for empty arrays', () => {
      const factor = calculateBucketExpansionFactor([], []);
      expect(factor).toBe(1);
    });

    it('returns 1 when only yMinValues is empty', () => {
      const factor = calculateBucketExpansionFactor([], [1, 4, 16]);
      expect(factor).toBe(1);
    });

    it('returns 1 when only yMaxValues is empty', () => {
      const factor = calculateBucketExpansionFactor([1, 4, 16], []);
      expect(factor).toBe(1);
    });

    it('returns 1 for single bucket', () => {
      const yMinValues = [1];
      const yMaxValues = [4];
      const factor = calculateBucketExpansionFactor(yMinValues, yMaxValues);
      expect(factor).toBe(4);
    });

    it('handles when only one array has length > 1', () => {
      const yMinValues = [1];
      const yMaxValues = [4, 16, 64];
      const factor = calculateBucketExpansionFactor(yMinValues, yMaxValues);
      expect(factor).toBe(4); // Uses first bucket only, no fallback search
    });

    it('handles non-number values in arrays', () => {
      const yMinValues = ['1', 4, 16];
      const yMaxValues = [4, 16, 64];
      const factor = calculateBucketExpansionFactor(yMinValues, yMaxValues);
      expect(factor).toBe(4); // Skips first, uses second bucket
    });

    it('handles null values', () => {
      const yMinValues = [null, 1, 4];
      const yMaxValues = [4, 4, 16];
      const factor = calculateBucketExpansionFactor(yMinValues, yMaxValues);
      expect(factor).toBe(4); // Skips first, uses second bucket
    });

    it('handles undefined values', () => {
      const yMinValues = [undefined, 1, 4];
      const yMaxValues = [4, 4, 16];
      const factor = calculateBucketExpansionFactor(yMinValues, yMaxValues);
      expect(factor).toBe(4); // Skips first, uses second bucket
    });

    it('skips bucket when yMax is not a number', () => {
      const yMinValues = [0, 1, 4];
      const yMaxValues = [1, 'invalid', 16];
      const factor = calculateBucketExpansionFactor(yMinValues, yMaxValues);
      expect(factor).toBe(4); // Skips first two, uses third bucket
    });

    it('returns 1 when all subsequent buckets have non-number yMax', () => {
      const yMinValues = [0, 1, 4];
      const yMaxValues = [1, null, undefined];
      const factor = calculateBucketExpansionFactor(yMinValues, yMaxValues);
      expect(factor).toBe(1); // Can't find any valid bucket
    });

    it('handles decreasing bucket ranges (unusual but valid)', () => {
      // Buckets are in reverse order: [64,256], [16,64], [4,16], [1,4]
      const yMinValues = [64, 16, 4, 1];
      const yMaxValues = [256, 64, 16, 4];
      const factor = calculateBucketExpansionFactor(yMinValues, yMaxValues);
      expect(factor).toBe(4); // 256/64 = 4 from first bucket
    });

    it('returns 1 when factor is Infinity', () => {
      const yMinValues = [0];
      const yMaxValues = [10];
      const factor = calculateBucketExpansionFactor(yMinValues, yMaxValues);
      expect(factor).toBe(1); // 10/0 = Infinity, invalid
    });

    it('returns 1 when factor is NaN', () => {
      const yMinValues = [0];
      const yMaxValues = [0];
      const factor = calculateBucketExpansionFactor(yMinValues, yMaxValues);
      expect(factor).toBe(1); // 0/0 = NaN, invalid
    });

    it('skips buckets with zero factor in findIndex', () => {
      const yMinValues = [0, 1, 0, 4];
      const yMaxValues = [1, 0, 10, 16];
      const factor = calculateBucketExpansionFactor(yMinValues, yMaxValues);
      expect(factor).toBe(4); // Skips: [0,1]=Inf, [1,0]=0, [0,10]=Inf, uses [4,16]=4
    });

    it('skips buckets with negative factor in findIndex', () => {
      const yMinValues = [0, -5, 4];
      const yMaxValues = [1, 10, 16];
      const factor = calculateBucketExpansionFactor(yMinValues, yMaxValues);
      expect(factor).toBe(4); // Skips [0,1]=Inf, [-5,10]=-2, uses [4,16]=4
    });
  });

  describe('realistic heatmap data', () => {
    it('handles Prometheus-style exponential buckets starting at 0', () => {
      // Typical Prometheus histogram buckets: 0, 1, 4, 16, 64, 256, 1024, 4096, 16384, 65536
      const yMinValues = [0, 2, 4, 16, 64, 256, 1024, 4096, 16384, 65536];
      const yMaxValues = [1, 5, 16, 64, 256, 1024, 4096, 16384, 65536, 262144];
      const factor = calculateBucketExpansionFactor(yMinValues, yMaxValues);
      expect(factor).toBe(2.5); // Uses second bucket: 5/2 = 2.5
    });

    it('handles linear buckets', () => {
      const yMinValues = [0, 10, 20, 30];
      const yMaxValues = [10, 20, 30, 40];
      const factor = calculateBucketExpansionFactor(yMinValues, yMaxValues);
      expect(factor).toBe(2); // Uses second bucket: 20/10 = 2
    });
  });
});

describe('calculateYSizeDivisor', () => {
  it('returns 1 for linear scale', () => {
    expect(calculateYSizeDivisor(ScaleDistribution.Linear, false, 2)).toBe(1);
  });

  it('returns 1 for log scale with explicit scale', () => {
    expect(calculateYSizeDivisor(ScaleDistribution.Log, true, 2)).toBe(1);
  });

  it('returns 1 for symlog scale with explicit scale', () => {
    expect(calculateYSizeDivisor(ScaleDistribution.Symlog, true, 2)).toBe(1);
  });

  it('returns split value for log scale without explicit scale', () => {
    expect(calculateYSizeDivisor(ScaleDistribution.Log, false, 2)).toBe(2);
    expect(calculateYSizeDivisor(ScaleDistribution.Log, false, 4)).toBe(4);
  });

  it('returns split value for symlog scale without explicit scale', () => {
    expect(calculateYSizeDivisor(ScaleDistribution.Symlog, false, 2)).toBe(2);
    expect(calculateYSizeDivisor(ScaleDistribution.Symlog, false, 3)).toBe(3);
  });

  it('handles string split values', () => {
    expect(calculateYSizeDivisor(ScaleDistribution.Log, false, '2')).toBe(2);
    expect(calculateYSizeDivisor(ScaleDistribution.Log, false, '4')).toBe(4);
  });

  it('returns 1 when split value is undefined', () => {
    expect(calculateYSizeDivisor(ScaleDistribution.Log, false, undefined)).toBe(1);
  });

  it('returns 1 when scale type is undefined', () => {
    expect(calculateYSizeDivisor(undefined, false, 2)).toBe(1);
  });

  it('returns 1 for ordinal scale', () => {
    expect(calculateYSizeDivisor(ScaleDistribution.Ordinal, false, 2)).toBe(1);
  });
});

describe('boundedMinMax', () => {
  describe('when min and max are not provided', () => {
    it('calculates min and max from values', () => {
      const values = [10, 20, 5, 30, 15];
      const [min, max] = boundedMinMax(values);
      expect(min).toBe(5);
      expect(max).toBe(30);
    });

    it('handles single value', () => {
      const values = [42];
      const [min, max] = boundedMinMax(values);
      expect(min).toBe(42);
      expect(max).toBe(42);
    });

    it('handles negative values', () => {
      const values = [-10, -20, -5, -30];
      const [min, max] = boundedMinMax(values);
      expect(min).toBe(-30);
      expect(max).toBe(-5);
    });

    it('handles mixed positive and negative values', () => {
      const values = [-10, 20, -5, 30];
      const [min, max] = boundedMinMax(values);
      expect(min).toBe(-10);
      expect(max).toBe(30);
    });

    it('returns Infinity/-Infinity for empty array', () => {
      const values: number[] = [];
      const [min, max] = boundedMinMax(values);
      expect(min).toBe(Infinity);
      expect(max).toBe(-Infinity);
    });
  });

  describe('when min is provided', () => {
    it('uses provided min value', () => {
      const values = [10, 20, 5, 30];
      const [min, max] = boundedMinMax(values, 0);
      expect(min).toBe(0);
      expect(max).toBe(30);
    });

    it('uses provided min even if higher than data min', () => {
      const values = [10, 20, 5, 30];
      const [min, max] = boundedMinMax(values, 15);
      expect(min).toBe(15);
      expect(max).toBe(30);
    });
  });

  describe('when max is provided', () => {
    it('uses provided max value', () => {
      const values = [10, 20, 5, 30];
      const [min, max] = boundedMinMax(values, undefined, 50);
      expect(min).toBe(5);
      expect(max).toBe(50);
    });

    it('uses provided max even if lower than data max', () => {
      const values = [10, 20, 5, 30];
      const [min, max] = boundedMinMax(values, undefined, 25);
      expect(min).toBe(5);
      expect(max).toBe(25);
    });
  });

  describe('when both min and max are provided', () => {
    it('uses both provided values', () => {
      const values = [10, 20, 5, 30];
      const [min, max] = boundedMinMax(values, 0, 50);
      expect(min).toBe(0);
      expect(max).toBe(50);
    });
  });

  describe('with hideLE filter', () => {
    it('excludes values less than or equal to hideLE', () => {
      const values = [5, 10, 15, 20, 25];
      const [min, max] = boundedMinMax(values, undefined, undefined, 10);
      expect(min).toBe(15);
      expect(max).toBe(25);
    });

    it('excludes all values when hideLE is higher than all values', () => {
      const values = [5, 10, 15];
      const [min, max] = boundedMinMax(values, undefined, undefined, 20);
      expect(min).toBe(Infinity);
      expect(max).toBe(-Infinity);
    });
  });

  describe('with hideGE filter', () => {
    it('excludes values greater than or equal to hideGE', () => {
      const values = [5, 10, 15, 20, 25];
      const [min, max] = boundedMinMax(values, undefined, undefined, 4, 16);
      expect(min).toBe(5);
      expect(max).toBe(15);
    });

    it('excludes all values when hideGE is lower than all values', () => {
      const values = [15, 20, 25];
      const [min, max] = boundedMinMax(values, undefined, undefined, -Infinity, 10);
      expect(min).toBe(Infinity);
      expect(max).toBe(-Infinity);
    });
  });

  describe('with both hideLE and hideGE filters', () => {
    it('excludes values outside the range', () => {
      const values = [5, 10, 15, 20, 25, 30];
      const [min, max] = boundedMinMax(values, undefined, undefined, 10, 25);
      expect(min).toBe(15);
      expect(max).toBe(20);
    });

    it('works with provided min/max bounds', () => {
      const values = [5, 10, 15, 20, 25, 30];
      const [min, max] = boundedMinMax(values, 0, 50, 10, 25);
      expect(min).toBe(0);
      expect(max).toBe(50);
    });
  });
});

describe('valuesToFills', () => {
  // Fake color palette for testing index mapping
  const palette = ['c0', 'c1', 'c2', 'c3', 'c4'];

  describe('basic mapping', () => {
    it('maps values to palette indices', () => {
      const values = [0, 25, 50, 75, 100];
      const fills = valuesToFills(values, palette, 0, 100);

      expect(fills).toEqual([0, 1, 2, 3, 4]);
    });

    it('maps min value to first palette index', () => {
      const values = [10];
      const fills = valuesToFills(values, palette, 10, 20);

      expect(fills[0]).toBe(0);
    });

    it('maps max value to last palette index', () => {
      const values = [20];
      const fills = valuesToFills(values, palette, 10, 20);

      expect(fills[0]).toBe(4);
    });

    it('maps mid-range values proportionally', () => {
      const values = [15];
      const fills = valuesToFills(values, palette, 10, 20);

      // 15 is middle of 10-20, should map to index 2 (middle color)
      expect(fills[0]).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('clamps values below min to first index', () => {
      const values = [5, 8, 10];
      const fills = valuesToFills(values, palette, 10, 20);

      expect(fills[0]).toBe(0); // 5 < 10
      expect(fills[1]).toBe(0); // 8 < 10
    });

    it('clamps values above max to last index', () => {
      const values = [20, 25, 30];
      const fills = valuesToFills(values, palette, 10, 20);

      expect(fills[0]).toBe(4); // 20 = max
      expect(fills[1]).toBe(4); // 25 > max
      expect(fills[2]).toBe(4); // 30 > max
    });

    it('handles zero range (min equals max)', () => {
      const values = [10, 10, 10];
      const fills = valuesToFills(values, palette, 10, 10);

      // When range is 0, defaults to 1, so all values map to 0
      expect(fills).toEqual([0, 0, 0]);
    });

    it('handles single color palette', () => {
      const values = [0, 50, 100];
      const palette = ['c0'];
      const fills = valuesToFills(values, palette, 0, 100);

      expect(fills).toEqual([0, 0, 0]);
    });

    it('handles large palette', () => {
      const values = [50];
      const palette = Array.from({ length: 256 }, (_, i) => `#${i}`);
      const fills = valuesToFills(values, palette, 0, 100);

      // 50 is 50% of 0-100, should map to 128 (middle of 256)
      expect(fills[0]).toBe(128);
    });
  });

  describe('negative values', () => {
    it('handles negative min and max', () => {
      const values = [-10, -5, 0];
      const palette = ['c0', 'c1', 'c2'];
      const fills = valuesToFills(values, palette, -10, 0);

      expect(fills[0]).toBe(0); // -10 is min
      expect(fills[1]).toBe(1); // -5 is middle
      expect(fills[2]).toBe(2); // 0 is max
    });

    it('handles range crossing zero', () => {
      const values = [-10, 0, 10];
      const palette = ['c0', 'c1', 'c2'];
      const fills = valuesToFills(values, palette, -10, 10);

      expect(fills[0]).toBe(0); // -10 is min
      expect(fills[1]).toBe(1); // 0 is middle
      expect(fills[2]).toBe(2); // 10 is max
    });
  });

  describe('preserves array length', () => {
    it('handles empty array', () => {
      const values: number[] = [];
      const fills = valuesToFills(values, palette, 0, 100);

      expect(fills).toEqual([]);
    });
  });
});

describe('Regression tests', () => {
  describe('valuesToFills — negative value regressions', () => {
    // Regression for "Heatmap: Fix negative value support" (PR #98887).
    // When all values are negative, minValue < 0 and maxValue <= 0.
    // The range calculation (maxValue - minValue) must still be positive so
    // that indices are spread across the palette rather than all mapping to 0.
    it('produces a spread of indices for an all-negative value range', () => {
      const palette = ['c0', 'c1', 'c2', 'c3', 'c4'];
      const values = [-100, -75, -50, -25, 0];
      const fills = valuesToFills(values, palette, -100, 0);

      // Each value should map to a distinct palette index
      expect(new Set(fills).size).toEqual(5);
      expect(fills[0]).toBe(0); // -100 = min
      expect(fills[4]).toBe(4); // 0 = max
    });

    // When minValue === maxValue and both are negative, range defaults to 1.
    // All values should map to the first palette index (not throw or produce -1).
    it('clamps to index 0 when minValue === maxValue and both are negative', () => {
      const palette = ['c0', 'c1', 'c2'];
      const fills = valuesToFills([-50, -50, -50], palette, -50, -50);
      expect(fills).toEqual([0, 0, 0]);
    });

    // Regression for "Heatmap: Fix tooltip for negative values" (PR #96741).
    // Values below minValue must still clamp to 0 (not produce a negative index)
    // even when minValue itself is negative.
    it('clamps values below a negative minValue to index 0', () => {
      const palette = ['c0', 'c1', 'c2'];
      const fills = valuesToFills([-200, -100, -50], palette, -100, -50);
      expect(fills[0]).toBe(0); // -200 < minValue(-100), must clamp to 0
    });
  });

  describe('boundedMinMax — negative value regressions', () => {
    // Regression for "Heatmap: Fix negative value support" (PR #98887).
    // boundedMinMax must return a valid [min, max] where min < max for
    // all-negative datasets so the color scale is not inverted.
    it('returns ordered [min, max] for all-negative values', () => {
      const values = [-30, -20, -10];
      const [min, max] = boundedMinMax(values);
      expect([min, max]).toEqual([-30, -10]);
    });

    // When filterValues.ge filters out all values, both min and max should be
    // sentinel values (Infinity / -Infinity), not swapped or equal.
    it('returns sentinel values when all values are filtered by hideGE', () => {
      const values = [-10, -5, -1];
      const [min, max] = boundedMinMax(values, undefined, undefined, -Infinity, -20);
      expect(min).toBe(Infinity);
      expect(max).toBe(-Infinity);
    });

    // Regression: a single negative value must produce min === max === that value.
    it('handles single negative value', () => {
      const [min, max] = boundedMinMax([-42]);
      expect(min).toBe(-42);
      expect(max).toBe(-42);
    });
  });

  describe('calculateBucketExpansionFactor — Prometheus histogram regressions', () => {
    // Regression for "Heatmap: Fix tooltip bucket range calculation when first bucket is 0" (PR #95987).
    // Prometheus histograms commonly start with a [0, le] bucket.
    // Division by the first yMin (0) produces Infinity, so the function must skip
    // it and find the first non-zero yMin entry.
    it('skips the leading zero bucket and returns the correct factor', () => {
      // Typical Prometheus le buckets: 0.005, 0.01, 0.025, 0.05, 0.1, 0.25 …
      const yMinValues = [0, 0.005, 0.01, 0.025, 0.05];
      const yMaxValues = [0.005, 0.01, 0.025, 0.05, 0.1];
      const factor = calculateBucketExpansionFactor(yMinValues, yMaxValues);
      // first valid bucket: 0.01 / 0.005 = 2
      expect(factor).toBe(2);
    });

    // When every yMin in the dataset is 0 the function should not return Infinity
    // or NaN — it must fall back to 1.
    it('returns 1 when every yMin is 0 (prevents Infinity expansion)', () => {
      const yMinValues = [0, 0, 0];
      const yMaxValues = [0.1, 0.5, 1.0];
      const factor = calculateBucketExpansionFactor(yMinValues, yMaxValues);
      expect(factor).toBe(1);
    });
  });
});
