import { render, screen, waitFor } from '@testing-library/react';
import type uPlot from 'uplot';

import {
  applyFieldOverrides,
  createDataFrame,
  createFieldConfigRegistry,
  createTheme,
  DataTopic,
  dateTime,
  type FieldConfigSource,
  FieldColorModeId,
  FieldType,
  LoadingState,
  type PanelData,
  type PanelProps,
  type TimeRange,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { LegendDisplayMode, SortOrder, TooltipDisplayMode, VisibilityMode } from '@grafana/schema';
import {
  applyDefaultUPlotAxisMeasureTextMock,
  installCanvasPath2DShim,
  removeCanvasTransforms,
} from '@grafana/test-utils/canvas';
import { measureText as uPlotAxisMeasureText, type UPlotConfigBuilder } from '@grafana/ui';
import * as timeSeriesUtils from 'app/core/components/TimeSeries/utils';

import { getPanelProps } from '../test-utils';

import { TimeSeriesPanel } from './TimeSeriesPanel';
import { defaultGraphConfig, getGraphFieldConfig } from './config';
import { type Options } from './panelcfg.gen';

// uPlot builds series area fills via the Path2D copy constructor, which jest-canvas-mock drops; this shim
// preserves it so fills, gradient bands, and markers land in the captured draw calls.
installCanvasPath2DShim();

// --- Shared setup & fixtures ---

// The panel framework runs applyFieldOverrides before rendering; a unit test must do it too, or the
// custom config (drawStyle, fillOpacity, etc.) never reaches field.config.custom and every case renders
// identically. The registry carries the time series custom config so those defaults get applied.
const graphFieldConfigRegistry = createFieldConfigRegistry(getGraphFieldConfig(defaultGraphConfig), 'Time series');

const theme = createTheme();

const width = 648;
const height = 378;

export const fixedBlue: Partial<FieldConfigSource['defaults']> = {
  color: { mode: FieldColorModeId.Fixed, fixedColor: 'blue' },
};

// pointSize/showPoints are editor defaults (config.ts) that applyFieldOverrides does not inject. Without
// them point markers never render, even though a default panel shows them.
const defaultGraphCustom: typeof defaultGraphConfig = {
  ...defaultGraphConfig,
  pointSize: 5,
  showPoints: VisibilityMode.Auto,
};

interface WithFieldConfigArgs {
  /** custom graph overrides layered on the panel default config */
  custom?: Partial<typeof defaultGraphConfig>;
  /** top-level field defaults (color, thresholds, min/max) merged alongside custom */
  defaults?: Partial<FieldConfigSource['defaults']>;
}

export function withFieldConfig({ custom, defaults }: WithFieldConfigArgs = {}): Partial<PanelProps<Options>> {
  return {
    fieldConfig: {
      overrides: [],
      defaults: { ...defaults, custom: { ...defaultGraphCustom, ...custom } },
    },
  };
}

// Real timestamps one day apart so the x-axis shows several grid lines with formatted date labels, rather
// than the 00:00:00-00:00:05 that tiny epoch values produce. Date.UTC keeps it deterministic across zones.
export const START_MS = Date.UTC(2024, 0, 1);
export const DAY_MS = 24 * 60 * 60 * 1000;

const dailyTimestamps = () => Array.from({ length: 5 }, (_, i) => START_MS + i * DAY_MS);

function createTimeSeriesFrame() {
  return createDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: dailyTimestamps() },
      { name: 'value', type: FieldType.number, values: [10, 20, 15, 25, 18] },
    ],
  });
}

export function createMultiSeriesFrame() {
  const timeValues = dailyTimestamps();
  return createDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: timeValues },
      ...Array.from({ length: 3 }, (_, i) => ({
        name: `series${i + 1}`,
        type: FieldType.number,
        values: timeValues.map((_, t) => (i + 1) * 10 + t * 2),
      })),
    ],
  });
}

export function createAnnotationFrame(overrides?: { timeValues?: number[]; timeEnd?: number[] }) {
  const timeValues = overrides?.timeValues ?? [START_MS + 2 * DAY_MS];
  const timeEnd = overrides?.timeEnd;
  return createDataFrame({
    name: 'annotation',
    meta: { dataTopic: DataTopic.Annotations },
    fields: [
      { name: 'time', type: FieldType.time, values: timeValues },
      { name: 'text', type: FieldType.string, values: ['Deployment'] },
      ...(timeEnd
        ? [
            { name: 'timeEnd', type: FieldType.number, values: timeEnd },
            { name: 'isRegion', type: FieldType.boolean, values: timeEnd.map((v) => v != null) },
          ]
        : []),
    ],
  });
}

// Span the daily sample window (2024-01-01 .. +4 days) so all series/annotations fall inside the range.
const defaultTimeRange: TimeRange = {
  from: dateTime(START_MS),
  to: dateTime(START_MS + 4 * DAY_MS),
  raw: { from: 'now-4d', to: 'now' },
};

const defaultPanelOptions: Options = {
  legend: { showLegend: false, displayMode: LegendDisplayMode.List, placement: 'bottom', calcs: [] },
  tooltip: { mode: TooltipDisplayMode.Single, sort: SortOrder.None },
};

// --- Panel rendering ---

function renderTimeSeriesPanel(
  dataOverrides?: Partial<Pick<PanelData, 'series' | 'annotations'>>,
  optionsOverrides?: Partial<Options>,
  panelPropsOverrides?: Partial<PanelProps<Options>>
) {
  const mergedOptions: Options = { ...defaultPanelOptions, ...optionsOverrides };
  const fieldConfig: FieldConfigSource = panelPropsOverrides?.fieldConfig ?? {
    overrides: [],
    defaults: { custom: { ...defaultGraphCustom } },
  };
  const { series: rawSeries = [createTimeSeriesFrame()], ...restDataOverrides } = dataOverrides ?? {};
  const series = applyFieldOverrides({
    data: rawSeries,
    fieldConfig,
    replaceVariables: (v) => v,
    theme,
    fieldConfigRegistry: graphFieldConfigRegistry,
    timeZone: 'utc',
  });
  const props = getPanelProps<Options>(mergedOptions, {
    data: {
      state: LoadingState.Done,
      series,
      timeRange: defaultTimeRange,
      ...restDataOverrides,
    },
    timeRange: defaultTimeRange,
    fieldConfig,
    ...panelPropsOverrides,
    width,
    height,
  });
  return render(<TimeSeriesPanel {...props} />);
}

// --- Canvas capture ---

// Shared with each test file's jest.mock('@grafana/ui/src/utils/measureText', ...) factory so the axis
// measureText mock can route getCanvasContext to the current uPlot instance.
let uPlotInstance: InstanceType<typeof uPlot> | undefined;
// Index that splits the axis/grid pass from the series pass within one captured frame.
let axisBoundary = 0;

/**
 * Its only caller is the dynamic `require(...).getUPlotInstance()` inside each test's hoisted `jest.mock`
 * factory (jest forbids static imports there). knip can't trace that and reports this export as unused, so
 * the tag below is the repo's knip suppression annotation.
 * @lintignore
 */
export const getUPlotInstance = () => uPlotInstance;

/**
 * Registers the beforeEach/afterEach that spy uPlot's config builder and apply the deterministic axis
 * measureText widths. Capture is non-clearing: reset events at the start of each frame (drawClear), record
 * the axis/series boundary at drawAxes WITHOUT clearing, and grab the instance at frame end. The sibling
 * canvas suites (heatmap/xychart/timeline) clear at drawAxes instead; that drops this panel's series fill
 * pass, so keep the boundary-index approach here. Call once inside each canvas test's top describe.
 */
export function setupCanvasCapture(): void {
  let prepConfigSpy: jest.SpyInstance;
  const { preparePlotConfigBuilder: realPreparePlotConfigBuilder } = jest.requireActual(
    'app/core/components/TimeSeries/utils'
  );

  beforeEach(() => {
    applyDefaultUPlotAxisMeasureTextMock(jest.mocked(uPlotAxisMeasureText));
    prepConfigSpy = jest
      .spyOn(timeSeriesUtils, 'preparePlotConfigBuilder')
      .mockImplementation((...args: Parameters<typeof realPreparePlotConfigBuilder>) => {
        const builder: UPlotConfigBuilder = realPreparePlotConfigBuilder(...args);

        builder.addHook('drawClear', (u: uPlot) => {
          u.ctx.__clearDrawCalls();
          u.ctx.__clearEvents();
          u.ctx.__clearPath();
        });
        builder.addHook('drawAxes', (u: uPlot) => {
          uPlotInstance = u;
          axisBoundary = u.ctx.__getEvents().length;
        });
        builder.addHook('draw', (u: uPlot) => {
          uPlotInstance = u;
        });

        return builder;
      });
  });

  afterEach(() => {
    prepConfigSpy.mockRestore();
  });
}

const assertUPlotReady = async ({ hasAnnotations = false }: { hasAnnotations?: boolean } = {}) => {
  await waitFor(() =>
    expect(screen.getByTestId(selectors.components.VizLayout.container).querySelector('.u-over')).toBeVisible()
  );
  // The annotations plugin draws its lines/regions from refs that are only populated after uPlot's
  // ready/drawAxes hooks force a re-render, cluster the annotations, and trigger a follow-up redraw. Poll
  // the captured frame until those draw calls appear before settling — the marker lines use a dashed
  // stroke (setLineDash), which the series pass never emits with this config. A stable-draw-call-count
  // poll alone is not enough: under parallel load the count can settle on the pre-annotation frame before
  // that redraw lands (a flake seen only in heavier CI), capturing a frame with no annotation lines.
  if (hasAnnotations) {
    await waitFor(() => {
      const seriesEvents = (uPlotInstance?.ctx.__getEvents() ?? []).slice(axisBoundary);
      expect(seriesEvents.some((event: { type: string }) => event.type === 'setLineDash')).toBe(true);
    });
  }
  // Wait for the captured event stream to stabilize (two consecutive polls with the same count) so any
  // trailing redraw has flushed before snapshotting.
  let previousCount = -1;
  await waitFor(() => {
    const count = uPlotInstance?.ctx.__getEvents().length ?? 0;
    const stable = count > 0 && count === previousCount;
    previousCount = count;
    expect(stable).toBe(true);
  });
};

// --- Case runner ---

export interface CanvasCase {
  name: string;
  data?: Partial<Pick<PanelData, 'series' | 'annotations'>>;
  options?: Partial<Options>;
  panelProps?: Partial<PanelProps<Options>>;
}

/**
 * Renders a case and snapshots its captured draw calls. `layer` picks which pass to assert: 'series'
 * (fills/stroke/markers, with the axis pass as viewer context) or 'axes' (the axis pass). Only the
 * asserted events are scrubbed; context is passed raw.
 */
export async function renderCanvasCase(
  { data, options, panelProps }: CanvasCase,
  layer: 'series' | 'axes' = 'series'
): Promise<void> {
  renderTimeSeriesPanel(data, options, panelProps);
  await assertUPlotReady({ hasAnnotations: Boolean(data?.annotations?.length) });

  const events = uPlotInstance!.ctx.__getEvents();
  const axisEvents = events.slice(0, axisBoundary);

  if (layer === 'axes') {
    expect(removeCanvasTransforms(axisEvents)).toMatchCanvasSnapshot([], { width, height });
  } else {
    expect(removeCanvasTransforms(events.slice(axisBoundary))).toMatchCanvasSnapshot(axisEvents, { width, height });
  }
}
