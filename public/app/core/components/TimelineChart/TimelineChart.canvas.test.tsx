import { render, waitFor } from '@testing-library/react';
import { type CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import type uPlot from 'uplot';

import {
  applyFieldOverrides,
  createTheme,
  type DataFrame,
  dateTime,
  FieldColorModeId,
  FieldType,
  type TimeRange,
  ThresholdsMode,
  toDataFrame,
} from '@grafana/data';
import { LegendDisplayMode, MappingType, VisibilityMode } from '@grafana/schema';
import { applyDefaultUPlotAxisMeasureTextMock, removeCanvasTransforms } from '@grafana/test-utils/canvas';
import { measureText as uPlotAxisMeasureText, type UPlotConfigBuilder } from '@grafana/ui';

import { TimelineChart } from './TimelineChart';
import * as timelineChartUtils from './utils';
import { prepareTimelineFields, TimelineMode } from './utils';

// jest-canvas-mock reports `TextMetrics.width === text.length`, which throws off uPlot axis
// layout vs. the browser. Route @grafana/ui's measureText through the deterministic mock and
// share the canvas context with uPlot so gradient/axis geometry lands in the snapshot.
let uPlotInstance: InstanceType<typeof uPlot> | undefined;
jest.mock('@grafana/ui/src/utils/measureText', () =>
  require('@grafana/test-utils/canvas').createGrafanaUiMeasureTextJestMock(() => uPlotInstance)
);

const width = 600;
const height = 200;

const theme = createTheme();

// State values span 10-minute buckets; the time range brackets them so
// applyNullInsertThreshold does not synthesize extra edge samples.
const from = 1600000000000;
const times = [from, from + 600000, from + 1200000, from + 1800000, from + 2400000];
const timeRange: TimeRange = {
  from: dateTime(times[0]),
  to: dateTime(times[times.length - 1]),
  raw: { from: dateTime(times[0]), to: dateTime(times[times.length - 1]) },
};

/**
 * Runs raw series through the same two steps the state-timeline / status-history panels use before
 * handing frames to TimelineChart: field overrides (to attach `display` + color resolution) followed
 * by `prepareTimelineFields` (null insertion, sorting, span-null config).
 */
function prepareFrames(raw: DataFrame[], mergeValues = true): DataFrame[] {
  const withDisplay = applyFieldOverrides({
    data: raw,
    // Panels supply custom field-config defaults; the timeline core reads `field.config.custom`
    // directly when picking fill opacity, so every field (incl. the time field) needs it defined.
    fieldConfig: { defaults: { custom: { fillOpacity: 80, lineWidth: 0 } }, overrides: [] },
    replaceVariables: (v) => v,
    theme,
    timeZone: 'utc',
  });

  const { frames } = prepareTimelineFields(withDisplay, mergeValues, timeRange, theme);
  if (!frames) {
    throw new Error('prepareTimelineFields returned no frames for test fixture');
  }
  return frames;
}

/** String state series colored via value-to-text mappings (the classic state-timeline shape). */
function stateFrame(values: Array<string | null> = ['OK', 'OK', 'Warning', 'Critical', 'OK']): DataFrame[] {
  const raw = toDataFrame({
    name: 'Server',
    fields: [
      { name: 'time', type: FieldType.time, values: times, config: { custom: {} } },
      {
        name: 'State',
        type: FieldType.string,
        values,
        config: {
          mappings: [
            {
              type: MappingType.ValueToText,
              options: {
                OK: { color: 'green', index: 0 },
                Warning: { color: 'orange', index: 1 },
                Critical: { color: 'red', index: 2 },
              },
            },
          ],
        },
      },
    ],
  });
  return prepareFrames([raw]);
}

/** Two string state series → exercises multi-lane vertical distribution. */
function multiSeriesFrame(): DataFrame[] {
  const raw = toDataFrame({
    name: 'Cluster',
    fields: [
      { name: 'time', type: FieldType.time, values: times, config: { custom: {} } },
      {
        name: 'web',
        type: FieldType.string,
        values: ['OK', 'OK', 'Warning', 'OK', 'OK'],
        config: {
          mappings: [
            {
              type: MappingType.ValueToText,
              options: { OK: { color: 'green', index: 0 }, Warning: { color: 'orange', index: 1 } },
            },
          ],
        },
      },
      {
        name: 'db',
        type: FieldType.string,
        values: ['OK', 'Critical', 'Critical', 'OK', 'OK'],
        config: {
          mappings: [
            {
              type: MappingType.ValueToText,
              options: { OK: { color: 'green', index: 0 }, Critical: { color: 'red', index: 1 } },
            },
          ],
        },
      },
    ],
  });
  return prepareFrames([raw]);
}

/** Numeric series colored by absolute thresholds (continuous-ish state coloring). */
function thresholdFrame(): DataFrame[] {
  const raw = toDataFrame({
    name: 'CPU',
    fields: [
      { name: 'time', type: FieldType.time, values: times, config: { custom: {} } },
      {
        name: 'load',
        type: FieldType.number,
        values: [10, 55, 85, 95, 40],
        config: {
          color: { mode: FieldColorModeId.Thresholds },
          thresholds: {
            mode: ThresholdsMode.Absolute,
            steps: [
              { value: -Infinity, color: 'green' },
              { value: 50, color: 'orange' },
              { value: 80, color: 'red' },
            ],
          },
        },
      },
    ],
  });
  return prepareFrames([raw]);
}

type Overrides = Partial<React.ComponentProps<typeof TimelineChart>>;

function renderTimeline(frames: DataFrame[], overrides: Overrides = {}) {
  const props: React.ComponentProps<typeof TimelineChart> = {
    theme,
    frames,
    structureRev: 1,
    width,
    height,
    timeRange,
    timeZone: 'utc',
    legend: { showLegend: false, displayMode: LegendDisplayMode.List, placement: 'bottom', calcs: [] },
    replaceVariables: (v) => v,
    mode: TimelineMode.Changes,
    showValue: VisibilityMode.Auto,
    rowHeight: 0.9,
    ...overrides,
  };
  return render(<TimelineChart {...props} />);
}

describe('TimelineChart (canvas)', () => {
  let prepConfigSpy: jest.SpyInstance;
  const { preparePlotConfigBuilder: realPreparePlotConfigBuilder } = jest.requireActual('./utils');
  let uPlotAxisEvents: CanvasRenderingContext2DEvent[] | null = null;

  const assertUPlotReady = async () => {
    await waitFor(() => expect(uPlotInstance?.status).toBe(1));
    await waitFor(() => expect(document.querySelector('.u-over')).toBeInTheDocument());
  };

  const assertCanvasOutput = async (snapshotSize: { width: number; height: number } = { width, height }) => {
    await assertUPlotReady();
    expect(removeCanvasTransforms(uPlotInstance!.ctx.__getEvents())).toMatchCanvasSnapshot(
      uPlotAxisEvents!,
      snapshotSize
    );
  };

  beforeAll(() => {
    // timeline.ts reads the bare `devicePixelRatio` global for font sizing / char metrics;
    // jsdom leaves it undefined, which would yield `NaNpx` fonts.
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true, writable: true });
  });

  beforeEach(() => {
    uPlotInstance = undefined;
    uPlotAxisEvents = null;
    applyDefaultUPlotAxisMeasureTextMock(jest.mocked(uPlotAxisMeasureText));

    prepConfigSpy = jest
      .spyOn(timelineChartUtils, 'preparePlotConfigBuilder')
      .mockImplementation((opts: Parameters<typeof timelineChartUtils.preparePlotConfigBuilder>[0]) => {
        const builder: UPlotConfigBuilder = realPreparePlotConfigBuilder(opts);
        // Capture the live uPlot instance and separate out the axis-only draw events so the
        // snapshot asserts on the timeline boxes/labels, not uPlot's own axis scaffolding.
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

  it('invokes preparePlotConfigBuilder to build the uPlot config', async () => {
    renderTimeline(stateFrame());
    await assertUPlotReady();
    expect(prepConfigSpy).toHaveBeenCalled();
  });

  describe('Changes mode', () => {
    it('draws discrete state boxes', async () => {
      renderTimeline(stateFrame());
      await assertCanvasOutput();
    });

    it('renders value labels when showValue is Always', async () => {
      renderTimeline(stateFrame(), { showValue: VisibilityMode.Always });
      await assertCanvasOutput();
    });

    it('omits value labels when showValue is Never', async () => {
      renderTimeline(stateFrame(), { showValue: VisibilityMode.Never });
      await assertCanvasOutput();
    });

    it('right-aligns value labels', async () => {
      renderTimeline(stateFrame(), {
        showValue: VisibilityMode.Always,
        alignValue: 'right',
      });
      await assertCanvasOutput();
    });

    it('draws stacked lanes for multiple series', async () => {
      renderTimeline(multiSeriesFrame(), { showValue: VisibilityMode.Always });
      await assertCanvasOutput();
    });

    it('colors numeric series by thresholds', async () => {
      renderTimeline(thresholdFrame(), { showValue: VisibilityMode.Always });
      await assertCanvasOutput();
    });

    it('keeps adjacent equal states separate when mergeValues is false', async () => {
      const raw = toDataFrame({
        name: 'Server',
        fields: [
          { name: 'time', type: FieldType.time, values: times, config: { custom: {} } },
          {
            name: 'State',
            type: FieldType.string,
            values: ['OK', 'OK', 'OK', 'Critical', 'Critical'],
            config: {
              mappings: [
                {
                  type: MappingType.ValueToText,
                  options: { OK: { color: 'green', index: 0 }, Critical: { color: 'red', index: 1 } },
                },
              ],
            },
          },
        ],
      });
      // mergeValues defaults to false at render time; the frames are prepared unmerged too, so the
      // three consecutive OK samples stay as distinct boxes rather than collapsing into one.
      renderTimeline(prepareFrames([raw], false), { showValue: VisibilityMode.Always });
      await assertCanvasOutput();
    });
  });

  describe('Samples mode', () => {
    it('draws fixed-width sample bars', async () => {
      renderTimeline(stateFrame(), { mode: TimelineMode.Samples });
      await assertCanvasOutput();
    });

    it('honors colWidth for sample bar sizing', async () => {
      renderTimeline(stateFrame(), { mode: TimelineMode.Samples, colWidth: 0.5 });
      await assertCanvasOutput();
    });
  });

  describe('rowHeight', () => {
    it('renders thinner lanes with a smaller rowHeight', async () => {
      renderTimeline(multiSeriesFrame(), { rowHeight: 0.4 });
      await assertCanvasOutput();
    });
  });
});
