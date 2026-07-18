import {
  assertCanvasOutput,
  type CanvasCase,
  createAnnotationFrame,
  renderTimeSeriesPanel,
  setupCanvasCapture,
} from './TimeSeriesPanel.canvasTestUtils';

jest.mock('@grafana/ui/src/utils/measureText', () =>
  require('@grafana/test-utils/canvas').createGrafanaUiMeasureTextJestMock(() =>
    require('./TimeSeriesPanel.canvasTestUtils').getUPlotInstance()
  )
);

describe('TimeSeriesPanel (canvas) — Annotations', () => {
  setupCanvasCapture();

  it.each<CanvasCase>([
    { name: 'point annotations', data: { annotations: [createAnnotationFrame({ timeValues: [1000, 2000, 3000] })] } },
    {
      name: 'region annotations',
      data: { annotations: [createAnnotationFrame({ timeValues: [1500], timeEnd: [2500] })] },
    },
  ] satisfies CanvasCase[])('$name', async ({ data }) => {
    renderTimeSeriesPanel(data);
    await assertCanvasOutput();
  });
});
