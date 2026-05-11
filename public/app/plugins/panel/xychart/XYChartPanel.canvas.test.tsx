import { render, screen, waitFor } from '@testing-library/react';
import { type CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import { removeCanvasTransforms } from 'jest-canvas-mock-compare';
import type uPlot from 'uplot';

import {
  createTheme,
  type DataFrame,
  dateTime,
  EventBusSrv,
  getDisplayProcessor,
  LoadingState,
  type PanelProps,
  type TimeRange,
  toDataFrame,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { LegendDisplayMode, SortOrder, TooltipDisplayMode } from '@grafana/schema';
import { measureText as uPlotAxisMeasureText, type UPlotConfigBuilder } from '@grafana/ui';
import { XYChartPanel2 } from 'app/plugins/panel/xychart/XYChartPanel';
import { type Options, SeriesMapping } from 'app/plugins/panel/xychart/panelcfg.gen';

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
      config: {
        custom: {
          show: 'points',
          pointSize: {
            fixed: 32,
          },
          pointShape: 'circle',
          pointStrokeWidth: 1,
          fillOpacity: 50,
          axisPlacement: 'auto',
          axisLabel: '',
          axisColorMode: 'text',
          axisBorderShow: false,
          scaleDistribution: {
            type: 'linear',
          },
          axisCenteredZero: false,
          hideFrom: {
            legend: false,
            tooltip: false,
            viz: false,
          },
        },
        fieldMinMax: false,
        color: {
          mode: 'fixed',
          fixedColor: 'blue',
        },
        mappings: [],
        thresholds: {
          mode: 'absolute',
          steps: [
            {
              value: null,
              color: 'green',
            },
            {
              value: 80,
              color: 'red',
            },
          ],
        },
      },
      name: 'x',
      values: [1, 3, 5],
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
          axisPlacement: 'auto',
          axisLabel: '',
          axisColorMode: 'text',
          axisBorderShow: false,
          scaleDistribution: {
            type: 'linear',
          },
          axisCenteredZero: false,
          hideFrom: {
            legend: false,
            tooltip: false,
            viz: false,
          },
        },
        fieldMinMax: false,
        color: {
          mode: 'fixed',
          fixedColor: 'blue',
        },
        mappings: [],
        thresholds: {
          mode: 'absolute',
          steps: [
            {
              value: null,
              color: 'green',
            },
            {
              value: 80,
              color: 'red',
            },
          ],
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
          axisPlacement: 'auto',
          axisLabel: '',
          axisColorMode: 'text',
          axisBorderShow: false,
          scaleDistribution: {
            type: 'linear',
          },
          axisCenteredZero: false,
          hideFrom: {
            legend: false,
            tooltip: false,
            viz: false,
          },
        },
        fieldMinMax: false,
        color: {
          mode: 'fixed',
          fixedColor: 'blue',
        },
        mappings: [],
        thresholds: {
          mode: 'absolute',
          steps: [
            {
              value: null,
              color: 'green',
            },
            {
              value: 80,
              color: 'red',
            },
          ],
        },
      },
      name: 'z',
      values: [3, 5, 7],
      typeInfo: {
        frame: 'int64',
        nullable: true,
      },
    },
  ],
});
defaultFrame.fields = defaultFrame.fields.map((field) => ({
  ...field,
  display: getDisplayProcessor({ field, theme }),
}));

const setUp = (
  propsOverrides?: Partial<PanelProps<Options>>,
  seriesOverride?: DataFrame[],
  timeRangeOverride?: TimeRange
) => {
  const defaultTimeRange = timeRangeOverride ?? {
    from: dateTime(0),
    to: dateTime(100),
    raw: { from: 'now', to: 'now' },
  };
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
      options={{
        series: [],
        legend: { showLegend: false, displayMode: LegendDisplayMode.Hidden, calcs: [], placement: 'bottom' },
        mapping: SeriesMapping.Auto,
        tooltip: { sort: SortOrder.None, mode: TooltipDisplayMode.None },
        ...propsOverrides?.options,
      }}
      {...propsOverrides}
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

  it('renders default options', async () => {
    setUp(undefined, [defaultFrame]);
    await assertCanvasOutput();
  });
});
