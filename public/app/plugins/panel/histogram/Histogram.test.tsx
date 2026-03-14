import { render, screen, waitFor } from '@testing-library/react';

import {
  buildHistogram,
  createDataFrame,
  createTheme,
  DataFrame,
  FieldType,
  getDisplayProcessor,
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
      // buildHistogram creates uniform buckets; first bucket span
      expect(bucketSize).toBeGreaterThan(0);
      expect(typeof bucketSize).toBe('number');
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
      combine: false,
      bucketCount: 30,
      legend: defaultLegendOptions,
      tooltip: { mode: TooltipDisplayMode.Single, sort: SortOrder.None },
    },
    theme,
    legend: defaultLegendOptions,
    width: 400,
    height: 300,
    bucketSize: 1,
    alignedFrame: createLinearHistogramFrame(),
    rawSeries: [createLinearHistogramFrame()],
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
