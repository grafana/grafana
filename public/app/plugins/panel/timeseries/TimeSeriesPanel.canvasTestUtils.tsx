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

// The panel framework runs applyFieldOverrides before rendering; a unit test must do it too, or the
// custom config (drawStyle, fillOpacity, etc.) never reaches field.config.custom and every case renders
// identically. The registry carries the time series custom config so those defaults get applied.
const graphFieldConfigRegistry = createFieldConfigRegistry(getGraphFieldConfig(defaultGraphConfig), 'Time series');

const theme = createTheme();

const width = 648;
const height = 378;

/** Smaller canvas for cases that only need a few series drawn. */
export const compactCanvas = { width: 260, height: 140 } as const;

export const fixedBlue: Partial<FieldConfigSource['defaults']> = {
  color: { mode: FieldColorModeId.Fixed, fixedColor: 'blue' },
};

// pointSize/showPoints are editor defaults (config.ts) that applyFieldOverrides does not inject. Without
// them point markers never render, even though a default panel shows them.
const panelDefaultConfig: typeof defaultGraphConfig = {
  ...defaultGraphConfig,
  pointSize: 5,
  showPoints: VisibilityMode.Auto,
};

interface CustomFieldConfigArgs {
  /** custom graph overrides layered on the panel default config */
  custom?: Partial<typeof defaultGraphConfig>;
  /** top-level field defaults (color, thresholds, min/max) merged alongside custom */
  defaults?: Partial<FieldConfigSource['defaults']>;
}

export function customFieldConfig({ custom, defaults }: CustomFieldConfigArgs = {}): Partial<PanelProps<Options>> {
  return {
    fieldConfig: {
      overrides: [],
      defaults: { ...defaults, custom: { ...panelDefaultConfig, ...custom } },
    },
  };
}

// Real timestamps one day apart so the x-axis shows several grid lines with formatted date labels, rather
// than the 00:00:00-00:00:05 that tiny epoch values produce. Date.UTC keeps it deterministic across zones.
export const START_MS = Date.UTC(2024, 0, 1);
export const DAY_MS = 24 * 60 * 60 * 1000;

const dailyTimestamps = (count = 5) => Array.from({ length: count }, (_, i) => START_MS + i * DAY_MS);

function createTimeSeriesFrame(overrides?: { timeValues?: number[]; values?: number[]; name?: string }) {
  const timeValues = overrides?.timeValues ?? dailyTimestamps();
  const values = overrides?.values ?? [10, 20, 15, 25, 18];
  const name = overrides?.name ?? 'value';
  return createDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: timeValues, config: {} },
      { name, type: FieldType.number, values, config: {} },
    ],
  });
}

export function createMultiSeriesFrame(seriesCount = 3) {
  const timeValues = dailyTimestamps();
  return createDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: timeValues, config: {} },
      ...Array.from({ length: seriesCount }, (_, i) => ({
        name: `series${i + 1}`,
        type: FieldType.number,
        values: timeValues.map((_, t) => (i + 1) * 10 + t * 2),
        config: {},
      })),
    ],
  });
}

export function createAnnotationFrame(overrides?: { timeValues?: number[]; text?: string[]; timeEnd?: number[] }) {
  const timeValues = overrides?.timeValues ?? [START_MS + 2 * DAY_MS];
  const text = overrides?.text ?? ['Deployment'];
  const frame = {
    name: 'annotation',
    meta: { dataTopic: DataTopic.Annotations },
    fields: [
      { name: 'time', type: FieldType.time, values: timeValues },
      { name: 'text', type: FieldType.string, values: text },
      overrides?.timeEnd
        ? { name: 'timeEnd', type: FieldType.number, config: {}, values: overrides.timeEnd }
        : undefined,
      overrides?.timeEnd
        ? { name: 'isRegion', type: FieldType.boolean, config: {}, values: overrides.timeEnd.map((v) => v != null) }
        : undefined,
    ].filter((f) => f != null),
  };
  return createDataFrame(frame);
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

function renderTimeSeriesPanel(
  dataOverrides?: Partial<Pick<PanelData, 'series' | 'annotations' | 'timeRange'>>,
  optionsOverrides?: Partial<Options>,
  panelPropsOverrides?: Partial<PanelProps<Options>>
) {
  const mergedOptions: Options = { ...defaultPanelOptions, ...optionsOverrides };
  const fieldConfig: FieldConfigSource = panelPropsOverrides?.fieldConfig ?? {
    overrides: [],
    defaults: { custom: { ...panelDefaultConfig } },
  };
  const { series: rawSeries = [createTimeSeriesFrame()], ...restDataOverrides } = dataOverrides ?? {};
  const series = applyFieldOverrides({
    data: rawSeries,
    fieldConfig,
    replaceVariables: (value) => value,
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
    width: panelPropsOverrides?.width ?? width,
    height: panelPropsOverrides?.height ?? height,
  });
  return render(<TimeSeriesPanel {...props} />);
}

export interface CanvasCase {
  name: string;
  data?: Partial<Pick<PanelData, 'series' | 'annotations' | 'timeRange'>>;
  options?: Partial<Options>;
  panelProps?: Partial<PanelProps<Options>>;
  size?: { width: number; height: number };
}

// Shared with each test file's `jest.mock('@grafana/ui/src/utils/measureText', …)` factory so the axis
// measureText mock can route `getCanvasContext` to the current uPlot instance.
let uPlotInstance: InstanceType<typeof uPlot> | undefined;
// Index that splits the axis/grid pass from the series pass within one captured frame.
let axisBoundary = 0;

export const getUPlotInstance = () => uPlotInstance;

/**
 * Registers the beforeEach/afterEach that spy uPlot's config builder and apply the deterministic axis
 * measureText widths. Capture is non-clearing: reset events at the start of each frame (drawClear), record
 * the axis/series boundary at drawAxes WITHOUT clearing (clearing there dropped the series fill pass), and
 * grab the instance at frame end. Call once inside each canvas test's top describe.
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

const assertUPlotReady = async () => {
  expect(screen.getByTestId(selectors.components.VizLayout.container)).toBeVisible();
  await waitFor(() =>
    expect(screen.getByTestId(selectors.components.VizLayout.container).querySelector('.u-over')).toBeVisible()
  );
  // Some plugins redraw after their overlay mounts (e.g. the annotations plugin redraws once its markers
  // are in the DOM). Under parallel test load that redraw can land after the first `.u-over` paint, so wait
  // for the captured event stream to stabilize before snapshotting.
  let previousCount = -1;
  await waitFor(() => {
    const count = uPlotInstance?.ctx.__getEvents().length ?? 0;
    if (count === 0 || count !== previousCount) {
      previousCount = count;
      throw new Error('uPlot draw has not settled');
    }
  });
};

/**
 * Renders a case and snapshots its captured draw calls. `size` sizes both the render and the snapshot
 * metadata. `layer` picks which pass to assert: 'series' (fills/stroke/markers, with the axis pass as
 * viewer context) or 'axes' (the axis pass). Only the asserted events are scrubbed; context is passed raw.
 */
export async function renderCanvasCase(
  { data, options, panelProps, size }: CanvasCase,
  layer: 'series' | 'axes' = 'series'
): Promise<void> {
  renderTimeSeriesPanel(data, options, { ...panelProps, ...size });
  await assertUPlotReady();

  const events = uPlotInstance!.ctx.__getEvents();
  const axisEvents = events.slice(0, axisBoundary);
  const snapshotSize = size ?? { width, height };

  if (layer === 'axes') {
    expect(removeCanvasTransforms(axisEvents)).toMatchCanvasSnapshot([], snapshotSize);
  } else {
    expect(removeCanvasTransforms(events.slice(axisBoundary))).toMatchCanvasSnapshot(axisEvents, snapshotSize);
  }
}
