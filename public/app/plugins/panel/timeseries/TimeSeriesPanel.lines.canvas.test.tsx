import { GraphDrawStyle, LineInterpolation, VizOrientation } from '@grafana/schema';

import {
  type CanvasCase,
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

describe('TimeSeriesPanel (canvas) — line rendering', () => {
  setupCanvasCapture();

  it.each<CanvasCase>([
    { name: 'defaults' },
    // Fixed color + a fill so bars/points render; the default transparent fill draws nothing.
    ...Object.values(GraphDrawStyle)
      .filter((drawStyle) => drawStyle !== GraphDrawStyle.Line)
      .map((drawStyle) => ({
        name: `drawStyle: ${drawStyle}`,
        panelProps: customFieldConfig({ custom: { drawStyle, fillOpacity: 25 }, defaults: fixedBlue }),
      })),
    ...Object.values(LineInterpolation)
      .filter((lineInterpolation) => lineInterpolation !== LineInterpolation.Linear)
      .map((lineInterpolation) => ({
        name: `lineInterpolation: ${lineInterpolation}`,
        panelProps: customFieldConfig({ custom: { lineInterpolation } }),
      })),
    ...[3, 6, 10].map((lineWidth) => ({
      name: `lineWidth: ${lineWidth}`,
      panelProps: customFieldConfig({ custom: { lineWidth }, defaults: fixedBlue }),
    })),
    // orientation is a panel option, not field config; Vertical puts time on the Y axis.
    { name: 'orientation: vertical', options: { orientation: VizOrientation.Vertical } },
  ])('$name', (testCase) => renderCanvasCase(testCase));

  // timeCompare is driven by a frame with meta.timeCompare.isTimeShiftQuery, not a plain panel option, so
  // it needs comparison-frame fixtures to render. Follow-up.
  it.todo('timeCompare: renders a time-shift comparison overlay');
});
