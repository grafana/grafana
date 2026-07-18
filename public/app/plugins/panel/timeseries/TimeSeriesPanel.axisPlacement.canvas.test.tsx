import { AxisPlacement } from '@grafana/schema';

import {
  type CanvasCase,
  withFieldConfig,
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

  // Auto resolves to Left and Left is the default, so both are covered by 'X Axis: defaults' in the axis
  // range suite; here we cover the remaining placements.
  it.each<CanvasCase>(
    [AxisPlacement.Top, AxisPlacement.Right, AxisPlacement.Bottom, AxisPlacement.Hidden].map((axisPlacement) => ({
      name: `Y Axis placement: ${axisPlacement}`,
      panelProps: withFieldConfig({ custom: { axisPlacement } }),
    }))
  )('$name', (testCase) => renderCanvasCase(testCase, 'axes'));
});
