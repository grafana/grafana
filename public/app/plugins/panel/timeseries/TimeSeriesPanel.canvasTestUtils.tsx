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
  toDataFrame,
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

/**
 * The panel framework runs `applyFieldOverrides` before handing series to the panel component; in a unit
 * test we must do it ourselves. Without it, the panel's `fieldConfig.defaults.custom` (drawStyle, fillOpacity,
 * lineWidth, etc.) never reaches `field.config.custom`, so every option permutation renders identically.
 * The registry must carry the time series custom config so `custom.*` defaults are applied.
 */
// uPlot builds series area fills via the Path2D copy constructor, which jest-canvas-mock drops; this shim
// preserves it so fills, gradient bands, and markers land in the captured draw calls.
installCanvasPath2DShim();

const graphFieldConfigRegistry = createFieldConfigRegistry(getGraphFieldConfig(defaultGraphConfig), 'Time series');

/** The default dark theme is argument-free and stable, so build it once for the whole suite. */
const theme = createTheme();

export const width = 648;
export const height = 378;

/** Minimal viewport for snapshots that only need a few series drawn (smaller canvas event payloads). */
export const compactCanvas = { width: 260, height: 140 } as const;

/** Fixed high-contrast color for cases whose effect (fill/stroke) is only visible with a solid series color. */
export const fixedBlue: Partial<FieldConfigSource['defaults']> = {
  color: { mode: FieldColorModeId.Fixed, fixedColor: 'blue' },
};

/**
 * A real time series panel applies field-config *editor* defaults that `defaultGraphConfig` (config.ts)
 * omits, and `applyFieldOverrides` does not inject them. Mirror the ones that affect canvas rendering so
 * snapshots match what a user actually sees:
 *   - pointSize: 5      — config.ts editor `defaultValue` for path 'pointSize'
 *   - showPoints: Auto  — config.ts editor `defaultValue` (graphFieldOptions.showPoints[0].value)
 * Without these, point markers never render in the tests even though a default panel shows them.
 */
const panelDefaultConfig: typeof defaultGraphConfig = {
  ...defaultGraphConfig,
  pointSize: 5,
  showPoints: VisibilityMode.Auto,
};

/** Panel props carrying a field config whose custom values extend the panel default graph config. */
export function customFieldConfig(
  custom: Partial<typeof defaultGraphConfig>,
  extraDefaults?: Partial<FieldConfigSource['defaults']>
): Partial<PanelProps<Options>> {
  return {
    fieldConfig: {
      overrides: [],
      defaults: { ...extraDefaults, custom: { ...panelDefaultConfig, ...custom } },
    },
  };
}

export function createTimeSeriesFrame(overrides?: { timeValues?: number[]; values?: number[]; name?: string }) {
  const timeValues = overrides?.timeValues ?? [1000, 2000, 3000, 4000, 5000];
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
  const timeValues = [1000, 2000, 3000, 4000, 5000];
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
  const timeValues = overrides?.timeValues ?? [2000];
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
  return toDataFrame(frame);
}

const defaultTimeRange: TimeRange = {
  from: dateTime(0),
  to: dateTime(6000),
  raw: { from: 'now-6s', to: 'now' },
};

const defaultPanelOptions: Options = {
  legend: { showLegend: false, displayMode: LegendDisplayMode.List, placement: 'bottom', calcs: [] },
  tooltip: { mode: TooltipDisplayMode.Single, sort: SortOrder.None },
};

export function renderTimeSeriesPanel(
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

export const assertCanvasOutput = async (snapshotSize: { width: number; height: number } = { width, height }) => {
  await assertUPlotReady();
  const frame = uPlotInstance!.ctx.__getEvents();
  const seriesEvents = removeCanvasTransforms(frame.slice(axisBoundary));
  // Context (axis/grid) events are passed raw for the compare viewer; only the asserted series events are scrubbed.
  expect(seriesEvents).toMatchCanvasSnapshot(frame.slice(0, axisBoundary), snapshotSize);
};

export const assertAxesOutput = async (snapshotSize: { width: number; height: number } = { width, height }) => {
  await assertUPlotReady();
  const axisEvents = removeCanvasTransforms(uPlotInstance!.ctx.__getEvents().slice(0, axisBoundary));
  expect(axisEvents).toMatchCanvasSnapshot([], snapshotSize);
};
