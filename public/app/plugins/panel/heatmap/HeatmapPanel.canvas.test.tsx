import { render, screen, waitFor } from '@testing-library/react';
import { type CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import type uPlot from 'uplot';

import {
  createDataFrame,
  DataFrameType,
  DataTopic,
  dateTime,
  type Field,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  type PanelData,
  type PanelProps,
  toDataFrame,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { AxisPlacement, HeatmapCellLayout, ScaleDistribution, TooltipDisplayMode } from '@grafana/schema';
import { measureText as uPlotAxisMeasureText, type UPlotConfigBuilder } from '@grafana/ui';
import { LinearBucketData, LinearBucketTimeRange } from 'app/plugins/panel/heatmap/mocks/LinearBucketData';

import { getPanelProps } from '../test-utils';

import { HeatmapPanel } from './HeatmapPanel';
import { defaultOptions, HeatmapColorMode, HeatmapColorScale, type Options } from './panelcfg.gen';
import { defaultOptions as fullDefaultOptions } from './types';
import * as heatmapUtils from './utils';

const width = 648;
const height = 378;

/**
 * Without mocking measureText, the text width is always measured incorrectly, resulting in test behavior which does not match expected behavior in the browser.
 * uPlot Y/X axis layout uses `measureText` from @grafana/ui (not `useMeasure` on the panel).
 * jest-canvas-mock reports `TextMetrics.width === text.length`, which starves the Y axis and
 * clips tick labels. This mock provides deterministic, ~browser-like widths for axis sizing.
 * Override in a test: `uPlotAxisMeasureText.mockImplementationOnce(...)`; default is re-applied in `beforeEach`.
 *
 * Using relative import since measureText is not exported from grafana/ui, we could override this in jest config e.g.:
 *   '^@grafana/ui/src/utils/measureText$': '<rootDir>/packages/grafana-ui/src/utils/measureText.ts',
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
  const timeValues = overrides?.timeValues ?? [1, 2, 3];
  const bucketValues = overrides?.bucketValues ?? generateHeatmapBucketValues(['A', 'B', 'C'], timeValues);
  const bucketNames =
    overrides?.bucketNames ?? Array.from({ length: bucketValues.length }, (_, i) => String.fromCharCode(65 + i));

  const fields = [
    { name: 'time', type: FieldType.time, values: timeValues, config: { unit: 'short' } },
    ...bucketNames.map((name, i) => ({
      name,
      type: FieldType.number,
      config: { unit: 'short' },
      values: bucketValues[i],
    })),
  ];

  return toDataFrame({ fields });
}

/**
 * Scrubs canvas events output to remove noop from snapshot output
 * @todo move to canvas testing utils somewhere
 * @param events
 */
function scrubOutput(events: CanvasRenderingContext2DEvent[]): Array<Omit<CanvasRenderingContext2DEvent, 'transform'>> {
  return events.map(({ transform, ...event }) =>
    event.props.path ? { ...event, props: { ...event.props, path: scrubOutput(event.props.path) } } : event
  );
}

function createExemplarFrame(overrides?: { timeValues?: number[]; values?: number[]; additionalFields?: Field[] }) {
  const timeValues = overrides?.timeValues ?? [1];
  const values = overrides?.values ?? [0];
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

function createAnnotationFrame(overrides?: { timeValues?: number[]; text?: string[]; timeEnd?: number[] }) {
  const timeValues = overrides?.timeValues ?? [1];
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

/**
 * Renders HeatmapPanel with the given data and options.
 * Reusable across tests to avoid duplicating setup.
 *
 * @param dataOverrides - Override series, annotations, or other data props
 * @param optionsOverrides - Override panel options
 * @param panelPropsOverrides - Override panel props (e.g. replaceVariables for DataLinks)
 */
function renderHeatmapPanel(
  dataOverrides?: Partial<Pick<PanelData, 'series' | 'annotations' | 'timeRange'>>,
  optionsOverrides?: Partial<Options>,
  panelPropsOverrides?: Partial<PanelProps<Options>>
) {
  const mergedOptions: Options = {
    ...fullDefaultOptions,
    ...defaultOptions,
    ...{
      legend: { show: false },
      tooltip: {
        mode: TooltipDisplayMode.Single,
        yHistogram: false,
        showColorScale: false,
      },
    },
    ...optionsOverrides,
  };
  const props = getPanelProps<Options>(mergedOptions, {
    data: {
      state: LoadingState.Done,
      series: [createHeatmapRowsFrame()],
      timeRange: getDefaultTimeRange(),
      ...dataOverrides,
    },
    ...{ ...panelPropsOverrides, width, height },
  });
  return render(<HeatmapPanel {...props} />);
}

/** Dense HeatmapCells frame with ordinal y labels */
function createDenseHeatmapFrameWithOrdinalY() {
  const xVals = [1, 1, 2, 2, 3, 3, 5, 5, 6, 6];
  const yVals = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1];
  const countVals = [8, 12, 6, 13, 7, 9, 9, 7, 5, 9];
  return createDataFrame({
    meta: {
      type: DataFrameType.HeatmapCells,
      custom: { yOrdinalDisplay: ['y1', 'y2'] },
    },
    fields: [
      { name: 'x', type: FieldType.number, values: xVals },
      { name: 'y', type: FieldType.number, values: yVals },
      { name: 'count', type: FieldType.number, values: countVals },
    ],
  });
}

describe('HeatmapPanel (canvas)', () => {
  let prepConfigSpy: jest.SpyInstance;
  const { prepConfig: realPrepConfig } = jest.requireActual('./utils');
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
    expect(scrubOutput(uPlotInstance!.ctx.__getEvents())).toMatchUPlotSnapshot(uPlotAxisEvents!, snapshotSize);
  };

  const assertAxesOutput = async (snapshotSize: { width: number; height: number } = { width, height }) => {
    await assertUPlotReady();
    expect(scrubOutput(uPlotAxisEvents!)).toMatchUPlotSnapshot([], snapshotSize);
  };

  beforeEach(() => {
    applyDefaultUPlotAxisMeasureTextMock();
    // VizLayout always calls `useMeasure`; when legend is hidden the result is unused. Zeros match an unmeasured rect.
    prepConfigSpy = jest.spyOn(heatmapUtils, 'prepConfig').mockImplementation((opts) => {
      const builder: UPlotConfigBuilder = realPrepConfig(opts);

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

  describe('Dense', () => {
    describe('Options', () => {
      it('defaults', async () => {
        renderHeatmapPanel({ series: [createDenseHeatmapFrameWithOrdinalY()] });
        await assertCanvasOutput();
      });

      it('cellGap', async () => {
        renderHeatmapPanel({ series: [createDenseHeatmapFrameWithOrdinalY()] }, { cellGap: 20 });
        await assertCanvasOutput();
      });

      describe('filterValues', () => {
        it('filterValues: ge', async () => {
          renderHeatmapPanel({ series: [createDenseHeatmapFrameWithOrdinalY()] }, { filterValues: { ge: 10 } });
          await assertCanvasOutput();
        });

        it('filterValues: le', async () => {
          renderHeatmapPanel({ series: [createDenseHeatmapFrameWithOrdinalY()] }, { filterValues: { le: 10 } });
          await assertCanvasOutput();
        });

        it('filterValues: le & ge', async () => {
          renderHeatmapPanel({ series: [createDenseHeatmapFrameWithOrdinalY()] }, { filterValues: { le: 10, ge: 13 } });
          await assertCanvasOutput();
        });
      });

      describe('color', () => {
        it('opacity', async () => {
          renderHeatmapPanel(
            { series: [createDenseHeatmapFrameWithOrdinalY()] },
            {
              color: {
                scheme: 'UNUSED-FOR-OPACITY',
                steps: 20,
                exponent: 2,
                fill: 'red',
                reverse: false,
                mode: HeatmapColorMode.Opacity,
              },
            }
          );
          await assertCanvasOutput();
        });

        it('scheme', async () => {
          renderHeatmapPanel(
            { series: [createDenseHeatmapFrameWithOrdinalY()] },
            {
              color: {
                steps: 20,
                exponent: 2,
                fill: 'UNUSED-FOR-SCHEME',
                reverse: false,
                scheme: 'BuGn',
                mode: HeatmapColorMode.Scheme,
              },
            }
          );
          await assertCanvasOutput();
        });

        it('min and max', async () => {
          renderHeatmapPanel(
            { series: [createDenseHeatmapFrameWithOrdinalY()] },
            {
              color: {
                min: 7,
                max: 11,
                scheme: 'Oranges',
                steps: 32,
                exponent: Infinity, // unused
                fill: 'dark-orange',
                reverse: false,
                mode: HeatmapColorMode.Scheme,
              },
            }
          );
          await assertCanvasOutput();
        });

        it('scheme reverse', async () => {
          renderHeatmapPanel(
            { series: [createDenseHeatmapFrameWithOrdinalY()] },
            {
              color: {
                steps: 20,
                exponent: 2,
                fill: 'UNUSED-FOR-SCHEME',
                reverse: true,
                scheme: 'BuGn',
                mode: HeatmapColorMode.Scheme,
              },
            }
          );
          await assertCanvasOutput();
        });

        it('opacity scale linear', async () => {
          renderHeatmapPanel(
            { series: [createDenseHeatmapFrameWithOrdinalY()] },
            {
              color: {
                scheme: 'UNUSED-FOR-OPACITY',
                steps: 20,
                exponent: 2,
                fill: 'red',
                reverse: false,
                mode: HeatmapColorMode.Opacity,
                scale: HeatmapColorScale.Linear,
              },
            }
          );
          await assertCanvasOutput();
        });
      });

      describe('calculate', () => {
        it('renders when disabled', async () => {
          renderHeatmapPanel(
            { series: [LinearBucketData], timeRange: LinearBucketTimeRange },
            { calculate: false },
            { timeRange: LinearBucketTimeRange }
          );
          await assertCanvasOutput();
        });

        it('throws with invalid frame', () => {
          const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
          renderHeatmapPanel({ series: [createDenseHeatmapFrameWithOrdinalY()] }, { calculate: true });
          expect(consoleError).toHaveBeenCalledWith('no heatmap fields found');
          consoleError.mockRestore();
        });

        it('throws with invalid frame (x-axis linear only)', () => {
          const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
          renderHeatmapPanel(
            { series: [LinearBucketData] },
            { calculate: true, calculation: { xBuckets: { scale: { type: ScaleDistribution.Log } } } }
          );
          expect(consoleError).toHaveBeenCalledWith('X axis only supports linear buckets');
          consoleError.mockRestore();
        });

        it('no options', async () => {
          renderHeatmapPanel(
            { series: [LinearBucketData], timeRange: LinearBucketTimeRange },
            { calculate: true },
            { timeRange: LinearBucketTimeRange }
          );
          await assertCanvasOutput();
        });

        it('y-axis logscale', async () => {
          renderHeatmapPanel(
            { series: [LinearBucketData], timeRange: LinearBucketTimeRange },
            {
              calculate: true,
              calculation: {
                yBuckets: {
                  scale: { type: ScaleDistribution.Log, log: 2 },
                },
              },
            },
            { timeRange: LinearBucketTimeRange }
          );
          await assertCanvasOutput();
        });
      });
    });
  });
  describe('Sparse', () => {
    /**
     * Sparse HeatmapCells
     * (same shape as `createSparseHeatmapCellsFrame` in fields.test.ts).
     */
    function createSparseHeatmapCellsFrame() {
      return toDataFrame({
        meta: { type: DataFrameType.HeatmapCells },
        fields: [
          { name: 'xMax', type: FieldType.time, values: [1000, 1000, 2000, 2000] },
          { name: 'yMin', type: FieldType.number, values: [1, 4, 1, 4] },
          { name: 'yMax', type: FieldType.number, values: [4, 16, 4, 16] },
          { name: 'count', type: FieldType.number, values: [5, 10, 15, 20] },
        ],
      });
    }

    it('renders', async () => {
      const timeRange = {
        from: dateTime(1000),
        to: dateTime(2000),
        raw: { from: 'now-2s', to: 'now' },
      };
      renderHeatmapPanel({ series: [createSparseHeatmapCellsFrame()], timeRange }, undefined, { timeRange });
      await assertCanvasOutput();
    });
  });
  describe('Exemplars', () => {
    it('renders', async () => {
      const exemplarFrame = createExemplarFrame({
        timeValues: [1, 2, 3, 4, 5, 6],
        values: [0, 1, 0, 1, 1, 1],
      });

      // Heatmap exemplars are rendered entirely within the canvas
      renderHeatmapPanel({ series: [createDenseHeatmapFrameWithOrdinalY()], annotations: [exemplarFrame] });
      await assertCanvasOutput();
    });

    it('exemplar color', async () => {
      const exemplarFrame = createExemplarFrame({
        timeValues: [1, 2, 3, 4, 5, 6],
        values: [0, 1, 0, 1, 1, 1],
      });

      renderHeatmapPanel(
        { series: [createDenseHeatmapFrameWithOrdinalY()], annotations: [exemplarFrame] },
        { exemplars: { color: 'rgba(0, 200, 80, 0.95)' } }
      );
      await assertCanvasOutput();
    });
  });
  describe('Annotations', () => {
    it('renders points', async () => {
      const annoFrame = createAnnotationFrame({
        timeValues: [1, 2, 3, 4, 5, 6],
      });

      // only asserts on the canvas portions of the annotation (i.e. the dotted line)
      renderHeatmapPanel({ series: [createDenseHeatmapFrameWithOrdinalY()], annotations: [annoFrame] });
      await assertCanvasOutput();
    });

    it('Regression: does NOT render regions', async () => {
      const annoFrame = createAnnotationFrame({
        timeValues: [2, 5],
        timeEnd: [3, 6],
      });

      // Heatmap does not currently support annotation regions!
      renderHeatmapPanel({ series: [createDenseHeatmapFrameWithOrdinalY()], annotations: [annoFrame] });
      await assertCanvasOutput();
    });
  });
  // these tests only capture the uPlot axis draw events
  describe('Axes', () => {
    const stableRowsTimeRange = {
      from: dateTime(0),
      to: dateTime(1000),
      raw: { from: 'now-4s', to: 'now' },
    };
    const stableRowsTimeValues = [1000, 2000, 3000];

    describe('X Axis', () => {
      it.each([HeatmapCellLayout.le, HeatmapCellLayout.ge, HeatmapCellLayout.auto, HeatmapCellLayout.unknown])(
        'layout: %s',
        async (layout) => {
          renderHeatmapPanel(
            {
              series: [createHeatmapRowsFrame({ timeValues: stableRowsTimeValues })],
              timeRange: stableRowsTimeRange,
            },
            { rowsFrame: { ...fullDefaultOptions.rowsFrame, layout } },
            { timeRange: stableRowsTimeRange, fieldConfig: { overrides: [], defaults: { custom: {} } } }
          );
          await assertAxesOutput();
        }
      );
    });

    describe('Y Axis', () => {
      it.each(Object.values(AxisPlacement))('placement: %s', async (axisPlacement) => {
        renderHeatmapPanel(
          { series: [createDenseHeatmapFrameWithOrdinalY()] },
          { yAxis: { axisPlacement, axisLabel: 'y-axis-label' } }
        );
        await assertAxesOutput();
      });

      it('reverse', async () => {
        renderHeatmapPanel({ series: [createDenseHeatmapFrameWithOrdinalY()] }, { yAxis: { reverse: true } });
        await assertAxesOutput();
      });

      it('width', async () => {
        renderHeatmapPanel({ series: [createDenseHeatmapFrameWithOrdinalY()] }, { yAxis: { axisWidth: 200 } });
        await assertAxesOutput();
      });
    });
  });
});
