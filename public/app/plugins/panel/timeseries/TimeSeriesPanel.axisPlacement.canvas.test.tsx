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

describe('TimeSeriesPanel (canvas) — axis placement', () => {
  setupCanvasCapture();

  it.each<CanvasCase>([
    // Auto resolves to Left, and Left is the default placement, so both are covered by `X Axis: defaults`
    // (in the axis range suite).
    ...Object.values(AxisPlacement)
      .filter((axisPlacement) => axisPlacement !== AxisPlacement.Auto && axisPlacement !== AxisPlacement.Left)
      .map((axisPlacement) => ({
        name: `Y Axis placement: ${axisPlacement}`,
        panelProps: customFieldConfig({ axisPlacement }),
      })),
  ] satisfies CanvasCase[])('$name', async ({ data, options, panelProps, size }) => {
    renderTimeSeriesPanel(data, options, panelProps);
    await assertAxesOutput(size);
  });
});
