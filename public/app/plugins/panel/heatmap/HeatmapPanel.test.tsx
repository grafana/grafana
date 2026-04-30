import { render, screen } from '@testing-library/react';

import { type DataFrame, FieldType, getDefaultTimeRange, LoadingState, toDataFrame } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { TooltipDisplayMode } from '@grafana/schema';

import { getPanelProps } from '../test-utils';

import { HeatmapPanel } from './HeatmapPanel';
import { defaultOptions, type Options } from './panelcfg.gen';
import { defaultOptions as fullDefaultOptions } from './types';

/**
 * Generates a 2D array of heatmap bucket values for testing.
 * Each row corresponds to a bucket (y-axis), each column to a time point (x-axis).
 * Produces deterministic values that vary by bucket and time for easy assertions.
 *
 * @param bucketNames - Bucket names (determines row count)
 * @param timeValues - Time values (determines column count)
 * @param options - Optional formula tuning: baseValue scales by bucket index, timeMultiplier scales by time index
 * @returns bucketValues[bucketIndex][timeIndex]
 */
function generateHeatmapBucketValues(
  bucketNames: string[],
  timeValues: number[],
  options?: { baseValue?: number; timeMultiplier?: number }
): number[][] {
  const baseValue = options?.baseValue ?? 10;
  const timeMultiplier = options?.timeMultiplier ?? 0.1;
  return bucketNames.map((_, bucketIndex) =>
    timeValues.map((_, timeIndex) => (bucketIndex + 1) * baseValue + (timeIndex + 1) * timeMultiplier)
  );
}

/**
 * Creates a minimal heatmap rows-style DataFrame (time + numeric bucket fields).
 * prepareHeatmapData accepts this format and converts it to heatmap cells internally.
 * Use this for tests that need valid heatmap visualization data.
 *
 * @param overrides - Optional field overrides (e.g. different values or field names)
 */
function createHeatmapRowsFrame(overrides?: {
  timeValues?: number[];
  bucketNames?: string[];
  bucketValues?: Array<Array<number | null>>;
}) {
  const timeValues = overrides?.timeValues ?? [1000, 2000, 3000];
  const bucketValues = overrides?.bucketValues ?? generateHeatmapBucketValues(['A', 'B', 'C'], timeValues);
  const bucketNames =
    overrides?.bucketNames ?? Array.from({ length: bucketValues.length }, (_, i) => String.fromCharCode(65 + i));

  const fields = [
    { name: 'time', type: FieldType.time, values: timeValues },
    ...bucketNames.map((name, i) => ({
      name,
      type: FieldType.number as const,
      config: { unit: 'short' as const },
      values: bucketValues[i],
    })),
  ];

  return toDataFrame({ fields });
}

/**
 * Returns default HeatmapPanel options merged with any overrides.
 * Uses full defaultOptions from types.ts to ensure all required fields are present.
 */
function getDefaultHeatmapPanelOptions(overrides?: Partial<Options>): Options {
  return {
    ...fullDefaultOptions,
    ...defaultOptions,
    ...overrides,
  };
}

const defaultPanelOptions: Options = getDefaultHeatmapPanelOptions({
  legend: { show: true },
  tooltip: {
    mode: TooltipDisplayMode.Single,
    yHistogram: false,
    showColorScale: false,
  },
});

describe('HeatmapPanel', () => {
  /**
   * Renders HeatmapPanel with the given data and options.
   * Reusable across tests to avoid duplicating setup.
   *
   * @param dataOverrides - Override series, annotations, or other data props
   * @param optionsOverrides - Override panel options
   * @param panelPropsOverrides - Override panel props (e.g. replaceVariables for DataLinks)
   */
  function renderHeatmapPanel(
    dataOverrides?: Partial<{ series: DataFrame[]; annotations?: DataFrame[] }>,
    optionsOverrides?: Partial<Options>,
    panelPropsOverrides?: Partial<{ replaceVariables: (v: string) => string }>
  ) {
    const mergedOptions = { ...defaultPanelOptions, ...optionsOverrides };
    const props = getPanelProps<Options>(mergedOptions, {
      data: {
        state: LoadingState.Done,
        series: [createHeatmapRowsFrame()],
        timeRange: getDefaultTimeRange(),
        ...dataOverrides,
      },
      ...panelPropsOverrides,
    });
    return render(<HeatmapPanel {...props} />);
  }
  it('renders heatmap visualization when data is valid', () => {
    renderHeatmapPanel();

    expect(screen.getByTestId(selectors.components.VizLayout.container)).toBeVisible();
  });

  it('shows error view when series is empty', () => {
    renderHeatmapPanel({ series: [] });

    expect(screen.queryByTestId(selectors.components.VizLayout.container)).not.toBeInTheDocument();
    expect(screen.getByText(/Unable to render data/)).toBeVisible();
  });

  it('shows error view when prepareHeatmapData throws', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const fieldsModule = require('./fields');
    const prepareSpy = jest.spyOn(fieldsModule, 'prepareHeatmapData').mockImplementation(() => {
      throw new Error('prepare failed');
    });

    renderHeatmapPanel();

    expect(screen.getByText(/prepare failed/)).toBeVisible();
    expect(screen.queryByTestId(selectors.components.VizLayout.container)).not.toBeInTheDocument();

    prepareSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('renders with custom heatmap data', () => {
    const customFrame = createHeatmapRowsFrame({
      timeValues: [1, 2],
      bucketNames: ['Low', 'High'],
      bucketValues: [
        [5, 10],
        [15, 20],
      ],
    });

    renderHeatmapPanel({ series: [customFrame] });

    expect(screen.getByTestId(selectors.components.VizLayout.container)).toBeVisible();
  });

  describe('Regression: negative values (PR #98887, #96741)', () => {
    // Heatmap panels with all-negative bucket values previously crashed or
    // rendered a blank canvas because boundedMinMax returned an inverted color
    // range (minValue > maxValue).
    it('renders without error when all bucket values are negative', () => {
      const negativeFrame = createHeatmapRowsFrame({
        bucketNames: ['A', 'B', 'C'],
        bucketValues: [
          [-30, -25, -20],
          [-20, -15, -10],
          [-10, -5, -1],
        ],
      });

      renderHeatmapPanel({ series: [negativeFrame] });

      expect(screen.getByTestId(selectors.components.VizLayout.container)).toBeVisible();
    });

    // A single series frame where every cell value is exactly 0 should render,
    // not show an error view.
    it('renders without error when all bucket values are zero', () => {
      const zeroFrame = createHeatmapRowsFrame({
        bucketValues: [
          [0, 0, 0],
          [0, 0, 0],
          [0, 0, 0],
        ],
      });

      renderHeatmapPanel({ series: [zeroFrame] });

      expect(screen.getByTestId(selectors.components.VizLayout.container)).toBeVisible();
    });
  });

  describe('Regression: all-null values (PR #89428)', () => {
    // When every value in a bucket field is null, prepareHeatmapData must not
    // throw and the panel must show the VizLayout container (not the error view).
    it('renders without error when all bucket values are null', () => {
      const nullFrame = createHeatmapRowsFrame({
        bucketNames: ['A', 'B'],
        bucketValues: [
          [null, null, null],
          [null, null, null],
        ],
      });

      renderHeatmapPanel({ series: [nullFrame] });

      expect(screen.getByTestId(selectors.components.VizLayout.container)).toBeVisible();
    });
  });
});
