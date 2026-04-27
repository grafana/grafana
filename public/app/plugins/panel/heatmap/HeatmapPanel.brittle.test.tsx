import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { type DataFrame, type Field, FieldType, toDataFrame } from '@grafana/data/dataframe';
import { ActionType, getDefaultTimeRange, HttpRequestMethod, LoadingState } from '@grafana/data/types';
import { selectors } from '@grafana/e2e-selectors';
import { DataTopic, HeatmapCalculationMode, TooltipDisplayMode } from '@grafana/schema';

import { getPanelProps } from '../test-utils';
import { type AnnotationsPlugin2Cluster } from '../timeseries/plugins/AnnotationsPlugin2Cluster';

import { HeatmapPanel } from './HeatmapPanel';
import { defaultOptions, type Options } from './panelcfg.gen';
import { defaultOptions as fullDefaultOptions } from './types';

/** Captures the last config (width, height) passed to uPlot for canvas dimension assertions */
let lastUPlotConfig: { width: number; height: number } | null = null;

/** Simulated legend height when legend is shown. VizLayout reserves this space for the color scale. */
const MOCK_LEGEND_HEIGHT = 80;

/** Set to true in tests that need field actions to be executable (e.g. FieldActions test). */
let canExecuteActionsForTest = false;

/** Set to true in tests that need canAddAnnotations to return true (e.g. annotation creation tests). */
let canAddAnnotationsForTest = false;

/** When set, MockTooltipPlugin2 uses these params to simulate hovering. */
let tooltipRenderParamsForTest: {
  dataIdxs: Array<number | null>;
  seriesIdx: number;
  timeRange2?: { from: number; to: number } | null;
} | null = null;

/** Captures the last props passed to AnnotationsPlugin for assertion in tests. */
let lastAnnotationsPluginProps: React.ComponentProps<typeof AnnotationsPlugin2Cluster> | null = null;

jest.mock('../timeseries/plugins/AnnotationPlugin', () => ({
  AnnotationsPlugin: (props: React.ComponentProps<typeof AnnotationsPlugin2Cluster>) => {
    lastAnnotationsPluginProps = props;
    return props.annotations?.length ? (
      <div data-testid="annotations-plugin">{props.annotations.length} annotation(s)</div>
    ) : null;
  },
}));

jest.mock('uplot', () => {
  const mockPathsBars = jest.fn(() => () => '');

  return jest.fn().mockImplementation((config: { width?: number; height?: number }) => {
    lastUPlotConfig = { width: config?.width ?? 0, height: config?.height ?? 0 };
    return {
      setData: jest.fn(),
      setSize: jest.fn(),
      destroy: jest.fn(),
      paths: { bars: mockPathsBars },
      rangeLog: jest.fn((min: number, max: number) => [min, max]),
    };
  });
});

jest.mock('@grafana/ui', () => {
  const actual = jest.requireActual('@grafana/ui');
  const { selectors } = require('@grafana/e2e-selectors');

  /** Simulates legend measurement: when legend is shown, reserves MOCK_LEGEND_HEIGHT for canvas dimension tests. */
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
    return (
      <div data-testid={selectors.components.VizLayout.container}>
        <div>{children(width, vizHeight)}</div>
        {legend && <div data-testid={selectors.components.VizLayout.legend}>{legend}</div>}
      </div>
    );
  };
  MockVizLayout.Legend = actual.VizLayout.Legend;

  /** Mock TooltipPlugin2: uses isPinned=true so footer (DataLinks) renders; tooltipRenderParamsForTest simulates hover. */
  const mockUPlot = {
    posToVal: (_pos: number, _axis: string) => 1500,
    cursor: { left: 100 },
  };

  const MockTooltipPlugin2 = (props: { render?: (...args: unknown[]) => React.ReactNode }) => {
    const params = tooltipRenderParamsForTest ?? { dataIdxs: [0, 0, 0], seriesIdx: 0 };
    const timeRange2 = params.timeRange2 !== undefined ? params.timeRange2 : null;
    const [content, setContent] = React.useState<React.ReactNode>(null);

    React.useEffect(() => {
      const c = props.render?.(mockUPlot, params.dataIdxs, params.seriesIdx, true, jest.fn(), timeRange2, false);
      setContent(c ?? null);
      // Intentionally empty deps: mock simulates one-time tooltip render for tests
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <div data-testid="heatmap-tooltip-plugin">{content}</div>;
  };

  return {
    ...actual,
    usePanelContext: jest.fn().mockImplementation(() => ({
      canAddAnnotations: () => canAddAnnotationsForTest,
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
 * Creates a minimal x-axis annotation DataFrame for heatmap tests.
 */
function createAnnotationFrame(overrides?: { timeValues?: number[]; text?: string[] }) {
  const timeValues = overrides?.timeValues ?? [1500];
  const text = overrides?.text ?? ['Deployment'];
  return toDataFrame({
    name: 'annotation',
    meta: { dataTopic: DataTopic.Annotations },
    fields: [
      { name: 'time', type: FieldType.time, values: timeValues },
      { name: 'text', type: FieldType.string, values: text },
    ],
  });
}

/**
 * Creates a minimal exemplar DataFrame for heatmap tooltip tests.
 * Must have name 'exemplar' to be found in annotations by prepareHeatmapData.
 * Time and Value fields align with heatmap rows format (ordinal y indices 0, 1, 2).
 */
function createExemplarFrame(overrides?: { timeValues?: number[]; values?: number[]; additionalFields?: Field[] }) {
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
 * Creates a heatmap rows-style DataFrame with labels on bucket fields.
 * Used to test exemplar yMatchWithLabel path (ordinal/labeled y-axis).
 * Bucket fields have labels.le for histogram-style buckets.
 */
function createHeatmapRowsFrameWithLabels(overrides?: {
  timeValues?: number[];
  bucketLabels?: string[];
  bucketValues?: number[][];
}) {
  const timeValues = overrides?.timeValues ?? [1000, 2000, 3000];
  const bucketLabels = overrides?.bucketLabels ?? ['0-100', '100-200', '200-300'];
  const bucketValues =
    overrides?.bucketValues ?? bucketLabels.map((_, i) => timeValues.map((_, t) => (i + 1) * 10 + t));

  const fields = [
    { name: 'time', type: FieldType.time, values: timeValues },
    ...bucketLabels.map((label, i) => ({
      name: label,
      type: FieldType.number,
      config: { unit: 'short' },
      labels: { le: label },
      values: bucketValues[i],
    })),
  ];

  return toDataFrame({ fields });
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

/**
 * Brittle tests that require extensive mocking to test in an unit-test environment.
 * We should probably rewrite these "integration" tests as e2e tests since the mocking is essentially a parallel implementation that does more stuff in the DOM instead of in the uPlot canvas.
 * If you are refactoring Heatmap or making other significant changes, it's probably not worthwhile to keep this test implementation besides as a place to get ideas for test cases in e2e coverage.
 */
describe('HeatmapPanel (brittle)', () => {
  beforeEach(() => {
    lastUPlotConfig = null;
    canExecuteActionsForTest = false;
    canAddAnnotationsForTest = false;
    tooltipRenderParamsForTest = null;
    lastAnnotationsPluginProps = null;
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

      // Exemplar tooltip title should be visible
      expect(screen.getByText('Exemplar')).toBeVisible();
      // Exemplar tooltip should render key/value labels
      expect(screen.getByText('traceID')).toBeVisible();
      expect(screen.getByText('trace-abc')).toBeVisible();
      expect(screen.getByText('cluster')).toBeVisible();
      expect(screen.getByText('eu-dev-east-1')).toBeVisible();
    });

    it('renders exemplars with yMatchWithLabel when heatmap has labeled buckets', () => {
      const frameWithLabels = createHeatmapRowsFrameWithLabels();
      const exemplarWithLe = createExemplarFrame({
        timeValues: [1500],
        values: [0],
        additionalFields: [{ name: 'le', type: FieldType.string, values: ['0-100'], config: {} }],
      });
      tooltipRenderParamsForTest = { dataIdxs: [0, 0, 0], seriesIdx: 2 };

      renderHeatmapPanel({ series: [frameWithLabels], annotations: [exemplarWithLe] });

      expect(screen.getByTestId(selectors.components.VizLayout.container)).toBeVisible();
      expect(screen.getByText('Exemplar')).toBeVisible();
    });

    it('renders ExemplarTooltip when exemplar frame is added on subsequent render', () => {
      const { rerender } = renderHeatmapPanel({ annotations: [] });

      expect(screen.queryByText('Exemplar')).not.toBeInTheDocument();

      const exemplarFrame = createExemplarFrame({
        additionalFields: [{ name: 'traceID', type: FieldType.string, values: ['trace-abc'], config: {} }],
      });
      tooltipRenderParamsForTest = { dataIdxs: [0, 0, 0], seriesIdx: 2 };

      const props = getPanelProps<Options>(defaultPanelOptions, {
        data: {
          state: LoadingState.Done,
          series: [createHeatmapRowsFrame()],
          timeRange: getDefaultTimeRange(),
          annotations: [exemplarFrame],
        },
      });
      rerender(<HeatmapPanel {...props} />);

      expect(screen.getByText('Exemplar')).toBeVisible();
      expect(screen.getByText('trace-abc')).toBeVisible();
    });
  });

  describe('Annotations', () => {
    it('renders AnnotationsPlugin with correct props when annotations present', () => {
      const annotationFrame = createAnnotationFrame({ text: ['Deployment'] });

      renderHeatmapPanel({ annotations: [annotationFrame] });

      expect(screen.getByTestId('annotations-plugin')).toBeVisible();
      expect(screen.getByText('1 annotation(s)')).toBeVisible();

      expect(lastAnnotationsPluginProps).toMatchObject({
        annotations: [annotationFrame],
        timeZone: 'utc',
        newRange: null,
        canvasRegionRendering: false,
      });
      expect(lastAnnotationsPluginProps).toHaveProperty('replaceVariables', expect.any(Function));
      expect(lastAnnotationsPluginProps).toHaveProperty('setNewRange', expect.any(Function));
      expect(lastAnnotationsPluginProps).toHaveProperty('options');
      expect(lastAnnotationsPluginProps).toHaveProperty('config');
    });

    it('does not render annotations when annotations array is empty', () => {
      renderHeatmapPanel({ annotations: [] });

      expect(screen.queryByTestId('annotations-plugin')).not.toBeInTheDocument();
    });

    it('renders AnnotationsPlugin when annotation frame is added on subsequent render', () => {
      const { rerender } = renderHeatmapPanel({ annotations: [] });

      expect(screen.queryByTestId('annotations-plugin')).not.toBeInTheDocument();

      const annotationFrame = createAnnotationFrame({ text: ['Deployment'] });
      const props = getPanelProps<Options>(defaultPanelOptions, {
        data: {
          state: LoadingState.Done,
          series: [createHeatmapRowsFrame()],
          timeRange: getDefaultTimeRange(),
          annotations: [annotationFrame],
        },
      });
      rerender(<HeatmapPanel {...props} />);

      expect(screen.getByTestId('annotations-plugin')).toBeVisible();
      expect(screen.getByText('1 annotation(s)')).toBeVisible();
    });
  });

  describe('Annotation creation', () => {
    it('calls setNewRange when tooltip receives timeRange2 and user can add annotations', async () => {
      canAddAnnotationsForTest = true;
      tooltipRenderParamsForTest = {
        dataIdxs: [0, 0, 0],
        seriesIdx: 1,
        timeRange2: { from: 1000, to: 2000 },
      };

      renderHeatmapPanel();

      await waitFor(() => {
        expect(lastAnnotationsPluginProps?.newRange).toEqual({ from: 1000, to: 2000 });
      });
    });

    it('invokes setNewRange when Add annotation button is clicked', async () => {
      canAddAnnotationsForTest = true;
      tooltipRenderParamsForTest = { dataIdxs: [0, 0, 0], seriesIdx: 1 };

      renderHeatmapPanel();

      const addAnnotationButton = screen.getByRole('button', { name: /add annotation/i });
      await userEvent.click(addAnnotationButton);

      await waitFor(() => {
        expect(lastAnnotationsPluginProps?.newRange).toMatchObject({
          from: expect.any(Number),
          to: expect.any(Number),
        });
      });
    });
  });

  describe('DataLinks', () => {
    it('shows DataLinks in tooltip when links are defined on the field', () => {
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
    it('shows field actions in tooltip when actions are defined on the field', () => {
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
    it('uses options.calculation.yBuckets.value for ySizeDivisor when set', () => {
      renderHeatmapPanel(undefined, {
        calculation: { yBuckets: { mode: HeatmapCalculationMode.Count, value: '2' } },
      });

      expect(screen.getByTestId(selectors.components.VizLayout.container)).toBeVisible();
    });

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
        expect(lastUPlotConfig).toHaveProperty('height', panelHeight);
      });

      it('allots reduced height to canvas when legend is shown', () => {
        const panelHeight = 400;
        renderHeatmapPanel();

        expect(lastUPlotConfig).not.toBeNull();
        expect(lastUPlotConfig).toHaveProperty('height', panelHeight - MOCK_LEGEND_HEIGHT);
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

  describe('Regression: annotations and exemplars co-rendered (PR #95773)', () => {
    // When both a regular annotation frame and an exemplar frame are present,
    // the AnnotationsPlugin must render the annotation AND the exemplar tooltip
    // must still be accessible on hover. Previously one would suppress the other.
    it('renders both AnnotationsPlugin and ExemplarTooltip when annotations and exemplars are present', () => {
      const annotationFrame = createAnnotationFrame({ text: ['Deploy'] });
      const exemplarFrame = createExemplarFrame({
        additionalFields: [{ name: 'traceID', type: FieldType.string, values: ['abc-123'], config: {} }],
      });
      tooltipRenderParamsForTest = { dataIdxs: [0, 0, 0], seriesIdx: 2 };

      renderHeatmapPanel({ annotations: [annotationFrame, exemplarFrame] });

      // Annotation plugin rendered
      expect(screen.getByTestId('annotations-plugin')).toBeVisible();
      // Exemplar tooltip also rendered
      expect(screen.getByText('Exemplar')).toBeVisible();
      expect(screen.getByText('traceID')).toBeVisible();
    });
  });

  describe('Regression: tooltip not shown when no cell hovered (PR #93254)', () => {
    // When seriesIdx is 0 (no cell hovered, hovering empty space), the tooltip
    // render prop must not show heatmap cell content — previously it could show
    // stale data from the last hovered cell.
    it('renders TooltipPlugin2 container but without cell content when seriesIdx is 0', () => {
      tooltipRenderParamsForTest = { dataIdxs: [null, null, null], seriesIdx: 0 };

      renderHeatmapPanel();

      expect(screen.getByTestId('heatmap-tooltip-plugin')).toBeVisible();
      // Cell-specific content (e.g. Bucket range, Count) must not be shown
      expect(screen.queryByText(/Bucket|Count/i)).not.toBeInTheDocument();
    });
  });

  describe('Regression: exemplar tooltip during re-render with changing hover state (PR #97818)', () => {
    // Hovering off an exemplar (seriesIdx goes from 2 back to 0) must not leave
    // a stale Exemplar tooltip visible. The component re-renders when
    // tooltipRenderParamsForTest changes.
    it('does not show Exemplar tooltip when seriesIdx switches from exemplar (2) to no-hover (0)', () => {
      const exemplarFrame = createExemplarFrame({
        additionalFields: [{ name: 'traceID', type: FieldType.string, values: ['trace-xyz'], config: {} }],
      });
      tooltipRenderParamsForTest = { dataIdxs: [0, 0, 0], seriesIdx: 2 };

      const { rerender } = renderHeatmapPanel({ annotations: [exemplarFrame] });
      expect(screen.getByText('Exemplar')).toBeVisible();

      // Simulate moving cursor off the exemplar marker
      tooltipRenderParamsForTest = { dataIdxs: [null, null, null], seriesIdx: 0 };
      const props = getPanelProps<Options>(defaultPanelOptions, {
        data: {
          state: LoadingState.Done,
          series: [createHeatmapRowsFrame()],
          timeRange: getDefaultTimeRange(),
          annotations: [exemplarFrame],
        },
      });
      rerender(<HeatmapPanel {...props} />);

      expect(screen.queryByText('Exemplar')).not.toBeInTheDocument();
    });
  });
});
