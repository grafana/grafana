import { FieldColorModeId, ThresholdsMode } from '@grafana/data';
import { GraphGradientMode, StackingMode } from '@grafana/schema';

import {
  assertCanvasOutput,
  type CanvasCase,
  compactCanvas,
  createMultiSeriesFrame,
  customFieldConfig,
  fixedBlue,
  renderTimeSeriesPanel,
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
      panelProps: customFieldConfig({ fillOpacity }, fixedBlue),
    })),
    // None is the default gradient mode, covered by `defaults`; Scheme is a separate explicit case below.
    ...Object.values(GraphGradientMode)
      .filter((gradientMode) => gradientMode !== GraphGradientMode.None && gradientMode !== GraphGradientMode.Scheme)
      .map((gradientMode) => ({
        name: `gradientMode: ${gradientMode}`,
        panelProps: customFieldConfig({ gradientMode }),
      })),
    // Scheme gradients color the line by the field's threshold scale, so they require a color mode +
    // thresholds; without them uPlot's gradient builder throws.
    {
      name: 'gradientMode: scheme',
      panelProps: customFieldConfig(
        { gradientMode: GraphGradientMode.Scheme },
        {
          color: { mode: FieldColorModeId.Thresholds },
          thresholds: {
            mode: ThresholdsMode.Absolute,
            steps: [
              { value: -Infinity, color: 'green' },
              { value: 20, color: 'red' },
            ],
          },
        }
      ),
    },
    {
      name: 'stacking: normal',
      data: { series: [createMultiSeriesFrame()] },
      panelProps: { ...customFieldConfig({ stacking: { mode: StackingMode.Normal, group: 'A' } }), ...compactCanvas },
      size: compactCanvas,
    },
    {
      name: 'stacking: 100%',
      data: { series: [createMultiSeriesFrame()] },
      panelProps: { ...customFieldConfig({ stacking: { mode: StackingMode.Percent, group: 'A' } }), ...compactCanvas },
      size: compactCanvas,
    },
  ] satisfies CanvasCase[])('$name', async ({ data, options, panelProps, size }) => {
    renderTimeSeriesPanel(data, options, panelProps);
    await assertCanvasOutput(size);
  });
});
