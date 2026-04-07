import { render, screen, waitFor } from '@testing-library/react';

import {
  buildHistogram,
  createDataFrame,
  createTheme,
  type DataFrame,
  DataFrameType,
  FieldType,
  getDisplayProcessor,
  getHistogramFields,
  histogramFieldsToFrame,
  joinHistograms,
  toDataFrame,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { LegendDisplayMode, TooltipDisplayMode, type UPlotConfigBuilder, type VizLegendOptions } from '@grafana/ui';

import { getBucketSize, Histogram, type HistogramProps } from './Histogram';
import { type Options } from './panelcfg.gen';

// Mock uplot to avoid canvas initialization in tests.
// Histogram uses uPlot.paths.bars and uPlot.rangeLog during prepConfig.
jest.mock('uplot', () => {
  const mockPathsBars = jest.fn(() => () => '');
  const mock = jest.fn().mockImplementation(() => ({
    setData: jest.fn(),
    setSize: jest.fn(),
    destroy: jest.fn(),
  })) as jest.Mock & {
    paths: { bars: jest.Mock };
    rangeLog: (min: number, max: number) => [number, number];
  };
  mock.paths = { bars: mockPathsBars };
  mock.rangeLog = jest.fn((min: number, max: number) => [min, max]);
  return mock;
});

const theme = createTheme();

const rawHistogramFrame = toDataFrame({
  meta: {
    type: DataFrameType.HeatmapCells,
  },
  fields: [
    {
      name: 'time',
      type: FieldType.time,
      values: [1773647276390, 1773650876390, 1773654476390, 1773658076390, 1773661676390, 1773665276390],
    },
    {
      name: 'A-series',
      type: FieldType.number,
      values: [0, 1.9403492379071463, 0.22303563335449417, 2.123561022942368, 0.545951032905836, 1.4804557711836743],
    },
  ],
});
const ordinalHistogramFrame = createDataFrame({
  fields: [
    {
      name: 'xMin',
      type: FieldType.string,
      values: ['0', '1', '2', '3'],
    },
    {
      name: 'xMax',
      type: FieldType.string,
      values: ['1', '2', '3', '+Inf'],
    },
    {
      name: 'count',
      type: FieldType.number,
      values: [10, 20, 15, 5],
      config: {},
    },
  ],
});
const decimalBucketsFrame = createDataFrame({
  fields: [
    { name: 'xMin', type: FieldType.number, values: [0, 0.5, 1] },
    { name: 'xMax', type: FieldType.number, values: [0.5, 1, 1.5] },
    { name: 'count', type: FieldType.number, values: [1, 2, 3], config: {} },
  ],
});

describe('Histogram dataframe utils', () => {
  const xMaxValues = [0.2, 0.4, 0.6000000000000001, 1.5999999999999999, 2, 2.2];
  const xMinValues = [0, 0.2, 0.4, 1.4, 1.8, 2];
  const countValues = [1, 1, 1, 1, 1, 1];

  describe('buildHistogram', () => {
    it('should return HistogramFields', () => {
      const hist = buildHistogram([rawHistogramFrame], {}, theme);
      expect(hist).not.toBeNull();
      expect(hist?.xMax.values).toEqual(xMaxValues);
      expect(hist?.xMin.values).toEqual(xMinValues);
      expect(hist?.counts).toHaveLength(1);
      expect(hist?.counts[0].values).toEqual(countValues);
    });
  });
  describe('histogramFieldsToFrame', () => {
    it('should return normalized histogram frame', () => {
      const hist = buildHistogram([rawHistogramFrame], {}, theme);
      const normalized = histogramFieldsToFrame(hist!);

      expect(normalized.fields).toHaveLength(3);
      expect(normalized.fields[0].values).toEqual(xMinValues);
      expect(normalized.fields[1].values).toEqual(xMaxValues);
      expect(normalized.fields[2].values).toEqual(countValues);
    });
  });
});

describe('getBucketSize', () => {
  it('should calculate bucket size from raw frame', () => {
    const hist = buildHistogram([rawHistogramFrame], {}, theme);
    const normalized = histogramFieldsToFrame(hist!);
    const bucketSize = getBucketSize(normalized);
    expect(bucketSize).toEqual(0.2);
  });
  it('returns correct bucket size for explicit xMin/xMax frame', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'xMin', type: FieldType.number, values: [0, 1, 2, 3] },
        { name: 'xMax', type: FieldType.number, values: [1, 2, 3, 4] },
        { name: 'count', type: FieldType.number, values: [5, 10, 15, 20] },
      ],
    });
    expect(getBucketSize(frame)).toBe(1);
  });
  it('handles non-integer bucket sizes with rounding', () => {
    expect(getBucketSize(decimalBucketsFrame)).toBe(0.5);
  });
  it('returns 1 for ordinal xMin field (classic histogram buckets)', () => {
    expect(getBucketSize(ordinalHistogramFrame)).toBe(1);
  });
  /**
   * Regression test for #46754: Frames with xMax < xMin produce negative bucket size.
   * getBucketSize returns the computed value; buildHistogram treats negative as auto.
   */
  it('returns negative bucket size for malformed frame (xMax < xMin)', () => {
    const malformedFrame = createDataFrame({
      fields: [
        { name: 'xMin', type: FieldType.number, values: [2, 3, 4] },
        { name: 'xMax', type: FieldType.number, values: [1, 2, 3] },
        { name: 'count', type: FieldType.number, values: [5, 10, 15], config: {} },
      ],
    });
    const bucketSize = getBucketSize(malformedFrame);
    expect(getBucketSize(malformedFrame)).toBe(-1);
    const histogramFields = buildHistogram([malformedFrame], { bucketSize });
    expect(histogramFields?.xMax.values).toEqual([2, 3, 4, 5, 6, 11, 16]);
    expect(histogramFields?.xMin.values).toEqual([1, 2, 3, 4, 5, 10, 15]);
    expect(histogramFields?.counts[0].values).toEqual([0, 1, 1, 1, 0, 0, 0]);
  });
});

const defaultLegendOptions: VizLegendOptions = {
  showLegend: true,
  displayMode: LegendDisplayMode.List,
  placement: 'bottom',
  calcs: [],
};

const defaultOptions: Options = {
  legend: defaultLegendOptions,
  tooltip: {
    mode: TooltipDisplayMode.Single,
    // @ts-expect-error @todo mock grafana schema
    sort: 'none',
  },
};

const defaultPropsNoFrames: Partial<HistogramProps> = {
  options: defaultOptions,
  theme,
  legend: defaultLegendOptions,
  width: 400,
  height: 300,
};

describe('Histogram', () => {
  const setUp = (overrides?: Partial<HistogramProps>, optionsOverrides?: Partial<Options>) => {
    const mergedOptions = { ...defaultPropsNoFrames.options, ...overrides?.options, ...optionsOverrides };
    const rawFrames = [rawHistogramFrame];

    // stamp origins for legend calcs (currently done in HistogramPanel.tsx)
    rawFrames.forEach((frame, frameIndex) => {
      frame.fields.forEach((field, fieldIndex) => {
        field.state = {
          ...field.state,
          origin: { frameIndex, fieldIndex },
        };
      });
    });

    const hist = buildHistogram(rawFrames, mergedOptions, theme);
    const alignedFrame = histogramFieldsToFrame(hist!);

    const props: HistogramProps = {
      ...defaultPropsNoFrames,
      options: mergedOptions,
      legend: mergedOptions.legend ?? defaultLegendOptions,
      rawSeries: [rawHistogramFrame],
      bucketSize: getBucketSize(alignedFrame),
      alignedFrame,
      ...overrides,
    } as HistogramProps;

    return render(<Histogram {...props} />);
  };

  describe('options', () => {
    describe('legend', () => {
      it('does not render legend when showLegend is false', async () => {
        setUp(undefined, { legend: { ...defaultLegendOptions, showLegend: false } });

        expect(screen.getByTestId(selectors.components.Panels.Visualization.Histogram.container)).toBeInTheDocument();
        expect(screen.getByTestId(selectors.components.UPlotChart.container)).toBeInTheDocument();
        expect(
          screen.queryByTestId(selectors.components.Panels.Visualization.Histogram.legend)
        ).not.toBeInTheDocument();
      });

      it('renders with combine: false', async () => {
        setUp(undefined, { combine: false });

        const legend = screen.getByTestId(selectors.components.Panels.Visualization.Histogram.legend);
        const container = screen.getByTestId(selectors.components.Panels.Visualization.Histogram.container);
        expect(container).toBeInTheDocument();
        expect(legend).toBeInTheDocument();
        // Chart renders after legend measurement - testing this to help catch unintentional regression, but this is not necessarily desirable behavior!
        await waitFor(() => {
          expect(screen.getByTestId(selectors.components.UPlotChart.container)).toBeInTheDocument();
        });
        // Legend button should be rendered
        expect(legend.querySelector('[type="button"]')).toBeVisible();
        // Legend should contain series name
        expect(legend.querySelector('[type="button"]')).toHaveTextContent('A-series');
      });

      it('renders with combine: true', async () => {
        setUp(undefined, { combine: true });

        const legend = screen.getByTestId(selectors.components.Panels.Visualization.Histogram.legend);
        const container = screen.getByTestId(selectors.components.Panels.Visualization.Histogram.container);
        expect(container).toBeInTheDocument();
        expect(legend).toBeInTheDocument();
        await waitFor(() => {
          expect(screen.getByTestId(selectors.components.UPlotChart.container)).toBeInTheDocument();
        });
        // Legend button should be rendered
        expect(legend.querySelector('[type="button"]')).toBeVisible();
        // Legend should contain count of fields since combine: true is set
        expect(legend.querySelector('[type="button"]')).toHaveTextContent('Count');
      });
    });
  });

  describe('regression tests', () => {
    /**
     * Regression test for #116548: When wantedMax is undefined, the log scale range callback would fail. The fix defaults to 1.
     */
    it('Ensure range exists for log scale on x axis', () => {
      const logScaleFrame = stampFrameWithDisplay(
        createDataFrame({
          fields: [
            { name: 'xMin', type: FieldType.number, values: [0.001, 0.0011, 0.00121] },
            { name: 'xMax', type: FieldType.number, values: [0.0011, 0.00121, 0.001331] },
            { name: 'count', type: FieldType.number, values: [10, 20, 15], config: {} },
          ],
        })
      );

      let configBuilder: UPlotConfigBuilder | undefined;
      setUp(
        {
          alignedFrame: logScaleFrame,
          rawSeries: [logScaleFrame],
          bucketSize: getBucketSize(logScaleFrame),
          children: (builder) => {
            configBuilder = builder;
            return null;
          },
        },
        { legend: { ...defaultLegendOptions, showLegend: false } }
      );

      const config = configBuilder!.getConfig();
      const result = invokeXScaleRange(config, [0.001, 0.0011, 0.00121], 0.001, undefined);

      expect(result).toHaveLength(2);
      expect(Number.isFinite(result[0])).toBe(true);
      expect(Number.isFinite(result[1])).toBe(true);
    });

    /**
     * x scale range: Log scale uses (wantedMax ?? 1) * bucketFactor when wantedMax is undefined.
     */
    it('log scale range applies bucketFactor when wantedMax is provided', () => {
      const logScaleFrame = stampFrameWithDisplay(
        createDataFrame({
          fields: [
            { name: 'xMin', type: FieldType.number, values: [0.001, 0.0011, 0.00121] },
            { name: 'xMax', type: FieldType.number, values: [0.0011, 0.00121, 0.001331] },
            { name: 'count', type: FieldType.number, values: [10, 20, 15], config: {} },
          ],
        })
      );

      let configBuilder: UPlotConfigBuilder | undefined;
      setUp(
        {
          alignedFrame: logScaleFrame,
          rawSeries: [logScaleFrame],
          bucketSize: getBucketSize(logScaleFrame),
          children: (builder) => {
            configBuilder = builder;
            return null;
          },
        },
        { legend: { ...defaultLegendOptions, showLegend: false } }
      );

      const config = configBuilder!.getConfig();
      // bucketFactor = bucketSize1/bucketSize ≈ 1.1; rangeLog receives (0.001, 0.0022) when wantedMax=0.002
      const result = invokeXScaleRange(config, [0.001, 0.0011, 0.00121], 0.001, 0.002);
      expect(result[0]).toBe(0.001);
      expect(result[1]).toBeCloseTo(0.002 * 1.1);
    });

    /**
     * x scale range: Linear scale aligns range to bucket boundaries via incrRoundUp/incrRoundDn.
     */
    it('linear scale range aligns to bucket boundaries', () => {
      const frame = createLinearHistogramFrame([0, 1, 2, 3], [1, 2, 3, 4], [5, 10, 15, 20]);
      let configBuilder: UPlotConfigBuilder | undefined;
      setUp(
        {
          alignedFrame: frame,
          rawSeries: [frame],
          bucketSize: getBucketSize(frame),
          children: (builder) => {
            configBuilder = builder;
            return null;
          },
        },
        { legend: { ...defaultLegendOptions, showLegend: false } }
      );

      const config = configBuilder!.getConfig();
      const [min, max] = invokeXScaleRange(config, [0, 1, 2, 3], 0.3, 2.5);
      expect(min).toBe(1);
      expect(max).toBe(2);
    });

    /**
     * x scale range: When wantedMax === fullRangeMax (last bucket), add bucketSize so the last bar is visible.
     */
    it('linear scale range extends max by bucketSize when wantedMax equals last data value', () => {
      const frame = createLinearHistogramFrame([0, 1, 2, 3], [1, 2, 3, 4], [5, 10, 15, 20]);
      let configBuilder: UPlotConfigBuilder | undefined;
      setUp(
        {
          alignedFrame: frame,
          rawSeries: [frame],
          bucketSize: getBucketSize(frame),
          children: (builder) => {
            configBuilder = builder;
            return null;
          },
        },
        { legend: { ...defaultLegendOptions, showLegend: false } }
      );

      const config = configBuilder!.getConfig();
      const [min, max] = invokeXScaleRange(config, [0, 1, 2, 3], 0, 3);
      expect(min).toBe(0);
      expect(max).toBe(4);
    });

    /**
     * x scale range: xScaleMin/xScaleMax from count field config override wanted range.
     */
    it('linear scale range uses xScaleMin and xScaleMax from config when set', () => {
      const frame = createLinearHistogramFrame([0, 1, 2, 3], [1, 2, 3, 4], [5, 10, 15, 20], {
        min: 1,
        max: 3,
      });
      let configBuilder: UPlotConfigBuilder | undefined;
      setUp(
        {
          alignedFrame: frame,
          rawSeries: [frame],
          bucketSize: getBucketSize(frame),
          children: (builder) => {
            configBuilder = builder;
            return null;
          },
        },
        { legend: { ...defaultLegendOptions, showLegend: false } }
      );

      const config = configBuilder!.getConfig();
      const [min, max] = invokeXScaleRange(config, [0, 1, 2, 3], 0.5, 3.5);
      expect(min).toBe(1);
      expect(max).toBe(4);
    });

    /**
     * Regression test for #114557: Fix runaway bucket densification with extremely sparse + large datasets
     * getHistogramFields now caps densification at MAX_DENSIFIED_BUCKETS (1000) to prevent OOM.
     */
    it('caps densification at MAX_DENSIFIED_BUCKETS for sparse HeatmapCells', () => {
      const sparseFrame = toDataFrame({
        meta: { type: DataFrameType.HeatmapCells },
        fields: [
          { name: 'yMin', type: FieldType.number, values: [0.001, 1000] },
          { name: 'yMax', type: FieldType.number, values: [0.00101, 1010] },
          { name: 'count', type: FieldType.number, values: [10, 20] },
        ],
      });
      const histFields = getHistogramFields(sparseFrame);
      expect(histFields).toBeDefined();
      expect(histFields!.counts[0].values.length).toBeLessThanOrEqual(1001);

      const frame = histogramFieldsToFrame(joinHistograms([histFields!]), theme);
      setUp(
        {
          alignedFrame: frame,
          rawSeries: [sparseFrame],
          bucketSize: getBucketSize(frame),
        },
        { legend: { ...defaultLegendOptions, showLegend: false } }
      );
      expect(screen.getByTestId(selectors.components.Panels.Visualization.Histogram.container)).toBeInTheDocument();
    });

    /**
     * Regression test for #46754: Negative bucket size crashes UI.
     * buildHistogram treats bucketSize < 0 as auto and recalculates from data instead of crashing.
     */
    it('buildHistogram uses auto bucket size when options.bucketSize is negative', () => {
      const rawFrame = createDataFrame({
        fields: [{ name: 'values', type: FieldType.number, values: [1, 2, 3, 4, 5, 10, 15, 20] }],
      });
      const hist = buildHistogram([rawFrame], { bucketSize: -1, bucketOffset: 0 }, theme);
      expect(hist).not.toBeNull();
      expect(hist!.xMin.values.length).toBeGreaterThan(0);
      expect(hist!.xMax.values.length).toBe(hist!.xMin.values.length);
      // With auto bucket size, xMax - xMin should be positive for each bucket
      const bucketSize = hist!.xMax.values[0] - hist!.xMin.values[0];
      expect(bucketSize).toBeGreaterThan(0);
    });

    /**
     * Regression test for #46754: Malformed histogram data (xMax < xMin) should not crash.
     * Histogram component must handle frames with negative bucket size from getBucketSize.
     */
    it('renders without crashing when frame has negative bucket size (xMax < xMin)', () => {
      const malformedFrame = stampFrameWithDisplay(
        createDataFrame({
          fields: [
            { name: 'xMin', type: FieldType.number, values: [2, 3, 4] },
            { name: 'xMax', type: FieldType.number, values: [1, 2, 3] },
            { name: 'count', type: FieldType.number, values: [5, 10, 15], config: {} },
          ],
        })
      );

      setUp(
        {
          alignedFrame: malformedFrame,
          rawSeries: [malformedFrame],
          bucketSize: getBucketSize(malformedFrame),
        },
        { legend: { ...defaultLegendOptions, showLegend: false } }
      );

      expect(screen.getByTestId(selectors.components.Panels.Visualization.Histogram.container)).toBeInTheDocument();
    });

    /**
     * xSplits: splits shifter ensures splits align to bucket boundaries.
     * When skip > 1 (minSpace/bucketWidth), only every skip-th boundary is shown to avoid label overlap.
     */
    it('x axis splits align to bucket boundaries and respect skip for label density', () => {
      const frame = createLinearHistogramFrame([0, 1, 2, 3], [1, 2, 3, 4], [5, 10, 15, 20], { min: 0, max: 3 });
      let configBuilder: UPlotConfigBuilder | undefined;
      setUp(
        {
          alignedFrame: frame,
          rawSeries: [frame],
          bucketSize: getBucketSize(frame),
          children: (builder) => {
            configBuilder = builder;
            return null;
          },
        },
        { legend: { ...defaultLegendOptions, showLegend: false } }
      );

      const config = configBuilder!.getConfig();
      const xAxis = config.axes?.find((a) => a.scale === 'x');
      expect(xAxis?.splits).toBeDefined();
      expect(typeof xAxis?.splits).toBe('function');

      // 10px per unit -> bucketWidth=10, minSpace=50 -> skip=5, so only every 5th split
      const splits = invokeXSplits(config, [0, 1, 2, 3], 10, 50, 0, 4);

      expect(splits).toBeDefined();
      expect(Array.isArray(splits)).toBe(true);
      expect(splits).toContain(0);
      expect(splits.every((v) => Number.isFinite(v))).toBe(true);
    });

    /**
     * xSplits: when skip=1 (bucketWidth >= minSpace), all bucket boundaries are included.
     */
    it('x axis splits include all bucket boundaries when skip is 1', () => {
      const frame = createLinearHistogramFrame([0, 1, 2], [1, 2, 3], [10, 20, 15]);
      let configBuilder: UPlotConfigBuilder | undefined;
      setUp(
        {
          alignedFrame: frame,
          rawSeries: [frame],
          bucketSize: getBucketSize(frame),
          children: (builder) => {
            configBuilder = builder;
            return null;
          },
        },
        { legend: { ...defaultLegendOptions, showLegend: false } }
      );

      const config = configBuilder!.getConfig();
      // 100px per unit -> bucketWidth=100, minSpace=50 -> skip=1 -> every split
      const splits = invokeXSplits(config, [0, 1, 2], 100, 50, 0, 3);

      expect(splits).toEqual([0, 1, 2, 3]);
    });

    /**
     * x axis values: Ordinal scale returns splits as-is (no label culling).
     */
    it('ordinal x axis values returns splits unchanged', () => {
      const frame = stampFrameWithDisplay(ordinalHistogramFrame);
      let configBuilder: UPlotConfigBuilder | undefined;
      setUp(
        {
          alignedFrame: frame,
          rawSeries: [frame],
          bucketSize: getBucketSize(frame),
          children: (builder) => {
            configBuilder = builder;
            return null;
          },
        },
        { legend: { ...defaultLegendOptions, showLegend: false } }
      );

      const config = configBuilder!.getConfig();
      const splits = [0, 1, 2, 3];
      const result = invokeXAxisValues(config, splits, 100);
      expect(result).toEqual([0, 1, 2, 3]);
    });

    /**
     * x axis values: With wide bbox, all tick labels are shown (keepMod=1).
     */
    it('linear x axis values shows all labels when bbox is wide enough', () => {
      const frame = createLinearHistogramFrame([0, 1, 2, 3], [1, 2, 3, 4], [5, 10, 15, 20]);
      let configBuilder: UPlotConfigBuilder | undefined;
      setUp(
        {
          alignedFrame: frame,
          rawSeries: [frame],
          bucketSize: getBucketSize(frame),
          children: (builder) => {
            configBuilder = builder;
            return null;
          },
        },
        { legend: { ...defaultLegendOptions, showLegend: false } }
      );

      const config = configBuilder!.getConfig();
      const splits = [0, 1, 2, 3, 4];
      const result = invokeXAxisValues(config, splits, 1000);
      expect(result).toHaveLength(5);
      expect(result.every((v) => v != null)).toBe(true);
    });

    /**
     * x axis values: With narrow bbox, every keepMod-th label is shown to avoid overlap.
     */
    it('linear x axis values culls labels when bbox is narrow', () => {
      const frame = createLinearHistogramFrame([0, 1, 2, 3, 4, 5], [1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6]);
      let configBuilder: UPlotConfigBuilder | undefined;
      setUp(
        {
          alignedFrame: frame,
          rawSeries: [frame],
          bucketSize: getBucketSize(frame),
          children: (builder) => {
            configBuilder = builder;
            return null;
          },
        },
        { legend: { ...defaultLegendOptions, showLegend: false } }
      );

      const config = configBuilder!.getConfig();
      const splits = [0, 1, 2, 3, 4, 5, 6];
      const result = invokeXAxisValues(config, splits, 50);
      expect(result).toHaveLength(7);
      const nonNullCount = result.filter((v) => v != null).length;
      expect(nonNullCount).toBeLessThan(7);
    });

    /**
     * Config invalidation: When alignedFrame changes and bucketSize changes,
     * config is rebuilt so the chart reflects the new frame structure.
     */
    it('rebuilds config when alignedFrame and bucketSize change', async () => {
      const frame1 = createLinearHistogramFrame([0, 1, 2, 3], [1, 2, 3, 4], [5, 10, 15, 20]);
      const frame2 = createLinearHistogramFrame([0, 2, 4], [2, 4, 6], [10, 20, 30]);

      const configs: UPlotConfigBuilder[] = [];
      const captureConfig = (builder: UPlotConfigBuilder) => {
        configs.push(builder);
        return null;
      };

      const { rerender } = setUp(
        {
          alignedFrame: frame1,
          rawSeries: [frame1],
          bucketSize: getBucketSize(frame1),
          children: captureConfig,
          structureRev: 1,
        },
        { legend: { ...defaultLegendOptions, showLegend: false } }
      );

      await waitFor(() => {
        expect(screen.getByTestId(selectors.components.UPlotChart.container)).toBeInTheDocument();
      });

      rerender(
        <Histogram
          {...buildHistogramProps(frame2, {
            children: captureConfig,
            structureRev: 1,
            bucketSize: getBucketSize(frame2),
            legend: { ...defaultLegendOptions, showLegend: false },
          })}
        />
      );

      const configAfterUpdate = configs[configs.length - 1]?.getConfig();
      expect(configAfterUpdate).toBeDefined();
      // Config should reflect frame2 range for xData with bucketSize of 2
      const [min, max] = invokeXScaleRange(configAfterUpdate!, [0, 2, 4], 0, 6);
      expect(min).toBe(0);
      expect(max).toBe(6);
    });

    /**
     * Config invalidation: When alignedFrame changes and structureRev changes,
     * config is rebuilt.
     */
    it('rebuilds config when alignedFrame and structureRev change', async () => {
      const frame1 = createLinearHistogramFrame([0, 1, 2], [1, 2, 3], [10, 20, 15]);
      const frame2 = createLinearHistogramFrame([0, 1, 2], [1, 2, 3], [5, 15, 25]);

      const configs: UPlotConfigBuilder[] = [];
      const captureConfig = (builder: UPlotConfigBuilder) => {
        configs.push(builder);
        return null;
      };

      const { rerender } = setUp(
        {
          alignedFrame: frame1,
          rawSeries: [frame1],
          bucketSize: getBucketSize(frame1),
          children: captureConfig,
          structureRev: 1,
        },
        { legend: { ...defaultLegendOptions, showLegend: false } }
      );

      await waitFor(() => {
        expect(screen.getByTestId(selectors.components.UPlotChart.container)).toBeInTheDocument();
      });

      rerender(
        <Histogram
          {...buildHistogramProps(frame2, {
            children: captureConfig,
            structureRev: 2,
            legend: { ...defaultLegendOptions, showLegend: false },
          })}
        />
      );

      expect(configs.length).toBeGreaterThanOrEqual(2);
      expect(screen.getByTestId(selectors.components.Panels.Visualization.Histogram.container)).toBeInTheDocument();
    });

    /**
     * Config invalidation: When alignedFrame changes but structure is unchanged
     * (same bucketSize, structureRev, options), chart continues to render correctly.
     */
    it('continues to render when alignedFrame reference changes but structure is unchanged', async () => {
      const frame1 = createLinearHistogramFrame([0, 1, 2], [1, 2, 3], [10, 20, 15]);
      const frame2 = createLinearHistogramFrame([0, 1, 2], [1, 2, 3], [5, 15, 25]);

      const { rerender } = setUp(
        {
          alignedFrame: frame1,
          rawSeries: [frame1],
          bucketSize: getBucketSize(frame1),
          structureRev: 1,
        },
        { legend: { ...defaultLegendOptions, showLegend: false } }
      );

      await waitFor(() => {
        expect(screen.getByTestId(selectors.components.UPlotChart.container)).toBeInTheDocument();
      });

      rerender(
        <Histogram
          {...buildHistogramProps(frame2, {
            structureRev: 1,
            bucketSize: getBucketSize(frame2),
            legend: { ...defaultLegendOptions, showLegend: false },
          })}
        />
      );

      expect(screen.getByTestId(selectors.components.Panels.Visualization.Histogram.container)).toBeInTheDocument();
      expect(screen.getByTestId(selectors.components.UPlotChart.container)).toBeInTheDocument();
    });

    /**
     * Regression test for #110368: Histogram: Fix Tooltip placement issue
     * The dataIdx callback must return the correct bucket index for tooltip placement.
     * Uses bar start (xMin) to determine which bucket contains the cursor xValue.
     */
    it('cursor dataIdx returns correct bucket index for tooltip', () => {
      const frame = createLinearHistogramFrame([0, 1, 2, 3], [1, 2, 3, 4], [5, 10, 15, 20]);
      let configBuilder: UPlotConfigBuilder | undefined;
      setUp(
        {
          alignedFrame: frame,
          rawSeries: [frame],
          bucketSize: getBucketSize(frame),
          children: (builder) => {
            configBuilder = builder;
            return null;
          },
        },
        { legend: { ...defaultLegendOptions, showLegend: false } }
      );

      const config = configBuilder!.getConfig();
      const dataIdx = config.cursor?.dataIdx;
      expect(dataIdx).toBeDefined();

      const mockU = { data: [[0, 1, 2, 3]] };
      expect(dataIdx!(mockU as never, 0, 1, 0.5)).toBe(0);
      expect(dataIdx!(mockU as never, 0, 1, 1.5)).toBe(1);
      expect(dataIdx!(mockU as never, 0, 2, 2.9)).toBe(2);
    });
  });
});

/** Stamps frame with origins and display processors (required for prepConfig). */
function stampFrameWithDisplay(frame: ReturnType<typeof createDataFrame>) {
  frame.fields.forEach((field, i) => {
    field.state = { ...field.state, origin: { frameIndex: 0, fieldIndex: i } };
    if (!field.display) {
      field.display = getDisplayProcessor({ field, theme });
    }
  });
  return frame;
}

/** Builds HistogramProps for a given frame (for use with render/rerender). */
function buildHistogramProps(frame: DataFrame, overrides?: Partial<HistogramProps>): HistogramProps {
  const mergedOptions = { ...defaultOptions, ...overrides?.options };
  return {
    ...defaultPropsNoFrames,
    options: mergedOptions,
    legend: mergedOptions.legend ?? defaultLegendOptions,
    alignedFrame: frame,
    rawSeries: [frame],
    bucketSize: getBucketSize(frame),
    structureRev: 1,
    ...overrides,
  } as HistogramProps;
}

/** Creates a linear histogram frame with display processors for xSplits/config tests. */
function createLinearHistogramFrame(
  xMin: number[],
  xMax: number[],
  count: number[],
  countConfig?: { min?: number; max?: number }
) {
  return stampFrameWithDisplay(
    createDataFrame({
      fields: [
        { name: 'xMin', type: FieldType.number, values: xMin },
        { name: 'xMax', type: FieldType.number, values: xMax },
        { name: 'count', type: FieldType.number, values: count, config: countConfig ?? {} },
      ],
    })
  );
}

/** Invokes the x scale range function with a mock uPlot instance. */
function invokeXScaleRange(
  config: ReturnType<UPlotConfigBuilder['getConfig']>,
  xData: number[],
  wantedMin: number,
  wantedMax: number | undefined
): [number, number] {
  const rangeFn = config.scales?.x?.range as ((u: unknown, min: number, max?: number) => [number, number]) | undefined;
  if (!rangeFn) {
    throw new Error('missing rangeFn');
  }
  const mockU = { data: [xData] };
  return rangeFn(mockU as never, wantedMin, wantedMax);
}

/** Invokes the x axis values (tick labels) function with a mock uPlot instance. */
function invokeXAxisValues(
  config: ReturnType<UPlotConfigBuilder['getConfig']>,
  splits: number[],
  bboxWidth: number
): Array<string | number | null> {
  const xAxis = config.axes?.find((a) => a.scale === 'x');
  const valuesFn = xAxis?.values as ((u: unknown, splits: number[]) => Array<string | number | null>) | undefined;
  if (!valuesFn) {
    throw new Error('Missing valuesFn');
  }
  const mockU = { bbox: { width: bboxWidth } };
  return valuesFn(mockU as never, splits) ?? [];
}

/** Invokes the x axis splits function with a mock uPlot instance. */
function invokeXSplits(
  config: ReturnType<UPlotConfigBuilder['getConfig']>,
  xData: number[],
  pixelsPerUnit: number,
  minSpace: number,
  scaleMin: number,
  scaleMax: number
): number[] {
  const xAxis = config.axes?.find((a) => a.scale === 'x');
  const splitsFn = xAxis?.splits as ((u: unknown, axisIdx: number, ...args: unknown[]) => number[]) | undefined;
  if (!splitsFn) {
    throw new Error('Missing splitsFn');
  }
  const axisIdx = config.axes!.findIndex((a) => a.scale === 'x');
  const mockU = {
    data: [xData],
    axes: [{ _space: minSpace }, { _space: minSpace }],
    valToPos: (val: number) => val * pixelsPerUnit,
  };
  return splitsFn(mockU as never, axisIdx, scaleMin, scaleMax, undefined as never, undefined as never) ?? [];
}
