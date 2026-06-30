import { render, screen, waitFor } from '@testing-library/react';
import { type CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import type uPlot from 'uplot';

import {
  createDataFrame,
  DataTopic,
  dateTime,
  type Field,
  FieldType,
  LoadingState,
  type PanelData,
  type PanelProps,
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
import { measureText as uPlotAxisMeasureText, type UPlotConfigBuilder } from '@grafana/ui';
import * as timeSeriesUtils from 'app/core/components/TimeSeries/utils';

import { getPanelProps } from '../test-utils';

import { TimeSeriesPanel } from './TimeSeriesPanel';
import { defaultGraphConfig } from './config';
import { type Options } from './panelcfg.gen';

const width = 648;
const height = 378;

/** Minimal viewport for snapshots that only need a few series drawn (smaller canvas event payloads). */
const compactCanvas = { width: 260, height: 140 } as const;

/**
 * Without mocking measureText, the text width is always measured incorrectly, resulting in test behavior which does not match expected behavior in the browser.
 * uPlot Y/X axis layout uses `measureText` from @grafana/ui (not `useMeasure` on the panel).
 * jest-canvas-mock reports `TextMetrics.width === text.length`, which starves the Y axis and
 * clips tick labels. This mock provides deterministic, ~browser-like widths for axis sizing.
 * Override in a test: `uPlotAxisMeasureText.mockImplementationOnce(...)`; default is re-applied in `beforeEach`.
 */
jest.mock('../../../../../packages/grafana-ui/src/utils/measureText', () => {
  const actual = jest.requireActual('../../../../../packages/grafana-ui/src/utils/measureText');
  return { ...actual, measureText: jest.fn() };
});

/** Width scale matched roughly to 12px Inter. */
function defaultAxisTextWidthForTests(text: string | null, fontSize: number): number {
  const AXIS_TEXT_WIDTH_PER_CHAR = 7.2;
  const w = (text?.length ?? 1) * AXIS_TEXT_WIDTH_PER_CHAR * (fontSize / 12);
  return Math.max(8, w);
}

function applyDefaultUPlotAxisMeasureTextMock() {
  (uPlotAxisMeasureText as jest.Mock).mockImplementation(
    (text: string, fontSize: number, _fontWeight = 400) =>
      ({ width: defaultAxisTextWidthForTests(text, fontSize) }) as ReturnType<CanvasRenderingContext2D['measureText']>
  );
}

/**
 * Scrubs canvas events output to remove noop from snapshot output.
 */
function scrubOutput(events: CanvasRenderingContext2DEvent[]): Array<Omit<CanvasRenderingContext2DEvent, 'transform'>> {
  return events.map(({ transform, ...event }) =>
    event.props.path ? { ...event, props: { ...event.props, path: scrubOutput(event.props.path) } } : event
  );
}

function createTimeSeriesFrame(overrides?: { timeValues?: number[]; values?: number[]; name?: string }) {
  const timeValues = overrides?.timeValues ?? [1000, 2000, 3000, 4000, 5000];
  const values = overrides?.values ?? [10, 20, 15, 25, 18];
  const name = overrides?.name ?? 'value';
  return createDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: timeValues, config: {} },
      { name, type: FieldType.number, values, config: { custom: { ...defaultGraphConfig } } },
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
        config: { custom: { ...defaultGraphConfig } },
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
  const props = getPanelProps<Options>(mergedOptions, {
    data: {
      state: LoadingState.Done,
      series: [createTimeSeriesFrame()],
      timeRange: defaultTimeRange as TimeRange,
      ...dataOverrides,
    },
    timeRange: defaultTimeRange as TimeRange,
    fieldConfig: { overrides: [], defaults: { custom: { ...defaultGraphConfig } } },
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
  let uPlotInstance: InstanceType<typeof uPlot> | undefined;
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
    expect(scrubOutput(uPlotInstance!.ctx.__getEvents())).toMatchCanvasSnapshot(uPlotAxisEvents!, snapshotSize);
  };

  const assertAxesOutput = async (snapshotSize: { width: number; height: number } = { width, height }) => {
    await assertUPlotReady();
    expect(scrubOutput(uPlotAxisEvents!)).toMatchCanvasSnapshot([], snapshotSize);
  };

  type AssertCase = [string, (snapshotSize?: { width: number; height: number }) => Promise<void>];

  beforeEach(() => {
    applyDefaultUPlotAxisMeasureTextMock();
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
      ...Object.values(GraphDrawStyle).map(
        (drawStyle): TestCase => [
          `drawStyle: ${drawStyle}`,
          undefined,
          undefined,
          { fieldConfig: { overrides: [], defaults: { custom: { ...defaultGraphConfig, drawStyle } } } },
        ]
      ),
      ...Object.values(LineInterpolation).map(
        (lineInterpolation): TestCase => [
          `lineInterpolation: ${lineInterpolation}`,
          undefined,
          undefined,
          { fieldConfig: { overrides: [], defaults: { custom: { ...defaultGraphConfig, lineInterpolation } } } },
        ]
      ),
      ...[0, 25, 50, 80, 100].map(
        (fillOpacity): TestCase => [
          `fillOpacity: ${fillOpacity}`,
          undefined,
          undefined,
          { fieldConfig: { overrides: [], defaults: { custom: { ...defaultGraphConfig, fillOpacity } } } },
        ]
      ),
      ...Object.values(GraphGradientMode).map(
        (gradientMode): TestCase => [
          `gradientMode: ${gradientMode}`,
          undefined,
          undefined,
          { fieldConfig: { overrides: [], defaults: { custom: { ...defaultGraphConfig, gradientMode } } } },
        ]
      ),
      [
        'stacking: normal',
        { series: [createMultiSeriesFrame()] },
        undefined,
        {
          fieldConfig: {
            overrides: [],
            defaults: { custom: { ...defaultGraphConfig, stacking: { mode: StackingMode.Normal, group: 'A' } } },
          },
          width: compactCanvas.width,
          height: compactCanvas.height,
        },
        compactCanvas,
      ],
      [
        'stacking: 100%',
        { series: [createMultiSeriesFrame()] },
        undefined,
        {
          fieldConfig: {
            overrides: [],
            defaults: { custom: { ...defaultGraphConfig, stacking: { mode: StackingMode.Percent, group: 'A' } } },
          },
          width: compactCanvas.width,
          height: compactCanvas.height,
        },
        compactCanvas,
      ],
      ...[1, 3, 5].map(
        (lineWidth): TestCase => [
          `lineWidth: ${lineWidth}`,
          undefined,
          undefined,
          { fieldConfig: { overrides: [], defaults: { custom: { ...defaultGraphConfig, lineWidth } } } },
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
      ...Object.values(AxisPlacement).map(
        (axisPlacement): TestCase => [
          `Y Axis placement: ${axisPlacement}`,
          undefined,
          undefined,
          { fieldConfig: { overrides: [], defaults: { custom: { ...defaultGraphConfig, axisPlacement } } } },
        ]
      ),
      [
        'Y Axis: soft min/max',
        undefined,
        undefined,
        { fieldConfig: { overrides: [], defaults: { custom: { ...defaultGraphConfig }, min: 0, max: 100 } } },
      ],
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
