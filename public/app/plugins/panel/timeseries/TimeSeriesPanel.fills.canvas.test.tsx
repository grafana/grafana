import { FieldColorModeId, ThresholdsMode } from '@grafana/data';
import { GraphGradientMode, StackingMode } from '@grafana/schema';

import {
  type CanvasCase,
  compactCanvas,
  createMultiSeriesFrame,
  customFieldConfig,
  fixedBlue,
  renderCanvasCase,
  setupCanvasCapture,
} from './TimeSeriesPanel.canvasTestUtils';

jest.mock('@grafana/ui/src/utils/measureText', () =>
  require('@grafana/test-utils/canvas').createGrafanaUiMeasureTextJestMock(() =>
    require('./TimeSeriesPanel.canvasTestUtils').getUPlotInstance()
  )
);

describe('TimeSeriesPanel (canvas) — fills', () => {
  setupCanvasCapture();

  it.each<CanvasCase>([
    // fillOpacity 0 (no fill) is the default. Fixed color so each opacity step reads clearly (pale to solid).
    ...[25, 50, 80, 100].map((fillOpacity) => ({
      name: `fillOpacity: ${fillOpacity}`,
      panelProps: customFieldConfig({ custom: { fillOpacity }, defaults: fixedBlue }),
    })),
    // None is the default gradient mode, covered by `defaults`; Scheme is a separate explicit case below.
    // Gradients paint the fill, so pair with a non-zero fillOpacity — otherwise the fill is transparent and
    // the gradient can't be seen (or visually verified for divergence).
    ...Object.values(GraphGradientMode)
      .filter((gradientMode) => gradientMode !== GraphGradientMode.None && gradientMode !== GraphGradientMode.Scheme)
      .map((gradientMode) => ({
        name: `gradientMode: ${gradientMode}`,
        panelProps: customFieldConfig({ custom: { gradientMode, fillOpacity: 25 } }),
      })),
    // Scheme gradients color by the field's threshold scale, so they require a color mode + thresholds
    // (without them uPlot's gradient builder throws) and a fill to be visible.
    {
      name: 'gradientMode: scheme',
      panelProps: customFieldConfig({
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
    // fillOpacity so the stacked/overlapping regions are visible. Unstacked: the three series' fills overlay
    // each other; stacked: they sit on top of one another (no overlap). `size` renders on the compact canvas.
    {
      name: 'stacking: none (overlapping fills)',
      data: { series: [createMultiSeriesFrame()] },
      panelProps: customFieldConfig({ custom: { stacking: { mode: StackingMode.None, group: 'A' }, fillOpacity: 50 } }),
      size: compactCanvas,
    },
    {
      name: 'stacking: normal',
      data: { series: [createMultiSeriesFrame()] },
      panelProps: customFieldConfig({
        custom: { stacking: { mode: StackingMode.Normal, group: 'A' }, fillOpacity: 50 },
      }),
      size: compactCanvas,
    },
    {
      name: 'stacking: 100%',
      data: { series: [createMultiSeriesFrame()] },
      panelProps: customFieldConfig({
        custom: { stacking: { mode: StackingMode.Percent, group: 'A' }, fillOpacity: 50 },
      }),
      size: compactCanvas,
    },
  ] satisfies CanvasCase[])('$name', (testCase) => renderCanvasCase(testCase));
});
