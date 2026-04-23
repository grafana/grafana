import { render, screen, waitFor } from '@testing-library/react';
import { type CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import type uPlot from 'uplot';

import {
  createDataFrame,
  DataFrameType,
  dateTime,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  type PanelData,
  toDataFrame,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { TooltipDisplayMode, VisibilityMode } from '@grafana/schema';

import { getPanelProps } from '../test-utils';

import { HeatmapPanel } from './HeatmapPanel';
import { defaultOptions, type Options } from './panelcfg.gen';
import { defaultOptions as fullDefaultOptions } from './types';
import * as heatmapUtils from './utils';
import { type prepConfig } from './utils';

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

function scrubOutput(events: CanvasRenderingContext2DEvent[]): Array<Omit<CanvasRenderingContext2DEvent, 'transform'>> {
  return events.map(({ transform, ...event }) =>
    event.props.path ? { ...event, props: { ...event.props, path: scrubOutput(event.props.path) } } : event
  );
}

const defaultPanelOptions: Options = getDefaultHeatmapPanelOptions({
  // legend breaks the tests and requires mocking react-use:useMeasure, since legend is rendered in the DOM we can run traditional unit tests to cover
  legend: { show: false },
  tooltip: {
    mode: TooltipDisplayMode.Single,
    yHistogram: false,
    showColorScale: false,
  },
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
  dataOverrides?: Partial<Pick<PanelData, 'series' | 'annotations' | 'timeRange'>>,
  optionsOverrides?: Partial<Options>,
  panelPropsOverrides?: Partial<{
    replaceVariables: (v: string) => string;
    width: number;
    height: number;
    timeRange: typeof canvasTestTimeRange;
  }>
) {
  // @todo look into why auto axis size isn't working
  const mergedOptions: Options = { ...defaultPanelOptions, yAxis: { axisWidth: 30 }, ...optionsOverrides };
  const props = getPanelProps<Options>(mergedOptions, {
    data: {
      state: LoadingState.Done,
      series: [createHeatmapRowsFrame()],
      timeRange: getDefaultTimeRange(),
      ...dataOverrides,
    },
    ...{ ...panelPropsOverrides, width, height, timeRange: canvasTestTimeRange },
  });
  return render(<HeatmapPanel {...props} />);
}

const canvasTestTimeRange = {
  from: dateTime(0),
  to: dateTime(10_000),
  raw: { from: '0', to: '10000' },
};

const width = 648;
const height = 378;

describe('HeatmapPanel (canvas)', () => {
  let prepConfigSpy: jest.SpyInstance<typeof prepConfig>;
  const { prepConfig: realPrepConfig } = jest.requireActual('./utils');
  let uPlotInstance: InstanceType<typeof uPlot> | undefined;
  let uPlotAxisEvents: CanvasRenderingContext2DEvent[] | null = null;

  const xVals = [1, 1, 2, 2, 3, 3, 5, 5, 6, 6];
  const yVals = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1];
  const countVals = [8, 12, 6, 13, 7, 9, 9, 7, 5, 9];
  /** Dense HeatmapCells frame with ordinal y labels (same cell geometry as the previous hand-built uPlot data). */
  function createDenseHeatmapFrameWithOrdinalY() {
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

  const assertCanvasOutput = async () => {
    expect(screen.getByTestId(selectors.components.VizLayout.container)).toBeVisible();
    await waitFor(() =>
      expect(screen.getByTestId(selectors.components.VizLayout.container).querySelector('.u-over')).toBeVisible()
    );
    expect(scrubOutput(uPlotInstance!.ctx.__getEvents())).toMatchUPlotSnapshot(
      uPlotAxisEvents!,
      { width, height },
      true
    );
  };

  beforeEach(() => {
    prepConfigSpy = jest.spyOn(heatmapUtils, 'prepConfig').mockImplementation((opts) => {
      const builder = realPrepConfig(opts);
      builder.addHook('drawAxes', (u: uPlot) => {
        uPlotInstance = u;
        uPlotAxisEvents = u.ctx.__getEvents();
        u.ctx.__clearDrawCalls();
        u.ctx.__clearEvents();
        u.ctx.__clearPath();
      });
      return builder;
    });
  });

  afterEach(() => {
    prepConfigSpy.mockRestore();
  });

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

    // maybe doesn't belong in this test suite
    it('calculate', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      renderHeatmapPanel({ series: [createDenseHeatmapFrameWithOrdinalY()] }, { calculate: true });
      expect(consoleError).toHaveBeenCalledWith('no heatmap fields found');
      consoleError.mockRestore();
    });

    // @todo doesn't do anything?
    // it('cellRadius', async () => {
    //   renderHeatmapPanel({ series: [createDenseHeatmapFrameWithOrdinalY()] }, { cellRadius: 200 });
    //   await assertCanvasOutput();
    // });

    // it('decimals', async () => {
    //   renderHeatmapPanel(
    //     { series: [createDenseHeatmapFrameWithOrdinalY()] },
    //     { showValue: VisibilityMode.Always }
    //   );
    //   await assertCanvasOutput();
    // });
  });
});
