import { screen, waitFor } from '@testing-library/react';

import { createDataFrame, FieldType, ThresholdsMode } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { FlagKeys } from '@grafana/runtime/internal';
import { GraphThresholdsStyleMode } from '@grafana/schema';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { TimeSeriesPanel } from './TimeSeriesPanel';
import {
  DAY_MS,
  getTimeSeriesPanelProps,
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

  it('keeps the y axis when every series is hidden from the viz', async () => {
    const config = thresholdsConfig();
    config.fieldConfig!.defaults.custom = {
      ...config.fieldConfig!.defaults.custom,
      hideFrom: { legend: false, tooltip: false, viz: true },
    };
    renderTimeSeriesPanel({ series: [nullOnlyFrame()] }, undefined, config);

    await expectRangeAroundThreshold();
  });

  it('keeps the thresholds without the overlay when every series with values is hidden from the viz', async () => {
    const config = thresholdsConfig();
    config.fieldConfig!.defaults.custom = {
      ...config.fieldConfig!.defaults.custom,
      hideFrom: { legend: false, tooltip: false, viz: true },
    };
    const valueFrame = createDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [START_MS, START_MS + DAY_MS] },
        { name: 'value', type: FieldType.number, values: [10, 20] },
      ],
    });
    renderTimeSeriesPanel({ series: [valueFrame] }, undefined, config);

    await expectRangeAroundThreshold();
    expect(screen.queryByText('No data')).not.toBeInTheDocument();
  });

  it('keeps the same plot when a response turns empty', async () => {
    const valueFrame = createDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [START_MS, START_MS + DAY_MS] },
        { name: 'value', type: FieldType.number, values: [10, 20] },
      ],
    });
    const { rerender } = renderTimeSeriesPanel({ series: [valueFrame] }, undefined, thresholdsConfig());
    const before = await waitForPlot();

    rerender(
      <TimeSeriesPanel {...getTimeSeriesPanelProps({ series: [nullOnlyFrame()] }, undefined, thresholdsConfig())} />
    );

    expect(getUPlotInstance()).toBe(before);
    await expectRangeAroundThreshold();
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('shows a no value override of the field in the overlay', async () => {
    const config = thresholdsConfig();
    config.fieldConfig!.overrides = [
      { matcher: { id: 'byName', options: 'value' }, properties: [{ id: 'noValue', value: 'From override' }] },
    ];
    renderTimeSeriesPanel({ series: [nullOnlyFrame()] }, undefined, config);

    await waitForPlot();
    expect(screen.getByText('From override')).toBeInTheDocument();
  });

  it('ranges over percentage thresholds when a soft min unfixes min and max', async () => {
    const config = withFieldConfig({
      custom: { thresholdsStyle: { mode: GraphThresholdsStyleMode.Line }, axisSoftMin: -50 },
      defaults: {
        min: 0,
        max: 200,
        thresholds: {
          mode: ThresholdsMode.Percentage,
          steps: [
            { value: -Infinity, color: 'green' },
            { value: 25, color: 'orange' },
            { value: 75, color: 'red' },
          ],
        },
      },
    });
    renderTimeSeriesPanel({ series: [nullOnlyFrame()] }, undefined, config);
    const u = await waitForPlot();
    const yScale = u.scales[u.series[1].scale!];

    expect(yScale.min).toBeLessThanOrEqual(50);
    expect(yScale.max).toBeGreaterThanOrEqual(150);
  });

  it('keeps hard min and max over the thresholds range', async () => {
    renderTimeSeriesPanel({ series: [nullOnlyFrame()] }, undefined, thresholdsConfig({ min: 0, max: 50 }));
    const u = await waitForPlot();
    const yScale = u.scales[u.series[1].scale!];

    expect(yScale.min).toBe(0);
    expect(yScale.max).toBe(50);
  });
});
