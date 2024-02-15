import {
  SceneDataLayers,
  SceneGridItem,
  SceneGridLayout,
  SceneGridRow,
  SceneQueryRunner,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  VizPanel,
} from '@grafana/scenes';

import { AlertStatesDataLayer } from '../scene/AlertStatesDataLayer';
import { DashboardAnnotationsDataLayer } from '../scene/DashboardAnnotationsDataLayer';
import { DashboardControls } from '../scene/DashboardControls';
import { DashboardLinksControls } from '../scene/DashboardLinksControls';
import { DashboardScene, DashboardSceneState } from '../scene/DashboardScene';
import { VizPanelLinks, VizPanelLinksMenu } from '../scene/PanelLinks';

import { dashboardSceneGraph } from './dashboardSceneGraph';
import { findVizPanelByKey } from './utils';

describe('dashboardSceneGraph', () => {
  describe('getTimePicker', () => {
    it('should return null if no time picker', () => {
      const scene = buildTestScene({
        controls: [
          new DashboardControls({
            variableControls: [],
            linkControls: new DashboardLinksControls({}),
            timeControls: [],
          }),
        ],
      });

      const timePicker = dashboardSceneGraph.getTimePicker(scene);
      expect(timePicker).toBeNull();
    });

    it('should return time picker', () => {
      const scene = buildTestScene();
      const timePicker = dashboardSceneGraph.getTimePicker(scene);
      expect(timePicker).not.toBeNull();
    });
  });

  describe('getRefreshPicker', () => {
    it('should return null if no refresh picker', () => {
      const scene = buildTestScene({
        controls: [
          new DashboardControls({
            variableControls: [],
            linkControls: new DashboardLinksControls({}),
            timeControls: [],
          }),
        ],
      });

      const refreshPicker = dashboardSceneGraph.getRefreshPicker(scene);
      expect(refreshPicker).toBeNull();
    });

    it('should return refresh picker', () => {
      const scene = buildTestScene();
      const refreshPicker = dashboardSceneGraph.getRefreshPicker(scene);
      expect(refreshPicker).not.toBeNull();
    });
  });

  describe('getDashboardControls', () => {
    it('should return null if no dashboard controls', () => {
      const scene = buildTestScene({ controls: [] });

      const dashboardControls = dashboardSceneGraph.getDashboardControls(scene);
      expect(dashboardControls).toBeNull();
    });

    it('should return dashboard controls', () => {
      const scene = buildTestScene();
      const dashboardControls = dashboardSceneGraph.getDashboardControls(scene);
      expect(dashboardControls).not.toBeNull();
    });
  });

  describe('getPanelLinks', () => {
    it('should throw if no links object defined', () => {
      const scene = buildTestScene();
      const panelWithNoLinks = findVizPanelByKey(scene, 'panel-1')!;
      expect(() => dashboardSceneGraph.getPanelLinks(panelWithNoLinks)).toThrow();
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
});

function buildTestScene(overrides?: Partial<DashboardSceneState>) {
  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    $timeRange: new SceneTimeRange({}),
    controls: [
      new DashboardControls({
        variableControls: [],
        linkControls: new DashboardLinksControls({}),
        timeControls: [
          new SceneTimePicker({}),
          new SceneRefreshPicker({
            intervals: ['1s'],
          }),
        ],
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
