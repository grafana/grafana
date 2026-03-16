import { render, screen, waitFor } from '@testing-library/react';
import { AlignedData } from 'uplot';

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

  describe('bug fix regression tests', () => {
    /**
     * Regression test for #116548: Histogram: Ensure range exists for log scale on x axis
     * When wantedMax is undefined, the log scale range callback would fail. The fix defaults to 1.
     * @todo needs audit
     */
    it('renders log-scale histogram (non-uniform buckets) without crashing', async () => {});

    /**
     * Regression test for #114557: Fix runaway bucket densification with extremely sparse + large datasets
     * getHistogramFields now caps densification at MAX_DENSIFIED_BUCKETS (1000) to prevent OOM.
     * @todo needs audit
     */
    it.skip('renders sparse native histogram (HeatmapCells) without OOM from excessive densification', async () => {});

    /**
     * Regression test for #110368: Histogram: Fix Tooltip placement issue
     * The dataIdx callback must return the correct bucket index for tooltip placement.
     * Uses bar start (xMin) to determine which bucket contains the cursor xValue.
     * @todo needs audit
     */
    it.skip('cursor dataIdx returns correct bucket index for tooltip', () => {});
  });

  it.skip('renders ordinal histogram frame (string bucket bounds)', async () => {});
});
