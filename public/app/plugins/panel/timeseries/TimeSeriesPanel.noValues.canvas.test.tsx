import { screen, waitFor } from '@testing-library/react';

import { createDataFrame, FieldType, ThresholdsMode } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { FlagKeys } from '@grafana/runtime/internal';
import { GraphThresholdsStyleMode } from '@grafana/schema';
import { setTestFlags } from '@grafana/test-utils/unstable';

import {
  DAY_MS,
  getUPlotInstance,
  renderTimeSeriesPanel,
  setupCanvasCapture,
  START_MS,
  withFieldConfig,
} from './TimeSeriesPanel.canvasTestUtils';

jest.mock('@grafana/ui/src/utils/measureText', () =>
  require('@grafana/test-utils/canvas').createGrafanaUiMeasureTextJestMock(() =>
    require('./TimeSeriesPanel.canvasTestUtils').getUPlotInstance()
  )
);

const zeroRowFrame = () =>
  createDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [] },
      { name: 'value', type: FieldType.number, values: [] },
    ],
  });

const nullOnlyFrame = () =>
  createDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [START_MS, START_MS + DAY_MS, START_MS + 2 * DAY_MS] },
      { name: 'value', type: FieldType.number, values: [null, null, null] },
    ],
  });

const thresholdsConfig = (defaults = {}) =>
  withFieldConfig({
    custom: { thresholdsStyle: { mode: GraphThresholdsStyleMode.Line } },
    defaults: {
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: 'green' },
          { value: 80, color: 'red' },
        ],
      },
      ...defaults,
    },
  });

async function waitForPlot() {
  await waitFor(() =>
    expect(screen.getByTestId(selectors.components.VizLayout.container).querySelector('.u-over')).toBeVisible()
  );
  await waitFor(() => expect(getUPlotInstance()).toBeDefined());
  return getUPlotInstance()!;
}

describe('TimeSeriesPanel (canvas) — frames with no values, thresholds without data off', () => {
  setupCanvasCapture();

  it.each([
    { name: 'zero-row frame', frame: zeroRowFrame },
    { name: 'null-only frame', frame: nullOnlyFrame },
  ])('$name reaches uPlot with a disabled y scale', async ({ frame }) => {
    renderTimeSeriesPanel({ series: [frame()] }, undefined, thresholdsConfig());
    const u = await waitForPlot();

    const yScale = u.scales[u.series[1].scale!];

    expect(u.series).toHaveLength(2);
    expect(yScale.min).toBeNull();
    expect(yScale.max).toBeNull();
  });

  it.each([
    { name: 'zero-row frame', frame: zeroRowFrame },
    { name: 'null-only frame', frame: nullOnlyFrame },
  ])('$name with hard min and max gets a fixed y range', async ({ frame }) => {
    renderTimeSeriesPanel({ series: [frame()] }, undefined, thresholdsConfig({ min: 0, max: 100 }));
    const u = await waitForPlot();

    const yScale = u.scales[u.series[1].scale!];

    expect(yScale.min).toBe(0);
    expect(yScale.max).toBe(100);
  });
});

describe('TimeSeriesPanel (canvas) — frames with no values, thresholds without data on', () => {
  setupCanvasCapture();

  beforeEach(() => {
    setTestFlags({ [FlagKeys.TimeseriesThresholdsWithoutData]: true });
  });

  afterEach(() => {
    setTestFlags({});
  });

  const expectRangeAroundThreshold = async () => {
    const u = await waitForPlot();
    const yScale = u.scales[u.series[1].scale!];

    expect(yScale.min).toBeLessThanOrEqual(80);
    expect(yScale.max).toBeGreaterThan(80);
  };

  it.each([
    { name: 'zero-row frame', frame: zeroRowFrame },
    { name: 'null-only frame', frame: nullOnlyFrame },
  ])('$name ranges the y scale over the thresholds and shows the overlay', async ({ frame }) => {
    renderTimeSeriesPanel({ series: [frame()] }, undefined, thresholdsConfig());

    await expectRangeAroundThreshold();
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('draws a placeholder plot for a response with no frames', async () => {
    renderTimeSeriesPanel({ series: [] }, undefined, thresholdsConfig());

    await expectRangeAroundThreshold();
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('shows the configured no value text in the overlay', async () => {
    renderTimeSeriesPanel({ series: [] }, undefined, thresholdsConfig({ noValue: 'Nothing yet' }));

    await waitForPlot();
    expect(screen.getByText('Nothing yet')).toBeInTheDocument();
  });

  it('keeps hard min and max over the thresholds range', async () => {
    renderTimeSeriesPanel({ series: [nullOnlyFrame()] }, undefined, thresholdsConfig({ min: 0, max: 50 }));
    const u = await waitForPlot();
    const yScale = u.scales[u.series[1].scale!];

    expect(yScale.min).toBe(0);
    expect(yScale.max).toBe(50);
  });
});
