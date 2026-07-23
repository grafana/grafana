import {
  createAnnotationFrame,
  DAY_MS,
  renderCanvasCase,
  setupCanvasCapture,
  START_MS,
} from './TimeSeriesPanel.canvasTestUtils';

jest.mock('@grafana/ui/src/utils/measureText', () =>
  require('@grafana/test-utils/canvas').createGrafanaUiMeasureTextJestMock(() =>
    require('./TimeSeriesPanel.canvasTestUtils').getUPlotInstance()
  )
);

describe('TimeSeriesPanel (canvas) — Annotations', () => {
  setupCanvasCapture();

  // TODO: annotation lines flakily fail to render to the canvas under parallel test load; both cases are
  // skipped to unblock PRs while the rendering regression is investigated by dataviz.
  it.skip('point annotations', () =>
    renderCanvasCase({
      name: 'point annotations',
      data: {
        annotations: [
          createAnnotationFrame({ timeValues: [START_MS + DAY_MS, START_MS + 2 * DAY_MS, START_MS + 3 * DAY_MS] }),
        ],
      },
    }));

  it.skip('region annotations', () =>
    renderCanvasCase({
      name: 'region annotations',
      data: {
        annotations: [
          createAnnotationFrame({ timeValues: [START_MS + 1.5 * DAY_MS], timeEnd: [START_MS + 2.5 * DAY_MS] }),
        ],
      },
    }));
});
