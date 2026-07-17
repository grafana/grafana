import { render, screen, waitFor } from '@testing-library/react';
import { type CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import type uPlot from 'uplot';

import {
  applyFieldOverrides,
  createDataFrame,
  createFieldConfigRegistry,
  createTheme,
  DataTopic,
  dateTime,
  type Field,
  type FieldConfigSource,
  FieldColorModeId,
  FieldType,
  LoadingState,
  type PanelData,
  type PanelProps,
  ThresholdsMode,
  type TimeRange,
  toDataFrame,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import {
  AxisPlacement,
  GraphDrawStyle,
  GraphGradientMode,
  LegendDisplayMode,
  LineInterpolation,
  SortOrder,
  StackingMode,
  TooltipDisplayMode,
} from '@grafana/schema';
import { applyDefaultUPlotAxisMeasureTextMock, removeCanvasTransforms } from '@grafana/test-utils/canvas';
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
const graphFieldConfigRegistry = createFieldConfigRegistry(getGraphFieldConfig(defaultGraphConfig), 'Time series');

/** The default dark theme is argument-free and stable, so build it once for the whole suite. */
const theme = createTheme();

/** Fixed high-contrast color for cases whose effect (fill/stroke) is only visible with a solid series color. */
const fixedBlue: Partial<FieldConfigSource['defaults']> = {
  color: { mode: FieldColorModeId.Fixed, fixedColor: 'blue' },
};

/** Panel props carrying a field config whose custom values extend the graph defaults. */
function customFieldConfig(
  custom: Partial<typeof defaultGraphConfig>,
  extraDefaults?: Partial<FieldConfigSource['defaults']>
): Partial<PanelProps<Options>> {
  return {
    fieldConfig: {
      overrides: [],
      defaults: { ...extraDefaults, custom: { ...defaultGraphConfig, ...custom } },
    },
  };
}

const width = 648;
const height = 378;

/** Minimal viewport for snapshots that only need a few series drawn (smaller canvas event payloads). */
const compactCanvas = { width: 260, height: 140 } as const;

/**
 * uPlot Y/X axis layout uses `measureText` from @grafana/ui (not `useMeasure` on the panel), and
 * jest-canvas-mock reports `TextMetrics.width === text.length`, which starves the Y axis and clips tick
 * labels. The shared factory supplies deterministic ~browser-like widths (re-applied in `beforeEach`) and
 * routes `getCanvasContext` to the uPlot instance's ctx so gradient-fill geometry lands in the snapshot.
 */
let uPlotInstance: InstanceType<typeof uPlot> | undefined;
jest.mock('@grafana/ui/src/utils/measureText', () =>
  require('@grafana/test-utils/canvas').createGrafanaUiMeasureTextJestMock(() => uPlotInstance)
);

function createTimeSeriesFrame(overrides?: { timeValues?: number[]; values?: number[]; name?: string }) {
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

function createMultiSeriesFrame(seriesCount = 3) {
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

function createAnnotationFrame(overrides?: { timeValues?: number[]; text?: string[]; timeEnd?: number[] }) {
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

function createExemplarFrame(overrides?: { timeValues?: number[]; values?: number[]; additionalFields?: Field[] }) {
  const timeValues = overrides?.timeValues ?? [2000, 3000];
  const values = overrides?.values ?? [15, 22];
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

const defaultTimeRange = {
  from: dateTime(0),
  to: dateTime(6000),
  raw: { from: 'now-6s', to: 'now' },
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
    defaults: { custom: { ...defaultGraphConfig } },
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
      timeRange: defaultTimeRange as TimeRange,
      ...restDataOverrides,
    },
    timeRange: defaultTimeRange as TimeRange,
    fieldConfig,
    ...panelPropsOverrides,
    width: panelPropsOverrides?.width ?? width,
    height: panelPropsOverrides?.height ?? height,
  });
  return render(<TimeSeriesPanel {...props} />);
}

type TestCase = [
  string,
  Partial<Pick<PanelData, 'series' | 'annotations' | 'timeRange'>>?,
  Partial<Options>?,
  Partial<PanelProps<Options>>?,
  { width: number; height: number }?,
];

describe('TimeSeriesPanel (canvas)', () => {
  let prepConfigSpy: jest.SpyInstance;
  const { preparePlotConfigBuilder: realPreparePlotConfigBuilder } = jest.requireActual(
    'app/core/components/TimeSeries/utils'
  );
  let uPlotAxisEvents: CanvasRenderingContext2DEvent[] | null = null;
  let clearAxisEvents = true;

  const assertUPlotReady = async () => {
    expect(screen.getByTestId(selectors.components.VizLayout.container)).toBeVisible();
    await waitFor(() =>
      expect(screen.getByTestId(selectors.components.VizLayout.container).querySelector('.u-over')).toBeVisible()
    );
  };

  const assertCanvasOutput = async (snapshotSize: { width: number; height: number } = { width, height }) => {
    await assertUPlotReady();
    expect(removeCanvasTransforms(uPlotInstance!.ctx.__getEvents())).toMatchCanvasSnapshot(
      uPlotAxisEvents!,
      snapshotSize
    );
  };

  const assertAxesOutput = async (snapshotSize: { width: number; height: number } = { width, height }) => {
    await assertUPlotReady();
    expect(removeCanvasTransforms(uPlotAxisEvents!)).toMatchCanvasSnapshot([], snapshotSize);
  };

  type AssertCase = [string, (snapshotSize?: { width: number; height: number }) => Promise<void>];

  beforeEach(() => {
    applyDefaultUPlotAxisMeasureTextMock(jest.mocked(uPlotAxisMeasureText));
    prepConfigSpy = jest
      .spyOn(timeSeriesUtils, 'preparePlotConfigBuilder')
      .mockImplementation((...args: Parameters<typeof realPreparePlotConfigBuilder>) => {
        const builder: UPlotConfigBuilder = realPreparePlotConfigBuilder(...args);

        builder.addHook('drawAxes', (u: uPlot) => {
          uPlotInstance = u;
          uPlotAxisEvents = u.ctx.__getEvents();
          if (clearAxisEvents) {
            u.ctx.__clearDrawCalls();
            u.ctx.__clearEvents();
            u.ctx.__clearPath();
          }
        });

        return builder;
      });
  });

  afterEach(() => {
    prepConfigSpy.mockRestore();
  });

  describe('Options', () => {
    describe.each([
      ['defaults'],
      // Line is the default draw style, covered by the `defaults` case above. Fixed color + a visible fill
      // so the shape (bars/points) actually renders — with the default transparent fill they draw nothing.
      ...Object.values(GraphDrawStyle)
        .filter((drawStyle) => drawStyle !== GraphDrawStyle.Line)
        .map(
          (drawStyle): TestCase => [
            `drawStyle: ${drawStyle}`,
            undefined,
            undefined,
            customFieldConfig({ drawStyle, fillOpacity: 25 }, fixedBlue),
          ]
        ),
      // Linear is the default interpolation, covered by the `defaults` case above.
      ...Object.values(LineInterpolation)
        .filter((lineInterpolation) => lineInterpolation !== LineInterpolation.Linear)
        .map(
          (lineInterpolation): TestCase => [
            `lineInterpolation: ${lineInterpolation}`,
            undefined,
            undefined,
            customFieldConfig({ lineInterpolation }),
          ]
        ),
      // fillOpacity 0 (no fill) is the default, covered by the `defaults` case above. Fixed color so the fill
      // is high-contrast and each opacity step reads clearly (pale to solid).
      ...[25, 50, 80, 100].map(
        (fillOpacity): TestCase => [
          `fillOpacity: ${fillOpacity}`,
          undefined,
          undefined,
          customFieldConfig({ fillOpacity }, fixedBlue),
        ]
      ),
      // None is the default gradient mode, covered by `defaults`; Scheme is a separate explicit case below.
      ...Object.values(GraphGradientMode)
        .filter((gradientMode) => gradientMode !== GraphGradientMode.None && gradientMode !== GraphGradientMode.Scheme)
        .map(
          (gradientMode): TestCase => [
            `gradientMode: ${gradientMode}`,
            undefined,
            undefined,
            customFieldConfig({ gradientMode }),
          ]
        ),
      // Scheme gradients color the line by the field's threshold scale, so they require a color mode +
      // thresholds; without them uPlot's gradient builder throws.
      [
        'gradientMode: scheme',
        undefined,
        undefined,
        customFieldConfig(
          { gradientMode: GraphGradientMode.Scheme },
          {
            color: { mode: FieldColorModeId.Thresholds },
            thresholds: {
              mode: ThresholdsMode.Absolute,
              steps: [
                { value: -Infinity, color: 'green' },
                { value: 20, color: 'red' },
              ],
            },
          }
        ),
      ],
      [
        'stacking: normal',
        { series: [createMultiSeriesFrame()] },
        undefined,
        { ...customFieldConfig({ stacking: { mode: StackingMode.Normal, group: 'A' } }), ...compactCanvas },
        compactCanvas,
      ],
      [
        'stacking: 100%',
        { series: [createMultiSeriesFrame()] },
        undefined,
        { ...customFieldConfig({ stacking: { mode: StackingMode.Percent, group: 'A' } }), ...compactCanvas },
        compactCanvas,
      ],
      // Width 1 is the default, so start at 3 and use bold, well-separated widths. Fixed color so the stroke
      // is high-contrast and each width is visibly distinct.
      ...[3, 6, 10].map(
        (lineWidth): TestCase => [
          `lineWidth: ${lineWidth}`,
          undefined,
          undefined,
          customFieldConfig({ lineWidth }, fixedBlue),
        ]
      ),
    ] satisfies TestCase[])(
      '%s',
      (
        _,
        dataOverrides?: Partial<Pick<PanelData, 'series' | 'annotations' | 'timeRange'>>,
        optionsOverrides?: Partial<Options>,
        panelPropsOverrides?: Partial<PanelProps<Options>>,
        snapshotSize?: { width: number; height: number }
      ) => {
        it.each([['canvas', assertCanvasOutput]] satisfies AssertCase[])('%s', async (_, assertFn) => {
          renderTimeSeriesPanel(dataOverrides, optionsOverrides, panelPropsOverrides);
          await assertFn(snapshotSize);
        });
      }
    );
  });

  describe('Axes', () => {
    describe.each([
      // Auto resolves to Left, and Left is the default placement, so both are covered by `X Axis: defaults`.
      ...Object.values(AxisPlacement)
        .filter((axisPlacement) => axisPlacement !== AxisPlacement.Auto && axisPlacement !== AxisPlacement.Left)
        .map(
          (axisPlacement): TestCase => [
            `Y Axis placement: ${axisPlacement}`,
            undefined,
            undefined,
            customFieldConfig({ axisPlacement }),
          ]
        ),
      ['Y Axis: soft min/max', undefined, undefined, customFieldConfig({}, { min: 0, max: 100 })],
      ['X Axis: defaults'],
    ] satisfies TestCase[])(
      '%s',
      (
        _,
        dataOverrides?: Partial<Pick<PanelData, 'series' | 'annotations' | 'timeRange'>>,
        optionsOverrides?: Partial<Options>,
        panelPropsOverrides?: Partial<PanelProps<Options>>,
        snapshotSize?: { width: number; height: number }
      ) => {
        it.each([['axes', assertAxesOutput]] satisfies AssertCase[])('%s', async (_, assertFn) => {
          renderTimeSeriesPanel(dataOverrides, optionsOverrides, panelPropsOverrides);
          await assertFn(snapshotSize);
        });
      }
    );
  });

  describe('Annotations', () => {
    describe.each([
      ['point annotations', { annotations: [createAnnotationFrame({ timeValues: [1000, 2000, 3000] })] }],
      ['region annotations', { annotations: [createAnnotationFrame({ timeValues: [1500], timeEnd: [2500] })] }],
    ] satisfies TestCase[])(
      '%s',
      (_, dataOverrides?: Partial<Pick<PanelData, 'series' | 'annotations' | 'timeRange'>>) => {
        it.each([['canvas', assertCanvasOutput]] satisfies AssertCase[])('%s', async (_, assertFn) => {
          renderTimeSeriesPanel(dataOverrides);
          await assertFn();
        });
      }
    );
  });

  describe('Exemplars', () => {
    // Exemplars show up as marker elements drawn over the graph, not as part of the canvas itself, so they
    // won't appear in these canvas snapshots. So this snapshot looks the same as the `defaults` case. It just
    // checks that adding exemplar data doesn't change how the graph is drawn.
    describe.each([
      ['renders', { annotations: [createExemplarFrame({ timeValues: [1000, 2000, 3000], values: [10, 20, 15] })] }],
    ] satisfies TestCase[])(
      '%s',
      (_, dataOverrides?: Partial<Pick<PanelData, 'series' | 'annotations' | 'timeRange'>>) => {
        it.each([['canvas', assertCanvasOutput]] satisfies AssertCase[])('%s', async (_, assertFn) => {
          renderTimeSeriesPanel(dataOverrides);
          await assertFn();
        });
      }
    );
  });
});
