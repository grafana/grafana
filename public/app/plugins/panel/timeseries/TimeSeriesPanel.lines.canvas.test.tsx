import { GraphDrawStyle, LineInterpolation, VizOrientation } from '@grafana/schema';

import {
  type CanvasCase,
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

describe('TimeSeriesPanel (canvas) — line rendering', () => {
  setupCanvasCapture();

  it.each<CanvasCase>([
    { name: 'defaults' },
    // Line (the default draw style) is covered by 'defaults'. Fixed color + a fill so bars/points render;
    // the default transparent fill draws nothing.
    {
      name: 'drawStyle: bars',
      panelProps: withFieldConfig({ custom: { drawStyle: GraphDrawStyle.Bars, fillOpacity: 25 }, defaults: fixedBlue }),
    },
    {
      name: 'drawStyle: points',
      panelProps: withFieldConfig({
        custom: { drawStyle: GraphDrawStyle.Points, fillOpacity: 25 },
        defaults: fixedBlue,
      }),
    },
    // Linear (the default interpolation) is covered by 'defaults'.
    {
      name: 'lineInterpolation: smooth',
      panelProps: withFieldConfig({ custom: { lineInterpolation: LineInterpolation.Smooth } }),
    },
    {
      name: 'lineInterpolation: stepBefore',
      panelProps: withFieldConfig({ custom: { lineInterpolation: LineInterpolation.StepBefore } }),
    },
    {
      name: 'lineInterpolation: stepAfter',
      panelProps: withFieldConfig({ custom: { lineInterpolation: LineInterpolation.StepAfter } }),
    },
    ...[3, 6, 10].map((lineWidth) => ({
      name: `lineWidth: ${lineWidth}`,
      panelProps: withFieldConfig({ custom: { lineWidth }, defaults: fixedBlue }),
    })),
    // orientation is a panel option, not field config; Vertical puts time on the Y axis.
    { name: 'orientation: vertical', options: { orientation: VizOrientation.Vertical } },
  ])('$name', (testCase) => renderCanvasCase(testCase));
});
