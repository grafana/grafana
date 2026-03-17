import uPlot from 'uplot';

import { createDataFrame, createTheme, DataFrameType, dateTime, FieldType } from '@grafana/data';
import { AxisPlacement, HeatmapCellLayout, ScaleDistribution } from '@grafana/schema';
import { UPlotConfigBuilder } from '@grafana/ui';

import { HeatmapData } from './fields';
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

/**
 * Creates a minimal uPlot instance for range callback tests.
 * Uses the real uPlot constructor so the instance satisfies uPlot types.
 */
function createMinimalUPlot(scaleKey: string, overrides?: { data?: uPlot.AlignedData; log?: number }): uPlot {
  const scaleConfig: uPlot.Scale = overrides?.log ? { log: 2 } : {};
  const opts: uPlot.Options = {
    width: 100,
    height: 100,
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
      heatmapColors: {
        values: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        palette: ['#c0', '#c1', '#c2', '#c3', '#c4', '#c5', '#c6', '#c7', '#c8'],
        minValue: 5,
        maxValue: 30,
      },
      xBucketSize: 1000,
      yBucketSize: 1,
      yBucketCount: 3,
      xLayout: HeatmapCellLayout.unknown,
      yLayout: HeatmapCellLayout.unknown,
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
        heatmapColors: { values: [0], palette: ['#c0'], minValue: 0, maxValue: 10 },
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
        heatmapColors: { values: [0, 1, 2], palette: ['#c0', '#c1', '#c2'], minValue: 5, maxValue: 15 },
        xBucketSize: 1,
        yBucketSize: 1,
        yBucketCount: 3,
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
        heatmapColors: { values: [0, 1], palette: ['#c0', '#c1'], minValue: 5, maxValue: 20 },
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
});

describe('heatmapPathsPoints', () => {
  const minimalPointsOpts = {
    each: jest.fn(),
  };

  it('returns a path builder function', () => {
    const pathBuilder = heatmapPathsPoints(minimalPointsOpts, 'rgba(255,0,255,0.7)');
    expect(typeof pathBuilder).toBe('function');
    expect(pathBuilder.length).toBe(2); // (u, seriesIdx)
  });

  it('accepts optional yLayout', () => {
    const pathBuilder = heatmapPathsPoints(minimalPointsOpts, 'red', HeatmapCellLayout.le);
    expect(typeof pathBuilder).toBe('function');
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

  it('returns a path builder function', () => {
    const pathBuilder = heatmapPathsSparse(minimalPathbuilderOpts);
    expect(typeof pathBuilder).toBe('function');
    expect(pathBuilder.length).toBe(2); // (u, seriesIdx)
  });

  it('accepts optional gap, hideLE, hideGE', () => {
    const pathBuilder = heatmapPathsSparse({
      ...minimalPathbuilderOpts,
      gap: 2,
      hideLE: 0,
      hideGE: 100,
    });
    expect(typeof pathBuilder).toBe('function');
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
      const yMinValues = [0, 1, 4, 16, 64, 256, 1024, 4096, 16384, 65536];
      const yMaxValues = [1, 4, 16, 64, 256, 1024, 4096, 16384, 65536, 262144];
      const factor = calculateBucketExpansionFactor(yMinValues, yMaxValues);
      expect(factor).toBe(4); // Uses second bucket: 4/1 = 4
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
  const palette5 = ['c0', 'c1', 'c2', 'c3', 'c4'];

  describe('basic mapping', () => {
    it('maps values to palette indices', () => {
      const values = [0, 25, 50, 75, 100];
      const fills = valuesToFills(values, palette5, 0, 100);

      expect(fills).toEqual([0, 1, 2, 3, 4]);
    });

    it('maps min value to first palette index', () => {
      const values = [10];
      const fills = valuesToFills(values, palette5, 10, 20);

      expect(fills[0]).toBe(0);
    });

    it('maps max value to last palette index', () => {
      const values = [20];
      const fills = valuesToFills(values, palette5, 10, 20);

      expect(fills[0]).toBe(4);
    });

    it('maps mid-range values proportionally', () => {
      const values = [15];
      const fills = valuesToFills(values, palette5, 10, 20);

      // 15 is middle of 10-20, should map to index 2 (middle color)
      expect(fills[0]).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('clamps values below min to first index', () => {
      const values = [5, 8, 10];
      const fills = valuesToFills(values, palette5, 10, 20);

      expect(fills[0]).toBe(0); // 5 < 10
      expect(fills[1]).toBe(0); // 8 < 10
    });

    it('clamps values above max to last index', () => {
      const values = [20, 25, 30];
      const fills = valuesToFills(values, palette5, 10, 20);

      expect(fills[0]).toBe(4); // 20 = max
      expect(fills[1]).toBe(4); // 25 > max
      expect(fills[2]).toBe(4); // 30 > max
    });

    it('handles zero range (min equals max)', () => {
      const values = [10, 10, 10];
      const fills = valuesToFills(values, palette5, 10, 10);

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
      const palette = Array.from({ length: 256 }, (_, i) => `c${i}`);
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
    it('returns array with same length as input', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const palette = ['c0', 'c1'];
      const fills = valuesToFills(values, palette, 1, 10);

      expect(fills.length).toBe(values.length);
    });

    it('handles empty array', () => {
      const values: number[] = [];
      const fills = valuesToFills(values, palette5, 0, 100);

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
      expect(Number.isFinite(factor)).toBe(true);
    });
  });
});
