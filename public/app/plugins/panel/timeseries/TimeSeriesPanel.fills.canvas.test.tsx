import { FieldColorModeId, ThresholdsMode } from '@grafana/data';
import { GraphGradientMode, StackingMode } from '@grafana/schema';

import {
  type CanvasCase,
  createMultiSeriesFrame,
  fixedBlue,
  renderCanvasCase,
  setupCanvasCapture,
  withFieldConfig,
} from './TimeSeriesPanel.canvasTestUtils';

jest.mock('@grafana/ui/src/utils/measureText', () =>
  require('@grafana/test-utils/canvas').createGrafanaUiMeasureTextJestMock(() =>
    require('./TimeSeriesPanel.canvasTestUtils').getUPlotInstance()
  )
);

describe('TimeSeriesPanel (canvas) — fills', () => {
  setupCanvasCapture();

  it.each<CanvasCase>([
    // Fixed color so each opacity step reads clearly, pale to solid.
    ...[25, 50, 80, 100].map((fillOpacity) => ({
      name: `fillOpacity: ${fillOpacity}`,
      panelProps: withFieldConfig({ custom: { fillOpacity }, defaults: fixedBlue }),
    })),
    // None (the default gradient) is already exercised by the fillOpacity cases above; Scheme is its own
    // case below. Gradients paint the fill, so pair with a non-zero fillOpacity or nothing shows.
    {
      name: 'gradientMode: opacity',
      panelProps: withFieldConfig({ custom: { gradientMode: GraphGradientMode.Opacity, fillOpacity: 25 } }),
    },
    {
      name: 'gradientMode: hue',
      panelProps: withFieldConfig({ custom: { gradientMode: GraphGradientMode.Hue, fillOpacity: 25 } }),
    },
    // Scheme gradients color by the threshold scale, so they need a color mode + thresholds (uPlot's
    // gradient builder throws without them) plus a fill to be visible.
    {
      name: 'gradientMode: scheme',
      panelProps: withFieldConfig({
        custom: { gradientMode: GraphGradientMode.Scheme, fillOpacity: 25 },
        defaults: {
          color: { mode: FieldColorModeId.Thresholds },
          thresholds: {
            mode: ThresholdsMode.Absolute,
            steps: [
              { value: -Infinity, color: 'green' },
              { value: 20, color: 'red' },
            ],
          },
        },
      }),
    },
    // fillOpacity so the regions show: unstacked the three fills overlap, stacked they sit on top of each other.
    {
      name: 'stacking: none (overlapping fills)',
      data: { series: [createMultiSeriesFrame()] },
      panelProps: withFieldConfig({ custom: { stacking: { mode: StackingMode.None, group: 'A' }, fillOpacity: 50 } }),
    },
    {
      name: 'stacking: normal',
      data: { series: [createMultiSeriesFrame()] },
      panelProps: withFieldConfig({ custom: { stacking: { mode: StackingMode.Normal, group: 'A' }, fillOpacity: 50 } }),
    },
    {
      name: 'stacking: 100%',
      data: { series: [createMultiSeriesFrame()] },
      panelProps: withFieldConfig({
        custom: { stacking: { mode: StackingMode.Percent, group: 'A' }, fillOpacity: 50 },
      }),
    },
  ])('$name', (testCase) => renderCanvasCase(testCase));
});
