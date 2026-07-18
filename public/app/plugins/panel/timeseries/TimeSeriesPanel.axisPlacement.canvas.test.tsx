import { AxisPlacement } from '@grafana/schema';

import {
  type CanvasCase,
  customFieldConfig,
  renderCanvasCase,
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
    // Auto and Left are covered by 'X Axis: defaults' in the axis range suite.
    ...Object.values(AxisPlacement)
      .filter((axisPlacement) => axisPlacement !== AxisPlacement.Auto && axisPlacement !== AxisPlacement.Left)
      .map((axisPlacement) => ({
        name: `Y Axis placement: ${axisPlacement}`,
        panelProps: customFieldConfig({ custom: { axisPlacement } }),
      })),
  ])('$name', (testCase) => renderCanvasCase(testCase, 'axes'));
});
