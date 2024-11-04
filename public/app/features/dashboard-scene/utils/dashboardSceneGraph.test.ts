import { SceneGridLayout, SceneQueryRunner, SceneTimeRange, VizPanel, behaviors } from '@grafana/scenes';
import { DashboardCursorSync } from '@grafana/schema';

import { DashboardAnnotationsDataLayer } from '../scene/DashboardAnnotationsDataLayer';
import { DashboardControls } from '../scene/DashboardControls';
import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { DashboardScene, DashboardSceneState } from '../scene/DashboardScene';
import { VizPanelLinks, VizPanelLinksMenu } from '../scene/PanelLinks';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { dashboardSceneGraph } from './dashboardSceneGraph';
import { findVizPanelByKey } from './utils';

describe('dashboardSceneGraph', () => {
  describe('getPanelLinks', () => {
    it('should return null if no links object defined', () => {
      const scene = buildTestScene();
      const panelWithNoLinks = findVizPanelByKey(scene, 'panel-1')!;
      expect(dashboardSceneGraph.getPanelLinks(panelWithNoLinks)).toBeNull();
    });

    it('should resolve VizPanelLinks object', () => {
      const scene = buildTestScene();
      const panelWithNoLinks = findVizPanelByKey(scene, 'panel-with-links')!;
      expect(dashboardSceneGraph.getPanelLinks(panelWithNoLinks)).toBeInstanceOf(VizPanelLinks);
    });
  });

  describe('getDataLayers', () => {
    let scene: DashboardScene;

    beforeEach(async () => {
      scene = buildTestScene();
    });

    it('should return the scene data layers', () => {
      const dataLayers = dashboardSceneGraph.getDataLayers(scene);

      expect(dataLayers).toBeInstanceOf(DashboardDataLayerSet);
      expect(dataLayers?.state.annotationLayers.length).toBe(1);
    });

    it('should throw if there are no scene data layers', () => {
      scene.setState({
        $data: undefined,
      });

      expect(() => dashboardSceneGraph.getDataLayers(scene)).toThrow('DashboardDataLayerSet not found');
    });
  });

  describe('getCursorSync', () => {
    it('should return cursor sync behavior', () => {
      const scene = buildTestScene();
      const cursorSync = dashboardSceneGraph.getCursorSync(scene);

      expect(cursorSync).toBeInstanceOf(behaviors.CursorSync);
    });

    it('should return undefined if no cursor sync behavior', () => {
      const scene = buildTestScene();
      scene.setState({ $behaviors: [] });
      const cursorSync = dashboardSceneGraph.getCursorSync(scene);

      expect(cursorSync).toBeUndefined();
    });
  });
});

function buildTestScene(overrides?: Partial<DashboardSceneState>) {
  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    $timeRange: new SceneTimeRange({}),
    controls: new DashboardControls({}),
    $behaviors: [
      new behaviors.CursorSync({
        sync: DashboardCursorSync.Crosshair,
      }),
    ],
    $data: new DashboardDataLayerSet({
      annotationLayers: [
        new DashboardAnnotationsDataLayer({
          key: `annotation`,
          query: {
            enable: true,
            hide: false,
            iconColor: 'red',
            name: 'a',
          },
          name: 'a',
          isEnabled: true,
          isHidden: false,
        }),
      ],
    }),
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: [
          new DashboardGridItem({
            key: 'griditem-1',
            x: 0,
            body: new VizPanel({
              title: 'Panel A',
              key: 'panel-1',
              pluginId: 'table',
              $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
            }),
          }),
          new DashboardGridItem({
            body: new VizPanel({
              title: 'Panel D',
              key: 'panel-with-links',
              pluginId: 'table',
              $data: new SceneQueryRunner({ key: 'data-query-runner3', queries: [{ refId: 'A' }] }),
              titleItems: [new VizPanelLinks({ menu: new VizPanelLinksMenu({}) })],
            }),
          }),
        ],
      }),
    }),
    ...overrides,
  });

  return scene;
}
