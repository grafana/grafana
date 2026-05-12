import { render, screen, waitFor } from '@testing-library/react';
import { type CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import { removeCanvasTransforms } from 'jest-canvas-mock-compare';
import type uPlot from 'uplot';

import {
  createTheme,
  type DataFrame,
  dateTime,
  EventBusSrv,
  FieldMatcherID,
  FieldColorModeId,
  FrameMatcherID,
  getDisplayProcessor,
  LoadingState,
  type PanelProps,
  type TimeRange,
  ThresholdsMode,
  toDataFrame,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { LegendDisplayMode, SortOrder, TooltipDisplayMode } from '@grafana/schema';
import { measureText as uPlotAxisMeasureText, type UPlotConfigBuilder } from '@grafana/ui';
import { XYChartPanel2 } from 'app/plugins/panel/xychart/XYChartPanel';
import {
  type Options,
  PointShape,
  SeriesMapping,
  type XYSeriesConfig,
  XYShowMode,
} from 'app/plugins/panel/xychart/panelcfg.gen';

import * as utils from './scatter';

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

const height = 400;
const width = 600;
const onOptionsChange = jest.fn();
const onFieldConfigChange = jest.fn();
const onChangeTimeRange = jest.fn();

const theme = createTheme();
const defaultFrame = toDataFrame({
  name: 'A',
  fields: [
    {
      name: 'x',
      values: [1, 3, 5],
    },
    {
      config: {
        custom: {
          show: 'points',
          pointSize: {
            fixed: 32,
          },
          pointShape: 'circle',
          pointStrokeWidth: 1,
          fillOpacity: 50,
        },
        color: {
          mode: 'fixed',
          fixedColor: 'blue',
        },
      },
      name: 'y',
      values: [2, 4, 6],
      typeInfo: {
        frame: 'int64',
        nullable: true,
      },
    },
    {
      config: {
        custom: {
          show: 'points',
          pointSize: {
            fixed: 32,
          },
          pointShape: 'circle',
          pointStrokeWidth: 1,
          fillOpacity: 50,
        },
        color: {
          mode: 'fixed',
          fixedColor: 'blue',
        },
      },
      name: 'z',
      values: [3, 5, 7],
    },
  ],
});
defaultFrame.fields = defaultFrame.fields.map((field) => ({
  ...field,
  display: getDisplayProcessor({ field, theme }),
}));

/**
 * each point gets a different color
 */
const frameColorByThresholdZ: DataFrame = (() => {
  const fields = defaultFrame.fields.map((f) =>
    f.name !== 'z'
      ? f
      : {
          ...f,
          config: {
            ...f.config,
            color: { mode: FieldColorModeId.Thresholds },
            thresholds: {
              mode: ThresholdsMode.Absolute,
              steps: [
                { value: -Infinity, color: 'green' },
                { value: 4, color: 'blue' },
                { value: 6, color: 'red' },
              ],
            },
          },
        }
  );
  const frame: DataFrame = { ...defaultFrame, fields };
  frame.fields = fields.map((field) => ({
    ...field,
    display: getDisplayProcessor({ field, theme }),
  }));
  return frame;
})();

/** x + y only, with square points on y */
const xySquareFrame: DataFrame = (() => {
  const xField = defaultFrame.fields.find((f) => f.name === 'x')!;
  const yField = defaultFrame.fields.find((f) => f.name === 'y')!;
  const ySquare = {
    ...yField,
    config: {
      ...yField.config,
      custom: {
        ...yField.config.custom!,
        pointShape: PointShape.Square,
      },
    },
  };
  const fields = [xField, ySquare];
  const frame: DataFrame = { ...defaultFrame, fields };
  frame.fields = fields.map((field) => ({
    ...field,
    display: getDisplayProcessor({ field, theme }),
  }));
  return frame;
})();

/** x + y with points & lines. */
const xyLineDashFrame: DataFrame = (() => {
  const xField = defaultFrame.fields.find((f) => f.name === 'x')!;
  const yField = defaultFrame.fields.find((f) => f.name === 'y')!;
  const yLine = {
    ...yField,
    config: {
      ...yField.config,
      custom: {
        ...yField.config.custom!,
        show: XYShowMode.PointsAndLines,
        lineWidth: 3,
        lineStyle: {
          fill: 'dot',
          dash: [6, 6],
        },
      },
    },
  };
  const fields = [xField, yLine];
  const frame: DataFrame = { ...defaultFrame, fields };
  frame.fields = fields.map((field) => ({
    ...field,
    display: getDisplayProcessor({ field, theme }),
  }));
  return frame;
})();

/** Two numeric Y candidates (x + y only) */
const xyOnlyFrame: DataFrame = {
  ...defaultFrame,
  fields: [defaultFrame.fields.find((f) => f.name === 'x')!, defaultFrame.fields.find((f) => f.name === 'y')!],
};

function buildOptions(partial: Partial<Options> = {}): Options {
  return {
    series: partial.series ?? [],
    mapping: partial.mapping ?? SeriesMapping.Auto,
    legend: {
      showLegend: false,
      displayMode: LegendDisplayMode.Hidden,
      calcs: [],
      placement: 'bottom',
      ...partial.legend,
    },
    tooltip: {
      sort: SortOrder.None,
      mode: TooltipDisplayMode.None,
      ...partial.tooltip,
    },
  };
}

type PanelOverrides = Partial<Omit<PanelProps<Options>, 'options'>> & { options?: Partial<Options> };

function manualSeriesForFrame(opts: { yField: string; colorField?: string; sizeField?: string }): XYSeriesConfig {
  const cfg: XYSeriesConfig = {
    frame: { matcher: { id: FrameMatcherID.byIndex, options: 0 } },
    x: { matcher: { id: FieldMatcherID.byName, options: 'x' } },
    y: { matcher: { id: FieldMatcherID.byName, options: opts.yField } },
  };
  if (opts.colorField) {
    cfg.color = { matcher: { id: FieldMatcherID.byName, options: opts.colorField } };
  }
  if (opts.sizeField) {
    cfg.size = { matcher: { id: FieldMatcherID.byName, options: opts.sizeField } };
  }
  return cfg;
}

const setUp = (propsOverrides?: PanelOverrides, seriesOverride?: DataFrame[], timeRangeOverride?: TimeRange) => {
  const defaultTimeRange = timeRangeOverride ?? {
    from: dateTime(0),
    to: dateTime(100),
    raw: { from: 'now', to: 'now' },
  };
  const { options: optionsPartial, ...restOverrides } = propsOverrides ?? {};
  return render(
    <XYChartPanel2
      onChangeTimeRange={onChangeTimeRange}
      onFieldConfigChange={onFieldConfigChange}
      eventBus={new EventBusSrv()}
      title={''}
      timeZone={'utc'}
      timeRange={propsOverrides?.timeRange ?? defaultTimeRange}
      id={0}
      transparent={false}
      width={width}
      height={height}
      renderCounter={0}
      replaceVariables={(v) => v}
      onOptionsChange={onOptionsChange}
      fieldConfig={{
        defaults: {},
        overrides: [],
      }}
      options={buildOptions(optionsPartial)}
      {...restOverrides}
      data={{
        state: LoadingState.Done,
        series: seriesOverride ?? [],
        timeRange: propsOverrides?.timeRange ?? defaultTimeRange,
      }}
    />
  );
};

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

describe('XYChartPanel2', () => {
  let prepConfigSpy: jest.SpyInstance;
  const { prepConfig: realPrepConfig } = jest.requireActual('./scatter');
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
    expect(removeCanvasTransforms(uPlotInstance!.ctx.__getEvents())).toMatchCanvasSnapshot(
      uPlotAxisEvents!,
      snapshotSize
    );
  };

  beforeEach(() => {
    applyDefaultUPlotAxisMeasureTextMock();
    // VizLayout always calls `useMeasure`; when legend is hidden the result is unused. Zeros match an unmeasured rect.
    prepConfigSpy = jest.spyOn(utils, 'prepConfig').mockImplementation((opts, theme) => {
      const result = realPrepConfig(opts, theme);
      if (result.builder) {
        const builder: UPlotConfigBuilder = result.builder;
        builder.addHook('drawAxes', (u: uPlot) => {
          uPlotInstance = u;
          uPlotAxisEvents = u.ctx.__getEvents();
          if (clearAxisEvents) {
            u.ctx.__clearDrawCalls();
            u.ctx.__clearEvents();
            u.ctx.__clearPath();
          }
        });
      }
      return result;
    });
  });

  afterEach(() => {
    prepConfigSpy.mockRestore();
  });

  it('renders no data', async () => {
    setUp();
    expect(screen.getByText('Unable to render data: No data.'));
  });

  describe('Axes: x, y, z', () => {
    beforeAll(() => {
      clearAxisEvents = false;
    });
    afterAll(() => {
      clearAxisEvents = true;
    });
    it.each<[string, Partial<Options>]>([
      ['auto mapping (two Y series)', {}],
      [
        'manual mapping (x vs y only)',
        {
          mapping: SeriesMapping.Manual,
          series: [manualSeriesForFrame({ yField: 'y' })],
        },
      ],
      [
        'manual mapping (x vs z only)',
        {
          mapping: SeriesMapping.Manual,
          series: [manualSeriesForFrame({ yField: 'z' })],
        },
      ],
      [
        'manual mapping (size by z)',
        {
          mapping: SeriesMapping.Manual,
          series: [manualSeriesForFrame({ yField: 'y', sizeField: 'z' })],
        },
      ],
    ])('%s', async (_label, optionsPartial) => {
      setUp({ options: optionsPartial }, [defaultFrame]);
      await assertCanvasOutput();
    });
  });

  describe('Canvas: x, y (two numeric fields)', () => {
    it('auto mapping (single Y series)', async () => {
      setUp(undefined, [xyOnlyFrame]);
      await assertCanvasOutput();
    });
  });

  describe('Square point shape', () => {
    it('renders points as squares when y field uses PointShape.Square', async () => {
      setUp(undefined, [xySquareFrame]);
      await assertCanvasOutput();
    });
  });

  describe('Line path stroke', () => {
    it('strokes connect line with dash/dot lineStyle after points', async () => {
      setUp(undefined, [xyLineDashFrame]);
      await assertCanvasOutput();
    });
  });

  describe('Color by value', () => {
    it('renders fill/stroke', async () => {
      setUp(
        {
          options: {
            mapping: SeriesMapping.Manual,
            series: [manualSeriesForFrame({ yField: 'y', colorField: 'z' })],
          },
        },
        [frameColorByThresholdZ]
      );
      await assertCanvasOutput();
    });
  });
});
