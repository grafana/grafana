import { p } from 'msw/lib/core/GraphQLHandler-UgnlXhlx';

import { PanelPlugin, PanelPluginMeta, PluginType } from '@grafana/data';
import { CancelActivationHandler, SceneGridLayout, VizPanel } from '@grafana/scenes';
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

let deactivate: CancelActivationHandler | undefined;

describe('PanelEditor', () => {
  afterEach(() => {
    if (deactivate) {
      deactivate();
      deactivate = undefined;
    }
  });

  describe('When closing editor', () => {
    it('should discard changes revert all changes', () => {
      const { panelEditor, panel } = setup();

      panel.setState({ title: 'changed title' });
      panelEditor.onDiscard();

      expect(panel.state.title).toBe('original title');
    });

    it('should discard a newly added panel', () => {
      const { panelEditor, scene } = setup({ isNewPanel: true });
      panelEditor.onDiscard();

      expect((scene.state.body as SceneGridLayout).state.children.length).toBe(0);
    });
  });

  describe('When changes are made', () => {
    it('Should set state to dirty', () => {
      const { panelEditor, panel } = setup({});

      expect(panelEditor.state.isDirty).toBe(undefined);

      panel.setState({ title: 'changed title' });

      expect(panelEditor.state.isDirty).toBe(true);
    });

    it('Should reset dirty and orginal state when dashboard is saved', () => {
      const { panelEditor, panel } = setup({});

      expect(panelEditor.state.isDirty).toBe(undefined);

      panel.setState({ title: 'changed title' });

      panelEditor.dashboardSaved();

      expect(panelEditor.state.isDirty).toBe(false);

      panel.setState({ title: 'changed title 2' });

      expect(panelEditor.state.isDirty).toBe(true);

      // Change back to already saved state
      panel.setState({ title: 'changed title' });
      expect(panelEditor.state.isDirty).toBe(false);
    });
  });

  describe('Handling library panels', () => {
    it('should call the api with the updated panel', async () => {
      pluginToLoad = getTestPanelPlugin({ id: 'text', skipDataQuery: true });

      const panel = new VizPanel({ key: 'panel-1', pluginId: 'text' });

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

      panel.setState({ $behaviors: [libPanelBehavior] });

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

      panel.setState({ title: 'changed title' });
      libPanelBehavior.setState({ name: 'changed name' });

      jest.spyOn(libAPI, 'saveLibPanel').mockImplementation(async (panel) => {
        const updatedPanel = { ...libAPI.libraryVizPanelToSaveModel(panel), version: 2 };
        libPanelBehavior.setPanelFromLibPanel(updatedPanel);
      });

      editScene.onConfirmSaveLibraryPanel();

      await new Promise(process.nextTick); // Wait for mock api to return and update the library panel
      expect(libPanelBehavior.state._loadedPanel?.version).toBe(2);
      expect(libPanelBehavior.state.name).toBe('changed name');
      expect(libPanelBehavior.state.title).toBe('changed title');
      expect((gridItem.state.body as VizPanel).state.title).toBe('changed title');
    });

    it('unlinks library panel', () => {
      const libraryPanelModel = {
        title: 'title',
        uid: 'uid',
        name: 'libraryPanelName',
        model: {
          title: 'title',
          type: 'text',
        },
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

      // Just adding an extra stateless behavior to verify unlinking does not remvoe it
      const otherBehavior = jest.fn();
      const panel = new VizPanel({ key: 'panel-1', pluginId: 'text', $behaviors: [libPanelBehavior, otherBehavior] });
      const editScene = buildPanelEditScene(panel);
      editScene.onConfirmUnlinkLibraryPanel();

      expect(panel.state.$behaviors?.length).toBe(1);
      expect(panel.state.$behaviors![0]).toBe(otherBehavior);
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

interface SetupOptions {
  isNewPanel?: boolean;
}

function setup(options: SetupOptions = {}) {
  pluginToLoad = getTestPanelPlugin({ id: 'text', skipDataQuery: true });

  const panel = new VizPanel({ key: 'panel-1', pluginId: 'text', title: 'original title' });
  const gridItem = new DashboardGridItem({ body: panel });
  const panelEditor = buildPanelEditScene(panel, options.isNewPanel);
  const dashboard = new DashboardScene({
    editPanel: panelEditor,
    isEditing: true,
    body: new SceneGridLayout({
      children: [gridItem],
    }),
  });

  panelEditor.debounceSaveModelDiff = false;

  deactivate = activateFullSceneTree(dashboard);

  return { scene: dashboard, panel, gridItem, panelEditor };
}
