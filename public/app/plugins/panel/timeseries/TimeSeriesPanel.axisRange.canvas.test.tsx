import { StackingMode } from '@grafana/schema';

import {
  type CanvasCase,
  createMultiSeriesFrame,
  renderCanvasCase,
  setupCanvasCapture,
  withFieldConfig,
} from './TimeSeriesPanel.canvasTestUtils';

jest.mock('@grafana/ui/src/utils/measureText', () =>
  require('@grafana/test-utils/canvas').createGrafanaUiMeasureTextJestMock(() =>
    require('./TimeSeriesPanel.canvasTestUtils').getUPlotInstance()
  )
);

describe('TimeSeriesPanel (canvas) — axis range', () => {
  setupCanvasCapture();

  it.each<CanvasCase>([
    // Soft min/max only expands the auto-range; here it stretches the Y axis to 0-100 for data in 10-25.
    { name: 'Y Axis: soft min/max', panelProps: withFieldConfig({ custom: { axisSoftMin: 0, axisSoftMax: 100 } }) },
    // Hard min/max pins the axis; a different range than the soft case keeps the snapshot distinct.
    { name: 'Y Axis: hard min/max', panelProps: withFieldConfig({ defaults: { min: 0, max: 50 } }) },
    { name: 'X Axis: defaults' },
    // Stacking rescales the Y axis: Normal sums the series, Percent normalizes to 0-100%.
    {
      name: 'Y Axis: stacking normal',
      data: { series: [createMultiSeriesFrame()] },
      panelProps: withFieldConfig({ custom: { stacking: { mode: StackingMode.Normal, group: 'A' } } }),
    },
    {
      name: 'Y Axis: stacking 100%',
      data: { series: [createMultiSeriesFrame()] },
      panelProps: withFieldConfig({ custom: { stacking: { mode: StackingMode.Percent, group: 'A' } } }),
    },
  ])('$name', (testCase) => renderCanvasCase(testCase, 'axes'));
});
