import { render, screen, waitFor } from '@testing-library/react';
import type { AlignedData } from 'uplot';

import {
  buildHistogram,
  createDataFrame,
  createTheme,
  DataFrame,
  DataFrameType,
  FieldType,
  getDisplayProcessor,
  getHistogramFields,
  histogramFieldsToFrame,
  toDataFrame,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { LegendDisplayMode, SortOrder, TooltipDisplayMode } from '@grafana/schema';
import { UPlotConfigBuilder } from '@grafana/ui';

import { getBucketSize, Histogram, HistogramProps } from './Histogram';

const histogramSelectors = selectors.components.Panels.Visualization.Histogram;

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

function createLinearHistogramFrame() {
  const series = toDataFrame({
    fields: [{ name: 'value', type: FieldType.number, values: [1, 2, 3, 4, 5, 6, 7, 8, 9] }],
  });
  const hist = buildHistogram([series], { bucketCount: 5 }, theme);
  return histogramFieldsToFrame(hist!, theme);
}

function createOrdinalHistogramFrame() {
  // HeatmapRows-style: string bucket bounds (e.g. "0", "1", "2", "+Inf")
  return createDataFrame({
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
}

const defaultLegendOptions = {
  showLegend: true,
  displayMode: LegendDisplayMode.List,
  placement: 'bottom' as const,
  calcs: [] as string[],
};

describe('getBucketSize', () => {
  describe('linear (numeric) histogram frames', () => {
    it('returns bucket size from first bucket (xMax[0] - xMin[0])', () => {
      const frame = createLinearHistogramFrame();
      const bucketSize = getBucketSize(frame);
      expect(bucketSize).toEqual(2);
    });
    it('returns correct bucket size for explicit xMin/xMax frame', () => {
      const frame = createDataFrame({
        fields: [
          { name: 'xMin', type: FieldType.number, values: [0, 1, 2, 3] },
          { name: 'xMax', type: FieldType.number, values: [1, 2, 3, 4] },
          { name: 'count', type: FieldType.number, values: [5, 10, 15, 20], config: {} },
        ],
      });
      expect(getBucketSize(frame)).toBe(1);
    });
    it('handles non-integer bucket sizes with rounding', () => {
      const frame = createDataFrame({
        fields: [
          { name: 'xMin', type: FieldType.number, values: [0, 0.5, 1] },
          { name: 'xMax', type: FieldType.number, values: [0.5, 1, 1.5] },
          { name: 'count', type: FieldType.number, values: [1, 2, 3], config: {} },
        ],
      });
      expect(getBucketSize(frame)).toBe(0.5);
    });
  });
  describe('ordinal (string) histogram frames', () => {
    it('returns 1 for ordinal/string xMin field (classic histogram buckets)', () => {
      const frame = createOrdinalHistogramFrame();
      expect(getBucketSize(frame)).toBe(1);
    });
  });
});

describe('Histogram', () => {
  const defaultProps: HistogramProps = {
    options: {
      legend: defaultLegendOptions,
      tooltip: { mode: TooltipDisplayMode.Single, sort: SortOrder.None },
    },
    theme,
    legend: defaultLegendOptions,
    width: 400,
    height: 300,
    bucketSize: 2,
    alignedFrame: createLinearHistogramFrame(),
  };

  it('renders histogram container and chart with valid histogram frame', async () => {
    render(<Histogram {...defaultProps} />);

    expect(screen.getByTestId(histogramSelectors.container)).toBeInTheDocument();
    // Chart renders after VizLayout measures legend; wait for it
    await waitFor(() => {
      expect(screen.getByTestId(histogramSelectors.chart)).toBeInTheDocument();
    });
  });

  it('renders legend when showLegend is true', async () => {
    render(<Histogram {...defaultProps} />);

    expect(screen.getByTestId(histogramSelectors.container)).toBeInTheDocument();
    expect(screen.getByTestId(histogramSelectors.legend)).toBeInTheDocument();
    // Chart renders after legend measurement
    await waitFor(() => {
      expect(screen.getByTestId(histogramSelectors.chart)).toBeInTheDocument();
    });
  });

  it('does not render legend when showLegend is false', () => {
    render(<Histogram {...defaultProps} legend={{ ...defaultLegendOptions, showLegend: false }} />);

    expect(screen.getByTestId(histogramSelectors.container)).toBeInTheDocument();
    expect(screen.getByTestId(histogramSelectors.chart)).toBeInTheDocument();
    expect(screen.queryByTestId(histogramSelectors.legend)).not.toBeInTheDocument();
  });

  it('invokes children callback with builder, alignedFrame, and xMinOnlyFrame', () => {
    const childrenMock = jest.fn(() => null);
    render(
      <Histogram {...defaultProps} legend={{ ...defaultLegendOptions, showLegend: false }}>
        {childrenMock}
      </Histogram>
    );

    // With showLegend: false, VizLayout calls children immediately (no measure delay)
    expect(childrenMock).toHaveBeenCalledTimes(1);
    const callArgs = childrenMock.mock.calls[0] as unknown as [UPlotConfigBuilder, DataFrame, DataFrame] | undefined;
    expect(callArgs).toBeDefined();
    const [builder, alignedFrame, xMinOnlyFrame] = callArgs!;
    expect(builder).toBeDefined();
    expect(alignedFrame).toBe(defaultProps.alignedFrame);
    expect(xMinOnlyFrame.fields.some((f) => f.name === 'xMax')).toBe(false);
    expect(xMinOnlyFrame.fields.some((f) => f.name === 'xMin')).toBe(true);
  });

  it('uses rawSeries for legend when combine is false', async () => {
    const rawFrame = createLinearHistogramFrame();
    render(
      <Histogram
        {...defaultProps}
        options={{ ...defaultProps.options, combine: false }}
        rawSeries={[rawFrame]}
        alignedFrame={rawFrame}
      />
    );

    expect(screen.getByTestId(histogramSelectors.container)).toBeInTheDocument();
    expect(screen.getByTestId(histogramSelectors.legend)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId(histogramSelectors.chart)).toBeInTheDocument();
    });
  });

  it('uses alignedFrame for legend when combine is true', async () => {
    const frame = createLinearHistogramFrame();
    render(
      <Histogram
        {...defaultProps}
        options={{ ...defaultProps.options, combine: true }}
        rawSeries={[frame]}
        alignedFrame={frame}
      />
    );

    expect(screen.getByTestId(histogramSelectors.container)).toBeInTheDocument();
    expect(screen.getByTestId(histogramSelectors.legend)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId(histogramSelectors.chart)).toBeInTheDocument();
    });
  });

  it('reconfigures when alignedFrame reference changes', async () => {
    const frame1 = createLinearHistogramFrame();
    const frame2 = createLinearHistogramFrame();

    const { rerender } = render(<Histogram {...defaultProps} alignedFrame={frame1} rawSeries={[frame1]} />);

    expect(screen.getByTestId(histogramSelectors.container)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId(histogramSelectors.chart)).toBeInTheDocument();
    });

    rerender(<Histogram {...defaultProps} alignedFrame={frame2} rawSeries={[frame2]} />);

    expect(screen.getByTestId(histogramSelectors.container)).toBeInTheDocument();
    expect(screen.getByTestId(histogramSelectors.chart)).toBeInTheDocument();
  });

  it('reconfigures when bucketSize or bucketCount changes', async () => {
    const { rerender } = render(<Histogram {...defaultProps} bucketSize={1} bucketCount={30} />);

    expect(screen.getByTestId(histogramSelectors.container)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId(histogramSelectors.chart)).toBeInTheDocument();
    });

    rerender(<Histogram {...defaultProps} bucketSize={2} bucketCount={15} />);

    expect(screen.getByTestId(histogramSelectors.container)).toBeInTheDocument();
    expect(screen.getByTestId(histogramSelectors.chart)).toBeInTheDocument();
  });

  describe('bug fix regression tests', () => {
    /**
     * Regression test for #116548: Histogram: Ensure range exists for log scale on x axis
     * When wantedMax is undefined, the log scale range callback would fail. The fix defaults to 1.
     */
    it('renders log-scale histogram (non-uniform buckets) without crashing', async () => {
      // Frame with non-uniform bucket sizes triggers useLogScale (bucketSize !== bucketSize1)
      const logScaleFrame = createDataFrame({
        fields: [
          { name: 'xMin', type: FieldType.number, values: [0.001, 0.0011, 0.00121] },
          { name: 'xMax', type: FieldType.number, values: [0.0011, 0.00121, 0.001331] },
          { name: 'count', type: FieldType.number, values: [10, 20, 15], config: {} },
        ],
      });
      logScaleFrame.fields[0].display = getDisplayProcessor({
        field: logScaleFrame.fields[0],
        theme,
      });
      logScaleFrame.fields[1].display = logScaleFrame.fields[0].display;
      logScaleFrame.fields[2].display = getDisplayProcessor({
        field: logScaleFrame.fields[2],
        theme,
      });

      render(
        <Histogram {...defaultProps} alignedFrame={logScaleFrame} bucketSize={0.0001} rawSeries={[logScaleFrame]} />
      );

      expect(screen.getByTestId(histogramSelectors.container)).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByTestId(histogramSelectors.chart)).toBeInTheDocument();
      });
    });

    /**
     * Regression test for #114557: Fix runaway bucket densification with extremely sparse + large datasets
     * getHistogramFields now caps densification at MAX_DENSIFIED_BUCKETS (1000) to prevent OOM.
     */
    it('renders sparse native histogram (HeatmapCells) without OOM from excessive densification', async () => {
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

      const frame = histogramFieldsToFrame(histFields!, theme);
      render(<Histogram {...defaultProps} alignedFrame={frame} bucketSize={0.00001} rawSeries={[frame]} />);

      expect(screen.getByTestId(histogramSelectors.container)).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByTestId(histogramSelectors.chart)).toBeInTheDocument();
      });
    });

    /**
     * Regression test for #110368: Histogram: Fix Tooltip placement issue
     * The dataIdx callback must return the correct bucket index for tooltip placement.
     * Uses bar start (xMin) to determine which bucket contains the cursor xValue.
     */
    it('cursor dataIdx returns correct bucket index for tooltip', () => {
      const childrenMock = jest.fn(() => null);
      render(
        <Histogram {...defaultProps} legend={{ ...defaultLegendOptions, showLegend: false }}>
          {childrenMock}
        </Histogram>
      );

      const callArgs = childrenMock.mock.calls[0] as unknown as [UPlotConfigBuilder, DataFrame, DataFrame] | undefined;
      const [builder] = callArgs!;
      const config = builder.getConfig();
      const dataIdx = config.cursor?.dataIdx;
      expect(dataIdx).toBeDefined();

      // Mock uPlot state: x data is [0, 1, 2, 3] (bucket starts), bucketSize=1
      const mockU: { data: AlignedData } = {
        data: [[0, 1, 2, 3]],
      };

      // xValue=0.5 is in bucket 0 [0,1); xValue < data[0][1]=1 so closestIdx=1 -> return 0
      expect(dataIdx(mockU, 0, 1, 0.5)).toBe(0);

      // xValue=1.5 is in bucket 1 [1,2); xValue >= data[0][1]=1 so return closestIdx=1
      expect(dataIdx(mockU, 0, 1, 1.5)).toBe(1);

      // xValue=2.9 is in bucket 2 [2,3); xValue >= data[0][2]=2 so return closestIdx=2
      expect(dataIdx(mockU, 0, 2, 2.9)).toBe(2);
    });
  });

  it('renders ordinal histogram frame (string bucket bounds)', async () => {
    const ordinalFrame = createOrdinalHistogramFrame();
    ordinalFrame.fields[0].display = getDisplayProcessor({
      field: ordinalFrame.fields[0],
      theme,
    });
    ordinalFrame.fields[1].display = ordinalFrame.fields[0].display;
    ordinalFrame.fields[2].display = getDisplayProcessor({
      field: ordinalFrame.fields[2],
      theme,
    });
    ordinalFrame.fields[2].config = {};

    render(<Histogram {...defaultProps} alignedFrame={ordinalFrame} bucketSize={1} rawSeries={[ordinalFrame]} />);

    expect(screen.getByTestId(histogramSelectors.container)).toBeInTheDocument();
    expect(screen.getByTestId(histogramSelectors.legend)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId(histogramSelectors.chart)).toBeInTheDocument();
    });
  });
});
