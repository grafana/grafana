import { PanelPlugin, PanelPluginMeta, PluginType } from '@grafana/data';
import { SceneGridLayout, VizPanel } from '@grafana/scenes';
import * as libAPI from 'app/features/library-panels/state/api';

import { DashboardGridItem } from '../scene/DashboardGridItem';
import { DashboardScene } from '../scene/DashboardScene';
import { LibraryPanelBehavior } from '../scene/LibraryPanelBehavior';
import { vizPanelToPanel } from '../serialization/transformSceneToSaveModel';
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

      const gridItem = new DashboardGridItem({ body: panel });

      const editScene = buildPanelEditScene(panel);
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

    it('should discard changes when unmounted and discard changes is marked as true', () => {
      pluginToLoad = getTestPanelPlugin({ id: 'text', skipDataQuery: true });

      const panel = new VizPanel({
        key: 'panel-1',
        pluginId: 'text',
      });

      const gridItem = new DashboardGridItem({ body: panel });

      const editScene = buildPanelEditScene(panel);
      const scene = new DashboardScene({
        editPanel: editScene,
        isEditing: true,
        body: new SceneGridLayout({
          children: [gridItem],
        }),
      });

      const deactivate = activateFullSceneTree(scene);

      editScene.state.vizManager.state.panel.setState({ title: 'changed title' });

      editScene.onDiscard();
      deactivate();

      const updatedPanel = gridItem.state.body as VizPanel;
      expect(updatedPanel?.state.title).toBe(panel.state.title);
    });

    it('should discard a newly added panel', () => {
      pluginToLoad = getTestPanelPlugin({ id: 'text', skipDataQuery: true });

      const panel = new VizPanel({
        key: 'panel-1',
        pluginId: 'text',
      });

      const gridItem = new DashboardGridItem({ body: panel });

      const editScene = buildPanelEditScene(panel, true);
      const scene = new DashboardScene({
        editPanel: editScene,
        isEditing: true,
        body: new SceneGridLayout({
          children: [gridItem],
        }),
      });

      editScene.onDiscard();
      const deactivate = activateFullSceneTree(scene);

      deactivate();

      expect((scene.state.body as SceneGridLayout).state.children.length).toBe(0);
    });
  });

  describe('Handling library panels', () => {
    it('should call the api with the updated panel', async () => {
      pluginToLoad = getTestPanelPlugin({ id: 'text', skipDataQuery: true });
      const panel = new VizPanel({
        key: 'panel-1',
        pluginId: 'text',
      });

      const libraryPanelModel = {
        title: 'title',
        uid: 'uid',
        name: 'libraryPanelName',
        model: vizPanelToPanel(panel),
        type: 'panel',
        version: 1,
      };

      const libPanelBehavior = new LibraryPanelBehavior({
        isLoaded: true,
        title: libraryPanelModel.title,
        uid: libraryPanelModel.uid,
        name: libraryPanelModel.name,
        _loadedPanel: libraryPanelModel,
      });

      panel.setState({
        $behaviors: [libPanelBehavior],
      });

      const gridItem = new DashboardGridItem({ body: panel });

      const editScene = buildPanelEditScene(panel);
      const scene = new DashboardScene({
        editPanel: editScene,
        isEditing: true,
        body: new SceneGridLayout({
          children: [gridItem],
        }),
      });

      activateFullSceneTree(scene);

      editScene.state.vizManager.state.panel.setState({ title: 'changed title' });
      (editScene.state.vizManager.state.panel.state.$behaviors![0] as LibraryPanelBehavior).setState({
        name: 'changed name',
      });

      jest.spyOn(libAPI, 'saveLibPanel').mockImplementation(async (panel) => {
        const updatedPanel = { ...libAPI.libraryVizPanelToSaveModel(panel), version: 2 };

        libPanelBehavior.setPanelFromLibPanel(updatedPanel);
      });

      editScene.state.vizManager.commitChanges();

      await new Promise(process.nextTick); // Wait for mock api to return and update the library panel
      expect(libPanelBehavior.state._loadedPanel?.version).toBe(2);
      expect(libPanelBehavior.state.name).toBe('changed name');
      expect(libPanelBehavior.state.title).toBe('changed title');
      expect((gridItem.state.body as VizPanel).state.title).toBe('changed title');
    });
  });

  describe('PanelDataPane', () => {
    it('should not exist if panel is skipDataQuery', () => {
      pluginToLoad = getTestPanelPlugin({ id: 'text', skipDataQuery: true });

      const panel = new VizPanel({
        key: 'panel-1',
        pluginId: 'text',
      });
      new DashboardGridItem({
        body: panel,
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

      new DashboardGridItem({
        body: panel,
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
