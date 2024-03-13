import { PanelPlugin, PanelPluginMeta, PluginType } from '@grafana/data';
import { SceneGridItem, SceneGridLayout, VizPanel } from '@grafana/scenes';
import * as libAPI from 'app/features/library-panels/state/api';

import { DashboardScene } from '../scene/DashboardScene';
import { LibraryVizPanel } from '../scene/LibraryVizPanel';
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

      const libraryPanel = new LibraryVizPanel({
        isLoaded: true,
        title: libraryPanelModel.title,
        uid: libraryPanelModel.uid,
        name: libraryPanelModel.name,
        panelKey: panel.state.key!,
        panel: panel,
        _loadedPanel: libraryPanelModel,
      });

      const apiCall = jest
        .spyOn(libAPI, 'updateLibraryVizPanel')
        .mockResolvedValue({ type: 'panel', ...libAPI.libraryVizPanelToSaveModel(libraryPanel), version: 2 });

      const editScene = buildPanelEditScene(panel);
      const gridItem = new SceneGridItem({ body: libraryPanel });
      const scene = new DashboardScene({
        editPanel: editScene,
        isEditing: true,
        body: new SceneGridLayout({
          children: [gridItem],
        }),
      });

      activateFullSceneTree(scene);

      editScene.state.vizManager.state.panel.setState({ title: 'changed title' });
      (editScene.state.vizManager.state.sourcePanel.resolve().parent as LibraryVizPanel).setState({
        name: 'changed name',
      });
      editScene.state.vizManager.commitChanges();

      const calledWith = apiCall.mock.calls[0][0].state;
      expect(calledWith.panel?.state.title).toBe('changed title');
      expect(calledWith.name).toBe('changed name');

      await new Promise(process.nextTick); // Wait for mock api to return and update the library panel
      expect((gridItem.state.body as LibraryVizPanel).state._loadedPanel?.version).toBe(2);
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
