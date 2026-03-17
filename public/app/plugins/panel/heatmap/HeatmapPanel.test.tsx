import { render, screen } from '@testing-library/react';
import React from 'react';

import {
  ActionType,
  DataFrame,
  Field,
  FieldType,
  getDefaultTimeRange,
  HttpRequestMethod,
  LoadingState,
  toDataFrame,
} from '@grafana/data';
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

/** Set to true in tests that need field actions to be executable (e.g. FieldActions test). */
let canExecuteActionsForTest = false;

/** When set, MockTooltipPlugin2 uses these params to simulate hovering over exemplar (seriesIdx=2). */
let tooltipRenderParamsForTest: { dataIdxs: Array<number | null>; seriesIdx: number } | null = null;

jest.mock('app/features/dashboard/services/DashboardSrv', () => ({
  getDashboardSrv: () => ({
    getCurrent: () => ({
      formatDate: (v: number) => new Date(v).toISOString(),
    }),
  }),
}));

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

  /**
   * Mock TooltipPlugin2 to detect when tooltip is rendered.
   * HeatmapPanel conditionally renders TooltipPlugin2 based on options.tooltip.mode.
   * Uses isPinned=true so the footer (including DataLinks) is rendered for testing.
   * When tooltipRenderParamsForTest is set, simulates hover over exemplar (seriesIdx=2).
   */
  const MockTooltipPlugin2 = (props: { render?: (...args: unknown[]) => React.ReactNode }) => {
    const params = tooltipRenderParamsForTest ?? { dataIdxs: [0, 0, 0], seriesIdx: 0 };
    const content = props.render?.({}, params.dataIdxs, params.seriesIdx, true, jest.fn(), null, false);
    return <div data-testid="heatmap-tooltip-plugin">{content}</div>;
  };

  return {
    ...actual,
    usePanelContext: jest.fn().mockImplementation(() => ({
      sync: () => 0,
      eventsScope: 'global',
      canAddAnnotations: () => false,
      onSelectRange: jest.fn(),
      canExecuteActions: () => canExecuteActionsForTest,
    })),
    VizLayout: MockVizLayout,
    TooltipPlugin2: MockTooltipPlugin2,
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
 * Creates a heatmap rows-style DataFrame with DataLinks on the first bucket field.
 * Used for tests that verify link rendering in the tooltip footer.
 *
 * @param linkConfig - Link config (url, title) for the first bucket field
 */
function createHeatmapRowsFrameWithLinks(linkConfig: { url: string; title: string }) {
  const frame = createHeatmapRowsFrame();
  const firstBucketField = frame.fields[1];
  firstBucketField.config = {
    ...firstBucketField.config,
    links: [{ url: linkConfig.url, title: linkConfig.title }],
  };
  return frame;
}

/**
 * Creates a minimal exemplar DataFrame for heatmap tooltip tests.
 * Must have name 'exemplar' to be found in annotations by prepareHeatmapData.
 * Time and Value fields align with heatmap rows format (ordinal y indices 0, 1, 2).
 */
function createExemplarFrame(overrides?: { timeValues?: number[]; values?: string[]; additionalFields?: Field[] }) {
  const timeValues = overrides?.timeValues ?? [1500];
  const values = overrides?.values ?? [200];
  const additionalFields = overrides?.additionalFields ?? [];

  return toDataFrame({
    name: 'exemplar',
    meta: { custom: { resultType: 'exemplar' } },
    fields: [
      { name: 'Time', type: FieldType.time, values: timeValues },
      { name: 'Value', type: FieldType.number, values },
      ...additionalFields,
    ],
  });
}

/**
 * Creates a heatmap rows-style DataFrame with field actions on the first bucket field.
 * Requires canExecuteActionsForTest=true and field.state.scopedVars for actions to render.
 *
 * @param actionConfig - Action config (title, url) for the first bucket field
 */
function createHeatmapRowsFrameWithActions(actionConfig: { title: string; url: string }) {
  const frame = createHeatmapRowsFrame();
  const firstBucketField = frame.fields[1];
  firstBucketField.config = {
    ...firstBucketField.config,
    actions: [
      {
        type: ActionType.Fetch,
        title: actionConfig.title,
        [ActionType.Fetch]: {
          url: actionConfig.url,
          method: HttpRequestMethod.POST,
          body: '{}',
          queryParams: [],
          headers: [['Content-Type', 'application/json']],
        },
      },
    ],
  };
  firstBucketField.state = { scopedVars: {} };
  return frame;
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
    canExecuteActionsForTest = false;
    tooltipRenderParamsForTest = null;
  });

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

  describe('Exemplars', () => {
    it('renders ExemplarTooltip when hovering over exemplar marker', () => {
      const exemplarFrame = createExemplarFrame({
        additionalFields: [
          { name: 'traceID', type: FieldType.string, values: ['trace-abc'], config: {} },
          { name: 'cluster', type: FieldType.string, values: ['eu-dev-east-1'], config: {} },
        ],
      });
      tooltipRenderParamsForTest = { dataIdxs: [0, 0, 0], seriesIdx: 2 };

      renderHeatmapPanel({ annotations: [exemplarFrame] });

      expect(screen.getByText('Exemplar')).toBeVisible();
      expect(screen.getByText('trace-abc')).toBeVisible();
      expect(screen.getByText('eu-dev-east-1')).toBeVisible();
      expect(screen.getByText('cluster')).toBeVisible();
      expect(screen.getByText('traceID')).toBeVisible();
    });
  });
  describe('Annotations', () => {});
  describe('DataLinks', () => {
    it('shows DataLinks in tooltip when links are defined on the dataframe field', () => {
      const linkTitle = 'View in Explorer';
      const linkUrl = 'https://example.com';
      const frameWithLinks = createHeatmapRowsFrameWithLinks({
        url: linkUrl,
        title: linkTitle,
      });

      renderHeatmapPanel({ series: [frameWithLinks] }, undefined, { replaceVariables: (v) => v });

      expect(screen.getByText(linkTitle)).toBeVisible();
      expect(screen.getByRole('link', { name: linkTitle })).toHaveAttribute('href', linkUrl);
    });
  });

  describe('FieldActions', () => {
    it('shows field actions in tooltip when actions are defined on the dataframe field', () => {
      const actionTitle = 'Run query';
      const actionUrl = 'https://api.example.com/run';
      const frameWithActions = createHeatmapRowsFrameWithActions({
        title: actionTitle,
        url: actionUrl,
      });

      canExecuteActionsForTest = true;
      renderHeatmapPanel({ series: [frameWithActions] }, undefined, { replaceVariables: (v) => v });

      expect(screen.getByRole('button', { name: actionTitle })).toBeVisible();
    });
  });

  describe('Options', () => {
    describe('legend', () => {
      it('displays legend when legend.show is true', () => {
        renderHeatmapPanel();

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
        renderHeatmapPanel();

        expect(lastUPlotConfig).not.toBeNull();
        expect(lastUPlotConfig!.height).toBe(panelHeight - MOCK_LEGEND_HEIGHT);
      });
    });
    describe('tooltip', () => {
      it('renders TooltipPlugin2 when tooltip mode is not None', () => {
        renderHeatmapPanel();

        expect(screen.getByTestId('heatmap-tooltip-plugin')).toBeVisible();
      });

      it('does not render TooltipPlugin2 when tooltip mode is None', () => {
        renderHeatmapPanel(undefined, {
          tooltip: {
            mode: TooltipDisplayMode.None,
          },
        });

        expect(screen.queryByTestId('heatmap-tooltip-plugin')).not.toBeInTheDocument();
      });
    });
  });
});
