import { GraphDrawStyle, LineInterpolation } from '@grafana/schema';

import {
  assertCanvasOutput,
  type CanvasCase,
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

describe('TimeSeriesPanel (canvas) — line rendering', () => {
  setupCanvasCapture();

  it.each<CanvasCase>([
    { name: 'defaults' },
    // Line is the default draw style, covered by `defaults`. Fixed color + a visible fill so the shape
    // (bars/points) actually renders — with the default transparent fill they draw nothing.
    ...Object.values(GraphDrawStyle)
      .filter((drawStyle) => drawStyle !== GraphDrawStyle.Line)
      .map((drawStyle) => ({
        name: `drawStyle: ${drawStyle}`,
        // Fixed color + a visible fill so bars read clearly. Points render via the shared pointSize/showPoints
        // defaults (drawStyle:points force-shows markers), matching a real panel.
        panelProps: customFieldConfig({ drawStyle, fillOpacity: 25 }, fixedBlue),
      })),
    // Linear is the default interpolation, covered by `defaults`.
    ...Object.values(LineInterpolation)
      .filter((lineInterpolation) => lineInterpolation !== LineInterpolation.Linear)
      .map((lineInterpolation) => ({
        name: `lineInterpolation: ${lineInterpolation}`,
        panelProps: customFieldConfig({ lineInterpolation }),
      })),
    // Width 1 is the default, so start at 3 and use bold, well-separated widths. Fixed color so the stroke
    // is high-contrast and each width is visibly distinct.
    ...[3, 6, 10].map((lineWidth) => ({
      name: `lineWidth: ${lineWidth}`,
      panelProps: customFieldConfig({ lineWidth }, fixedBlue),
    })),
  ] satisfies CanvasCase[])('$name', async ({ data, options, panelProps, size }) => {
    renderTimeSeriesPanel(data, options, panelProps);
    await assertCanvasOutput(size);
  });
});
