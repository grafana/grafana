import { render, screen } from '@testing-library/react';
import React from 'react';

import { DataFrame, FieldType, getDefaultTimeRange, LoadingState, toDataFrame } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { TooltipDisplayMode } from '@grafana/schema';

import { getPanelProps } from '../test-utils';

import { HeatmapPanel } from './HeatmapPanel';
import { defaultOptions, Options } from './panelcfg.gen';
import { defaultOptions as fullDefaultOptions } from './types';

/** Captures the last config (width, height) passed to uPlot for canvas dimension assertions */
let lastUPlotConfig: { width: number; height: number } | null = null;

/** Simulated legend height when legend is shown. VizLayout reserves this space for the color scale. */
const MOCK_LEGEND_HEIGHT = 80;

// Mock uPlot to avoid canvas initialization in tests.
// HeatmapPanel uses UPlotChart which depends on uPlot for rendering the canvas visualization.
jest.mock('uplot', () => {
  const mockPathsBars = jest.fn(() => () => '');
  const mock = jest.fn().mockImplementation((config: { width?: number; height?: number }) => {
    lastUPlotConfig = { width: config?.width ?? 0, height: config?.height ?? 0 };
    return {
      setData: jest.fn(),
      setSize: jest.fn(),
      destroy: jest.fn(),
    };
  }) as jest.Mock & {
    paths: { bars: jest.Mock };
    rangeLog: (min: number, max: number) => [number, number];
  };
  mock.paths = { bars: mockPathsBars };
  mock.rangeLog = jest.fn((min: number, max: number) => [min, max]);
  return mock;
});

/**
 * Mocks usePanelContext with safe defaults for HeatmapPanel tests.
 * HeatmapPanelViz uses sync, eventsScope, canAddAnnotations, onSelectRange, and canExecuteActions.
 *
 * @param overrides - Partial overrides for the default mock values
 * @returns Mock implementation passed to jest.spyOn or jest.mock
 */
function createUsePanelContextMock(overrides?: {
  sync?: () => number;
  canAddAnnotations?: () => boolean;
  onSelectRange?: () => void;
  canExecuteActions?: () => boolean;
}) {
  return jest.fn().mockReturnValue({
    sync: () => 0,
    eventsScope: 'global',
    canAddAnnotations: () => false,
    onSelectRange: jest.fn(),
    canExecuteActions: () => false,
    ...overrides,
  });
}

jest.mock('@grafana/ui', () => {
  const actual = jest.requireActual('@grafana/ui');
  const { selectors } = require('@grafana/e2e-selectors');

  /**
   * Mock VizLayout that simulates legend measurement for deterministic canvas dimension tests.
   * When legend is shown, reserves MOCK_LEGEND_HEIGHT so the canvas receives reduced height.
   */
  const MockVizLayout = ({
    width,
    height,
    legend,
    children,
  }: {
    width: number;
    height: number;
    legend: React.ReactNode;
    children: (w: number, h: number) => React.ReactNode;
  }) => {
    const vizHeight = legend ? height - MOCK_LEGEND_HEIGHT : height;
    const vizWidth = width;

    return (
      <div data-testid={selectors.components.VizLayout.container}>
        <div>{children(vizWidth, vizHeight)}</div>
        {legend && (
          <div data-testid={selectors.components.VizLayout.legend} style={{ height: MOCK_LEGEND_HEIGHT }}>
            {legend}
          </div>
        )}
      </div>
    );
  };
  MockVizLayout.Legend = actual.VizLayout.Legend;

  return {
    ...actual,
    usePanelContext: createUsePanelContextMock(),
    VizLayout: MockVizLayout,
  };
});

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
  bucketValues?: number[][];
}) {
  const timeValues = overrides?.timeValues ?? [1000, 2000, 3000];
  const bucketNames = overrides?.bucketNames ?? ['A', 'B', 'C'];
  const bucketValues = overrides?.bucketValues ?? generateHeatmapBucketValues(bucketNames, timeValues);

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
  } as Options;
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
  beforeEach(() => {
    lastUPlotConfig = null;
  });

  /**
   * Renders HeatmapPanel with the given data and options.
   * Reusable across tests to avoid duplicating setup.
   */
  function renderHeatmapPanel(dataOverrides?: Partial<{ series: DataFrame[] }>, optionsOverrides?: Partial<Options>) {
    const mergedOptions = { ...defaultPanelOptions, ...optionsOverrides };
    const props = getPanelProps<Options>(mergedOptions, {
      data: {
        state: LoadingState.Done,
        series: [createHeatmapRowsFrame()],
        timeRange: getDefaultTimeRange(),
        ...dataOverrides,
      },
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

  describe('legend option', () => {
    it('displays legend when legend.show is true', () => {
      renderHeatmapPanel(undefined, { legend: { show: true } });

      expect(screen.getByTestId(selectors.components.VizLayout.legend)).toBeVisible();
    });

    it('hides legend when legend.show is false', () => {
      renderHeatmapPanel(undefined, { legend: { show: false } });

      expect(screen.queryByTestId(selectors.components.VizLayout.legend)).not.toBeInTheDocument();
    });

    it('allots full panel height to canvas when legend is hidden', () => {
      const panelHeight = 400;
      renderHeatmapPanel(undefined, { legend: { show: false } });

      expect(lastUPlotConfig).not.toBeNull();
      expect(lastUPlotConfig!.height).toBe(panelHeight);
    });

    it('allots reduced height to canvas when legend is shown', () => {
      const panelHeight = 400;
      renderHeatmapPanel(undefined, { legend: { show: true } });

      expect(lastUPlotConfig).not.toBeNull();
      expect(lastUPlotConfig!.height).toBe(panelHeight - MOCK_LEGEND_HEIGHT);
    });
  });
});
