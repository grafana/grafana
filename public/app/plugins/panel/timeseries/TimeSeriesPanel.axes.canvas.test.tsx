import { AxisPlacement } from '@grafana/schema';

import {
  assertAxesOutput,
  type CanvasCase,
  customFieldConfig,
  renderTimeSeriesPanel,
  setupCanvasCapture,
} from './TimeSeriesPanel.canvasTestUtils';

jest.mock('@grafana/ui/src/utils/measureText', () =>
  require('@grafana/test-utils/canvas').createGrafanaUiMeasureTextJestMock(() =>
    require('./TimeSeriesPanel.canvasTestUtils').getUPlotInstance()
  )
);

describe('TimeSeriesPanel (canvas) — Axes', () => {
  setupCanvasCapture();

  it.each<CanvasCase>([
    // Auto resolves to Left, and Left is the default placement, so both are covered by `X Axis: defaults`.
    ...Object.values(AxisPlacement)
      .filter((axisPlacement) => axisPlacement !== AxisPlacement.Auto && axisPlacement !== AxisPlacement.Left)
      .map((axisPlacement) => ({
        name: `Y Axis placement: ${axisPlacement}`,
        panelProps: customFieldConfig({ axisPlacement }),
      })),
    // Soft min/max (custom axisSoftMin/Max) only expands the auto-range; here it stretches the Y axis to
    // 0-100 even though the data fits in 10-25.
    { name: 'Y Axis: soft min/max', panelProps: customFieldConfig({ axisSoftMin: 0, axisSoftMax: 100 }) },
    // Hard min/max (standard field config, a different path than soft) pins the Y axis to a fixed range.
    // Uses a different range (0-50) than the soft case so the snapshot stays distinct.
    { name: 'Y Axis: hard min/max', panelProps: customFieldConfig({}, { min: 0, max: 50 }) },
    { name: 'X Axis: defaults' },
  ] satisfies CanvasCase[])('$name', async ({ data, options, panelProps, size }) => {
    renderTimeSeriesPanel(data, options, panelProps);
    await assertAxesOutput(size);
  });
});
