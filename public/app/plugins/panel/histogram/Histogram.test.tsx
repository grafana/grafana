import { render, screen, waitFor } from '@testing-library/react';

import {
  buildHistogram,
  createDataFrame,
  createTheme,
  DataFrameType,
  FieldType,
  getDisplayProcessor,
  getHistogramFields,
  histogramFieldsToFrame,
  joinHistograms,
  toDataFrame,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { LegendDisplayMode, TooltipDisplayMode, UPlotConfigBuilder, VizLegendOptions } from '@grafana/ui';

import { getBucketSize, Histogram, HistogramProps } from './Histogram';
import { Options } from './panelcfg.gen';

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
      const logScaleFrame = createDataFrame({
        fields: [
          { name: 'xMin', type: FieldType.number, values: [0.001, 0.0011, 0.00121] },
          { name: 'xMax', type: FieldType.number, values: [0.0011, 0.00121, 0.001331] },
          { name: 'count', type: FieldType.number, values: [10, 20, 15], config: {} },
        ],
      });

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
      const xScaleRange = config.scales?.x?.range;
      expect(xScaleRange).toBeDefined();
      expect(typeof xScaleRange).toBe('function');

      const mockU = { data: [[0.001, 0.0011, 0.00121]] };
      //@ts-expect-error
      const result = xScaleRange?.(mockU, 0.001, undefined);

      expect(result).toHaveLength(2);
      expect(Number.isFinite(result[0])).toBe(true);
      expect(Number.isFinite(result[1])).toBe(true);
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
      const props: HistogramProps = {
        ...defaultPropsNoFrames,
        options: { ...defaultOptions, legend: { ...defaultLegendOptions, showLegend: false } },
        legend: { ...defaultLegendOptions, showLegend: false },
        alignedFrame: frame,
        bucketSize: getBucketSize(frame),
        rawSeries: [sparseFrame],
      } as HistogramProps;

      render(<Histogram {...props} />);
      expect(screen.getByTestId(selectors.components.Panels.Visualization.Histogram.container)).toBeInTheDocument();
    });

    /**
     * Regression test for #40872 / PR #46754: Negative bucket size crashes UI.
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
     * Regression test for #40872 / PR #46754: Malformed histogram data (xMax < xMin) should not crash.
     * Histogram component must handle frames with negative bucket size from getBucketSize.
     */
    it('renders without crashing when frame has negative bucket size (xMax < xMin)', () => {
      const malformedFrame = createDataFrame({
        fields: [
          { name: 'xMin', type: FieldType.number, values: [2, 3, 4] },
          { name: 'xMax', type: FieldType.number, values: [1, 2, 3] },
          { name: 'count', type: FieldType.number, values: [5, 10, 15], config: {} },
        ],
      });
      malformedFrame.fields.forEach((field, i) => {
        field.state = { ...field.state, origin: { frameIndex: 0, fieldIndex: i } };
      });

      const props: HistogramProps = {
        ...defaultPropsNoFrames,
        options: { ...defaultOptions, legend: { ...defaultLegendOptions, showLegend: false } },
        legend: { ...defaultLegendOptions, showLegend: false },
        alignedFrame: malformedFrame,
        bucketSize: getBucketSize(malformedFrame),
        rawSeries: [malformedFrame],
      } as HistogramProps;

      expect(() => render(<Histogram {...props} />)).not.toThrow();
      expect(screen.getByTestId(selectors.components.Panels.Visualization.Histogram.container)).toBeInTheDocument();
    });

    /**
     * Regression test for #110368: Histogram: Fix Tooltip placement issue
     * The dataIdx callback must return the correct bucket index for tooltip placement.
     * Uses bar start (xMin) to determine which bucket contains the cursor xValue.
     */
    it('cursor dataIdx returns correct bucket index for tooltip', () => {
      let configBuilder: UPlotConfigBuilder | undefined;
      const frame = createDataFrame({
        fields: [
          { name: 'xMin', type: FieldType.number, values: [0, 1, 2, 3] },
          { name: 'xMax', type: FieldType.number, values: [1, 2, 3, 4] },
          { name: 'count', type: FieldType.number, values: [5, 10, 15, 20], config: {} },
        ],
      });
      frame.fields.forEach((field, i) => {
        field.state = { ...field.state, origin: { frameIndex: 0, fieldIndex: i } };
        if (!field.display) {
          field.display = getDisplayProcessor({ field, theme });
        }
      });

      const props: HistogramProps = {
        ...defaultPropsNoFrames,
        options: { ...defaultOptions, legend: { ...defaultLegendOptions, showLegend: false } },
        legend: { ...defaultLegendOptions, showLegend: false },
        alignedFrame: frame,
        bucketSize: 1,
        rawSeries: [frame],
        children: (builder) => {
          configBuilder = builder;
          return null;
        },
      } as HistogramProps;

      render(<Histogram {...props} />);

      expect(configBuilder).toBeDefined();
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
