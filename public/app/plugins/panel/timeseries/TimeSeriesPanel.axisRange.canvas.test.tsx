import { StackingMode } from '@grafana/schema';

import {
  type CanvasCase,
  createMultiSeriesFrame,
  customFieldConfig,
  renderCanvasCase,
  setupCanvasCapture,
} from './TimeSeriesPanel.canvasTestUtils';

jest.mock('@grafana/ui/src/utils/measureText', () =>
  require('@grafana/test-utils/canvas').createGrafanaUiMeasureTextJestMock(() =>
    require('./TimeSeriesPanel.canvasTestUtils').getUPlotInstance()
  )
);

describe('TimeSeriesPanel (canvas) — axis range', () => {
  setupCanvasCapture();

  it.each<CanvasCase>([
    // Soft min/max (custom axisSoftMin/Max) only expands the auto-range; here it stretches the Y axis to
    // 0-100 even though the data fits in 10-25.
    { name: 'Y Axis: soft min/max', panelProps: customFieldConfig({ custom: { axisSoftMin: 0, axisSoftMax: 100 } }) },
    // Hard min/max (standard field config, a different path than soft) pins the Y axis to a fixed range.
    // Uses a different range (0-50) than the soft case so the snapshot stays distinct.
    { name: 'Y Axis: hard min/max', panelProps: customFieldConfig({ defaults: { min: 0, max: 50 } }) },
    { name: 'X Axis: defaults' },
    // Stacking rescales the Y axis: Normal sums the series (range grows), Percent normalizes to 0-100%.
    // Asserted via the axis layer since the series-only fills tests don't capture the axis change.
    {
      name: 'Y Axis: stacking normal',
      data: { series: [createMultiSeriesFrame()] },
      panelProps: customFieldConfig({ custom: { stacking: { mode: StackingMode.Normal, group: 'A' } } }),
    },
    {
      name: 'Y Axis: stacking 100%',
      data: { series: [createMultiSeriesFrame()] },
      panelProps: customFieldConfig({ custom: { stacking: { mode: StackingMode.Percent, group: 'A' } } }),
    },
  ] satisfies CanvasCase[])('$name', (testCase) => renderCanvasCase(testCase, 'axes'));
});
