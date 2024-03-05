import {
  SceneDataLayers,
  SceneGridItem,
  SceneGridLayout,
  SceneGridRow,
  SceneQueryRunner,
  SceneTimeRange,
  VizPanel,
  behaviors,
} from '@grafana/scenes';
import { DashboardCursorSync } from '@grafana/schema';

import { AlertStatesDataLayer } from '../scene/AlertStatesDataLayer';
import { DashboardAnnotationsDataLayer } from '../scene/DashboardAnnotationsDataLayer';
import { DashboardControls } from '../scene/DashboardControls';
import { DashboardScene, DashboardSceneState } from '../scene/DashboardScene';
import { LibraryVizPanel } from '../scene/LibraryVizPanel';
import { VizPanelLinks, VizPanelLinksMenu } from '../scene/PanelLinks';

import { dashboardSceneGraph, getNextPanelId } from './dashboardSceneGraph';
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

  describe('getVizPanels', () => {
    let scene: DashboardScene;

    beforeEach(async () => {
      scene = buildTestScene();
    });

    it('Should return all panels', () => {
      const vizPanels = dashboardSceneGraph.getVizPanels(scene);

      expect(vizPanels.length).toBe(6);
      expect(vizPanels[0].state.title).toBe('Panel A');
      expect(vizPanels[1].state.title).toBe('Panel B');
      expect(vizPanels[2].state.title).toBe('Panel C');
      expect(vizPanels[3].state.title).toBe('Panel D');
      expect(vizPanels[4].state.title).toBe('Panel E');
      expect(vizPanels[5].state.title).toBe('Panel F');
    });

    it('Should return an empty array when scene has no panels', () => {
      scene.setState({
        body: new SceneGridLayout({ children: [] }),
      });

      const vizPanels = dashboardSceneGraph.getVizPanels(scene);

      expect(vizPanels.length).toBe(0);
    });
  });

  describe('getDataLayers', () => {
    let scene: DashboardScene;

    beforeEach(async () => {
      scene = buildTestScene();
    });

    it('should return the scene data layers', () => {
      const dataLayers = dashboardSceneGraph.getDataLayers(scene);

      expect(dataLayers).toBeInstanceOf(SceneDataLayers);
      expect(dataLayers?.state.layers.length).toBe(2);
    });

    it('should throw if there are no scene data layers', () => {
      scene.setState({
        $data: undefined,
      });

      expect(() => dashboardSceneGraph.getDataLayers(scene)).toThrow('SceneDataLayers not found');
    });
  });

  describe('getNextPanelId', () => {
    it('should get next panel id in a simple 3 panel layout', () => {
      const scene = buildTestScene({
        body: new SceneGridLayout({
          children: [
            new SceneGridItem({
              body: new VizPanel({
                title: 'Panel A',
                key: 'panel-1',
                pluginId: 'table',
              }),
            }),
            new SceneGridItem({
              body: new VizPanel({
                title: 'Panel B',
                key: 'panel-2',
                pluginId: 'table',
              }),
            }),
            new SceneGridItem({
              body: new VizPanel({
                title: 'Panel C',
                key: 'panel-3',
                pluginId: 'table',
              }),
            }),
          ],
        }),
      });

      const id = getNextPanelId(scene);

      expect(id).toBe(4);
    });

    it('should take library panels into account', () => {
      const scene = buildTestScene({
        body: new SceneGridLayout({
          children: [
            new SceneGridItem({
              key: 'griditem-1',
              x: 0,
              body: new VizPanel({
                title: 'Panel A',
                key: 'panel-1',
                pluginId: 'table',
              }),
            }),
            new SceneGridItem({
              body: new LibraryVizPanel({
                uid: 'uid',
                name: 'LibPanel',
                title: 'Library Panel',
                panelKey: 'panel-2',
              }),
            }),
            new SceneGridItem({
              body: new VizPanel({
                title: 'Panel C',
                key: 'panel-2-clone-1',
                pluginId: 'table',
              }),
            }),
            new SceneGridRow({
              key: 'key',
              title: 'row',
              children: [
                new SceneGridItem({
                  body: new VizPanel({
                    title: 'Panel E',
                    key: 'panel-2-clone-2',
                    pluginId: 'table',
                  }),
                }),
                new SceneGridItem({
                  body: new LibraryVizPanel({
                    uid: 'uid',
                    name: 'LibPanel',
                    title: 'Library Panel',
                    panelKey: 'panel-3',
                  }),
                }),
              ],
            }),
          ],
        }),
      });

      const id = getNextPanelId(scene);

      expect(id).toBe(4);
    });

    it('should get next panel id in a layout with rows', () => {
      const scene = buildTestScene();
      const id = getNextPanelId(scene);

      expect(id).toBe(3);
    });

    it('should return 1 if no panels are found', () => {
      const scene = buildTestScene({ body: new SceneGridLayout({ children: [] }) });
      const id = getNextPanelId(scene);

      expect(id).toBe(1);
    });

    it('should throw an error if body is not SceneGridLayout', () => {
      const scene = buildTestScene({ body: undefined });

      expect(() => getNextPanelId(scene)).toThrow('Dashboard body is not a SceneGridLayout');
    });
  });

  describe('getCursorSync', () => {
    it('should return cursor sync behavior', () => {
      const scene = buildTestScene();
      const cursorSync = dashboardSceneGraph.getCursorSync(scene);

      expect(cursorSync).toBeInstanceOf(behaviors.CursorSync);
    });

    it('should return undefined if no cursor sync behavior', () => {
      const scene = buildTestScene({ $behaviors: [] });
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
    $data: new SceneDataLayers({
      layers: [
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
          body: new VizPanel({
            title: 'Panel A',
            key: 'panel-1',
            pluginId: 'table',
            $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
          }),
        }),
        new SceneGridItem({
          body: new VizPanel({
            title: 'Panel B',
            key: 'panel-2',
            pluginId: 'table',
          }),
        }),
        new SceneGridItem({
          body: new VizPanel({
            title: 'Panel C',
            key: 'panel-2-clone-1',
            pluginId: 'table',
            $data: new SceneQueryRunner({ key: 'data-query-runner2', queries: [{ refId: 'A' }] }),
          }),
        }),
        new SceneGridItem({
          body: new VizPanel({
            title: 'Panel D',
            key: 'panel-with-links',
            pluginId: 'table',
            $data: new SceneQueryRunner({ key: 'data-query-runner3', queries: [{ refId: 'A' }] }),
            titleItems: [new VizPanelLinks({ menu: new VizPanelLinksMenu({}) })],
          }),
        }),
        new SceneGridRow({
          key: 'key',
          title: 'row',
          children: [
            new SceneGridItem({
              body: new VizPanel({
                title: 'Panel E',
                key: 'panel-2-clone-2',
                pluginId: 'table',
              }),
            }),
            new SceneGridItem({
              body: new VizPanel({
                title: 'Panel F',
                key: 'panel-2-clone-2',
                pluginId: 'table',
              }),
            }),
          ],
        }),
      ],
    }),
    ...overrides,
  });

  return scene;
}
