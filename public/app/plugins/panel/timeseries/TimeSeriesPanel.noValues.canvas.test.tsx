import { screen, waitFor } from '@testing-library/react';

import { createDataFrame, FieldType, ThresholdsMode } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { GraphThresholdsStyleMode } from '@grafana/schema';

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

// Spike: confirms that frames with no values reach a uPlot instance, and records the y scale state.
describe('TimeSeriesPanel (canvas) — frames with no values', () => {
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
