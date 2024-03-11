import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneGridItem, SceneGridLayout, SceneTimeRange, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { activateFullSceneTree } from '../utils/test-utils';

import { PermissionsEditView } from './PermissionsEditView';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

describe('PermissionsEditView', () => {
  describe('Dashboard permissions state', () => {
    let dashboard: DashboardScene;
    let permissionsView: PermissionsEditView;

    beforeEach(async () => {
      const result = await buildTestScene();
      dashboard = result.dashboard;
      permissionsView = result.permissionsView;
    });

    it('should return the correct urlKey', () => {
      expect(permissionsView.getUrlKey()).toBe('permissions');
    });

    it('should return the dashboard', () => {
      expect(permissionsView.getDashboard()).toBe(dashboard);
    });
  });
});

async function buildTestScene() {
  const permissionsView = new PermissionsEditView({});
  const dashboard = new DashboardScene({
    $timeRange: new SceneTimeRange({}),
    title: 'hello',
    uid: 'dash-1',
    version: 4,
    meta: {
      canEdit: true,
    },
    body: new SceneGridLayout({
      children: [
        new SceneGridItem({
          key: 'griditem-1',
          x: 0,
          y: 0,
          width: 10,
          height: 12,
          body: new VizPanel({
            title: 'Panel A',
            key: 'panel-1',
            pluginId: 'table',
          }),
        }),
      ],
    }),
    editview: permissionsView,
  });

  activateFullSceneTree(dashboard);

  await new Promise((r) => setTimeout(r, 1));

  dashboard.onEnterEditMode();
  permissionsView.activate();

  return { dashboard, permissionsView };
}
