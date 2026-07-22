import { AxisPlacement } from '@grafana/schema';

import {
  type CanvasCase,
  renderCanvasCase,
  setupCanvasCapture,
  withFieldConfig,
} from './TimeSeriesPanel.canvasTestUtils';

jest.mock('@grafana/ui/src/utils/measureText', () =>
  require('@grafana/test-utils/canvas').createGrafanaUiMeasureTextJestMock(() =>
    require('./TimeSeriesPanel.canvasTestUtils').getUPlotInstance()
  )
);

describe('TimeSeriesPanel (canvas) — axis placement', () => {
  setupCanvasCapture();

  // Auto resolves to Left and Left is the default, both covered by 'X Axis: defaults' in the axis range suite.
  it.each<CanvasCase>([
    { name: 'Y Axis placement: top', panelProps: withFieldConfig({ custom: { axisPlacement: AxisPlacement.Top } }) },
    {
      name: 'Y Axis placement: right',
      panelProps: withFieldConfig({ custom: { axisPlacement: AxisPlacement.Right } }),
    },
    {
      name: 'Y Axis placement: bottom',
      panelProps: withFieldConfig({ custom: { axisPlacement: AxisPlacement.Bottom } }),
    },
    {
      name: 'Y Axis placement: hidden',
      panelProps: withFieldConfig({ custom: { axisPlacement: AxisPlacement.Hidden } }),
    },
  ])('$name', (testCase) => renderCanvasCase(testCase, 'axes'));
});
