import { SceneGridItem, SceneGridLayout, SceneGridRow, SceneTimeRange, VizPanel } from '@grafana/scenes';

import { DashboardControls } from '../scene/DashboardControls';
import { DashboardScene, DashboardSceneState } from '../scene/DashboardScene';
import { LibraryVizPanel } from '../scene/LibraryVizPanel';

import { getNextPanelId } from './utils';

describe('utils', () => {
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
                key: 'panel-2',
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
                    key: '3',
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

      expect(id).toBe(4);
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
});

function buildTestScene(overrides?: Partial<DashboardSceneState>) {
  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    $timeRange: new SceneTimeRange({}),
    controls: new DashboardControls({}),
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
        new SceneGridRow({
          key: 'key',
          title: 'row',
          children: [
            new SceneGridItem({
              body: new VizPanel({
                title: 'Panel G',
                key: 'panel-3',
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
