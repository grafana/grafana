import { SceneDataLayers, SceneGridItem, SceneGridLayout, SceneTimeRange } from '@grafana/scenes';

import { AlertStatesDataLayer } from '../scene/AlertStatesDataLayer';
import { DashboardAnnotationsDataLayer } from '../scene/DashboardAnnotationsDataLayer';
import { DashboardScene } from '../scene/DashboardScene';
import { activateFullSceneTree } from '../utils/test-utils';

import { AnnotationsEditView } from './AnnotationsEditView';

describe('AnnotationsEditView', () => {
  describe('Dashboard annotations state', () => {
    let annotationsView: AnnotationsEditView;

    beforeEach(async () => {
      const result = await buildTestScene();
      annotationsView = result.annotationsView;
    });

    it('should return the correct urlKey', () => {
      expect(annotationsView.getUrlKey()).toBe('annotations');
    });
  });
});

async function buildTestScene() {
  const annotationsView = new AnnotationsEditView({});
  const dashboard = new DashboardScene({
    $timeRange: new SceneTimeRange({}),
    title: 'hello',
    uid: 'dash-1',
    version: 4,
    meta: {
      canEdit: true,
    },
    $data: new SceneDataLayers({
      layers: [
        new DashboardAnnotationsDataLayer({
          key: `annotations-test`,
          query: {
            enable: true,
            iconColor: 'red',
            name: 'test',
          },
          name: 'test',
          isEnabled: true,
          isHidden: false,
        }),
        new AlertStatesDataLayer({
          key: 'alert-states',
          name: 'Alert States',
        }),
      ],
    }),
    body: new SceneGridLayout({
      children: [
        new SceneGridItem({
          key: 'griditem-1',
          x: 0,
          y: 0,
          width: 10,
          height: 12,
          body: undefined,
        }),
      ],
    }),
    editview: annotationsView,
  });

  activateFullSceneTree(dashboard);

  await new Promise((r) => setTimeout(r, 1));

  dashboard.onEnterEditMode();
  annotationsView.activate();

  return { dashboard, annotationsView };
}
