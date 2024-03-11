import { PanelPlugin, PanelPluginMeta, PluginType } from '@grafana/data';
import { SceneGridItem, SceneGridLayout, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { activateFullSceneTree } from '../utils/test-utils';

import { buildPanelEditScene } from './PanelEditor';

let pluginToLoad: PanelPlugin | undefined;
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getPluginImportUtils: () => ({
    getPanelPluginFromCache: jest.fn(() => pluginToLoad),
  }),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    panels: {
      text: {
        skipDataQuery: true,
      },
      timeseries: {
        skipDataQuery: false,
      },
    },
  },
}));

describe('PanelEditor', () => {
  describe('When closing editor', () => {
    it('should apply changes automatically', () => {
      pluginToLoad = getTestPanelPlugin({ id: 'text', skipDataQuery: true });

      const panel = new VizPanel({
        key: 'panel-1',
        pluginId: 'text',
      });

      const editScene = buildPanelEditScene(panel);
      const gridItem = new SceneGridItem({ body: panel });
      const scene = new DashboardScene({
        editPanel: editScene,
        isEditing: true,
        body: new SceneGridLayout({
          children: [gridItem],
        }),
      });

      const deactivate = activateFullSceneTree(scene);

      editScene.state.vizManager.state.panel.setState({ title: 'changed title' });

      deactivate();

      const updatedPanel = gridItem.state.body as VizPanel;
      expect(updatedPanel?.state.title).toBe('changed title');
    });
  });

  describe('PanelDataPane', () => {
    it('should not exist if panel is skipDataQuery', () => {
      pluginToLoad = getTestPanelPlugin({ id: 'text', skipDataQuery: true });

      const panel = new VizPanel({
        key: 'panel-1',
        pluginId: 'text',
      });
      const editScene = buildPanelEditScene(panel);
      const scene = new DashboardScene({
        editPanel: editScene,
      });

      activateFullSceneTree(scene);

      expect(editScene.state.dataPane).toBeUndefined();
    });

    it('should exist if panel is supporting querying', () => {
      pluginToLoad = getTestPanelPlugin({ id: 'timeseries' });

      const panel = new VizPanel({
        key: 'panel-1',
        pluginId: 'timeseries',
      });
      const editScene = buildPanelEditScene(panel);
      const scene = new DashboardScene({
        editPanel: editScene,
      });

      activateFullSceneTree(scene);
      expect(editScene.state.dataPane).toBeDefined();
    });
  });
});

export function getTestPanelPlugin(options: Partial<PanelPluginMeta>): PanelPlugin {
  const plugin = new PanelPlugin(() => null);
  plugin.meta = {
    id: options.id!,
    type: PluginType.panel,
    name: options.id!,
    sort: options.sort || 1,
    info: {
      author: {
        name: options.id + 'name',
      },
      description: '',
      links: [],
      logos: {
        large: '',
        small: '',
      },
      screenshots: [],
      updated: '',
      version: '1.0.',
    },
    hideFromList: options.hideFromList === true,
    module: options.module ?? '',
    baseUrl: '',
    skipDataQuery: options.skipDataQuery ?? false,
  };
  return plugin;
}
