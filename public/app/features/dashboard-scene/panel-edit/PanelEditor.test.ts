import { of } from 'rxjs';

import { type DataQueryRequest, type DataSourceApi, LoadingState, type PanelPlugin, store } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { config } from '@grafana/runtime';
import {
  type CancelActivationHandler,
  CustomVariable,
  SceneDataTransformer,
  sceneGraph,
  SceneGridLayout,
  SceneQueryRunner,
  SceneTimeRange,
  SceneVariableSet,
  VizPanel,
} from '@grafana/scenes';
import { mockLogger, setTestFlags } from '@grafana/test-utils/unstable';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';
import * as libAPI from 'app/features/library-panels/state/api';

import { DashboardScene } from '../scene/DashboardScene';
import { LibraryPanelBehavior } from '../scene/LibraryPanelBehavior';
import { UNCONFIGURED_PANEL_PLUGIN_ID } from '../scene/UnconfiguredPanel';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { type Dashboard } from '@grafana/schema';

import { vizPanelToPanel } from '../serialization/transformSceneToSaveModel';
import { activateFullSceneTree } from '../utils/test-utils';
import { findVizPanelByKey, getQueryRunnerFor } from '../utils/utils';

import { PanelDataPane } from './PanelDataPane/PanelDataPane';
import { PanelDataPaneNext } from './PanelEditNext/PanelDataPaneNext';
import { QUERY_EDITOR_V2_PREFERENCE_KEY } from './PanelEditNext/constants';
import { getLocalStorageWithTTL, setLocalStorageWithTTL } from './PanelEditNext/localStorageWithTTL';
import { buildPanelEditScene } from './PanelEditor';

const runRequestMock = jest.fn().mockImplementation((ds: DataSourceApi, request: DataQueryRequest) => {
  return of({
    state: LoadingState.Loading,
    series: [],
    timeRange: request.range,
  });
});

let pluginPromise: Promise<PanelPlugin> | undefined;

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getRunRequest: () => (ds: DataSourceApi, request: DataQueryRequest) => {
    return runRequestMock(ds, request);
  },
  getPluginImportUtils: () => ({
    getPanelPluginFromCache: jest.fn(() => undefined),
    importPanelPlugin: () => pluginPromise,
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

const dataSources = {
  ds1: mockDataSource(
    {
      uid: 'ds1',
      type: DataSourceType.Prometheus,
    },
    { module: 'core:plugin/prometheus' }
  ),
};

setupDataSources(...Object.values(dataSources));

// DatasourceSrv.loadDatasource falls back to instanceSettings.meta when the
// plugin meta lookup misses and logs a warning via logPluginMetaWarning. Register
// a silent logger so the call doesn't surface through console.warn in CI.
mockLogger('grafana/runtime.plugins.meta');

let deactivate: CancelActivationHandler | undefined;

describe('PanelEditor', () => {
  afterEach(() => {
    if (deactivate) {
      deactivate();
      deactivate = undefined;
    }
  });

  describe('When initializing', () => {
    it('should wait for panel plugin to load', async () => {
      const { panelEditor, panel, pluginResolve, dashboard } = await setup({ skipWait: true });

      expect(panel.state.options).toEqual({});
      expect(panelEditor.state.isInitializing).toBe(true);

      const pluginToLoad = getPanelPlugin({ id: 'text' }).setPanelOptions((build) => {
        build.addBooleanSwitch({
          path: 'showHeader',
          name: 'Show header',
          defaultValue: true,
        });
      });

      pluginResolve(pluginToLoad);

      await new Promise((r) => setTimeout(r, 1));

      expect(panelEditor.state.isInitializing).toBe(false);
      expect(panel.state.options).toEqual({ showHeader: true });

      panel.onOptionsChange({ showHeader: false });
      panelEditor.onDiscard();

      const discardedPanel = findVizPanelByKey(dashboard, panel.state.key!)!;
      expect(discardedPanel.state.options).toEqual({ showHeader: true });
    });
  });

  describe('Entering panel edit', () => {
    it('should clear edit pane selection', () => {
      pluginPromise = Promise.resolve(getPanelPlugin({ id: 'text', skipDataQuery: true }));

      const panel = new VizPanel({
        key: 'panel-1',
        pluginId: 'text',
        title: 'original title',
      });
      const gridItem = new DashboardGridItem({ body: panel });
      const panelEditor = buildPanelEditScene(panel);
      const dashboard = new DashboardScene({
        editPanel: panelEditor,
        isEditing: true,
        $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
        body: new DefaultGridLayoutManager({
          grid: new SceneGridLayout({
            children: [gridItem],
          }),
        }),
      });

      dashboard.state.editPane.selectObject(panel, { force: true });
      expect(dashboard.state.editPane.getSelectedObject()).toBe(panel);

      deactivate = activateFullSceneTree(dashboard);

      expect(dashboard.state.editPane.getSelectedObject()).toBeUndefined();
    });
  });

  describe('When discarding', () => {
    it('should discard changes revert all changes', async () => {
      const { panelEditor, panel, dashboard } = await setup();

      panel.setState({ title: 'changed title' });
      panelEditor.onDiscard();

      const discardedPanel = findVizPanelByKey(dashboard, panel.state.key!)!;

      expect(discardedPanel.state.title).toBe('original title');
    });

    it('should discard a newly added panel', async () => {
      const { panelEditor, dashboard } = await setup({ isNewPanel: true });
      panelEditor.onDiscard();

      const panels = dashboard.state.body.getVizPanels();
      expect(panels.length).toBe(0);
    });

    it('should discard query runner changes', async () => {
      const { panelEditor, panel, dashboard } = await setup({});

      const queryRunner = getQueryRunnerFor(panel);
      queryRunner?.setState({ maxDataPoints: 123, queries: [{ refId: 'A' }, { refId: 'B' }] });

      panelEditor.onDiscard();

      const discardedPanel = findVizPanelByKey(dashboard, panel.state.key!)!;
      const restoredQueryRunner = getQueryRunnerFor(discardedPanel);
      expect(restoredQueryRunner?.state.maxDataPoints).toBe(500);
      expect(restoredQueryRunner?.state.queries.length).toBe(1);
    });
  });

  describe('When changes are made', () => {
    it('Should set state to dirty', async () => {
      const { panelEditor, panel } = await setup({});

      expect(panelEditor.state.isDirty).toBe(undefined);

      panel.setState({ title: 'changed title' });

      expect(panelEditor.state.isDirty).toBe(true);
    });

    it('Should reset dirty and orginal state when dashboard is saved', async () => {
      const { panelEditor, panel } = await setup({});

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

  describe('When panel has pre-existing unsaved changes (e.g. styles pasted from dashboard view)', () => {
    it('Should set isDirty to true immediately when entering panel edit', async () => {
      const { panelEditor } = await setupWithPreExistingStyleChanges();
      expect(panelEditor.state.isDirty).toBe(true);
    });

    it('Should not set isDirty when panel has no pre-existing changes', async () => {
      const { panelEditor } = await setup({});
      // No paste, so isDirty should remain undefined (not set)
      expect(panelEditor.state.isDirty).toBe(undefined);
    });

    it('Should revert pasted fieldConfig when discarding panel changes', async () => {
      const originalFieldConfig = { defaults: { color: { mode: 'fixed' } }, overrides: [] };
      const { panelEditor, panel, dashboard } = await setupWithPreExistingStyleChanges({ originalFieldConfig });

      expect(panelEditor.state.isDirty).toBe(true);

      panelEditor.onDiscard();

      const discardedPanel = findVizPanelByKey(dashboard, panel.state.key!)!;
      expect(discardedPanel.state.fieldConfig).toEqual(originalFieldConfig);
    });

    it('Should track further changes relative to the initial (saved) state after entering panel edit', async () => {
      const originalFieldConfig = { defaults: { color: { mode: 'fixed' } }, overrides: [] };
      const { panelEditor, panel } = await setupWithPreExistingStyleChanges({ originalFieldConfig });

      expect(panelEditor.state.isDirty).toBe(true);

      // Restoring to the original fieldConfig via setState (same path as how the original was captured)
      // should make the panel no longer dirty.
      panel.setState({ fieldConfig: originalFieldConfig });
      expect(panelEditor.state.isDirty).toBe(false);
    });
  });

  describe('When opening a repeated panel', () => {
    it('Should default to the first variable value if panel is repeated', async () => {
      const { panel } = await setup({ repeatByVariable: 'server' });
      const variable = sceneGraph.lookupVariable('server', panel);
      expect(variable?.getValue()).toBe('A');
    });
  });

  describe('Handling library panels', () => {
    it('should call the api with the updated panel', async () => {
      pluginPromise = Promise.resolve(getPanelPlugin({ id: 'text', skipDataQuery: true }));

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
        uid: libraryPanelModel.uid,
        name: libraryPanelModel.name,
        _loadedPanel: libraryPanelModel,
      });

      panel.setState({ $behaviors: [libPanelBehavior] });

      const gridItem = new DashboardGridItem({ body: panel });
      const editScene = buildPanelEditScene(panel);
      const scene = new DashboardScene({
        editPanel: editScene,
        $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
        isEditing: true,
        body: new DefaultGridLayoutManager({
          grid: new SceneGridLayout({
            children: [gridItem],
          }),
        }),
      });

      activateFullSceneTree(scene);

      await new Promise((r) => setTimeout(r, 1));

      panel.setState({ title: 'changed title' });
      libPanelBehavior.setState({ name: 'changed name' });

      jest.spyOn(libAPI, 'saveLibPanel').mockImplementation(async (panel) => {
        const updatedPanel = { ...libAPI.libraryVizPanelToSaveModel(panel), version: 2 };
        libPanelBehavior.setPanelFromLibPanel(updatedPanel);
      });

      editScene.onConfirmSaveLibraryPanel();
      await new Promise(process.nextTick);

      // Wait for mock api to return and update the library panel
      expect(libPanelBehavior.state._loadedPanel?.version).toBe(2);
      expect(libPanelBehavior.state.name).toBe('changed name');
      expect(panel.state.title).toBe('changed title');
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
        uid: libraryPanelModel.uid,
        name: libraryPanelModel.name,
        _loadedPanel: libraryPanelModel,
      });

      // Just adding an extra stateless behavior to verify unlinking does not remvoe it
      const otherBehavior = jest.fn();
      const panel = new VizPanel({ key: 'panel-1', pluginId: 'text', $behaviors: [libPanelBehavior, otherBehavior] });
      new DashboardGridItem({ body: panel });

      const editScene = buildPanelEditScene(panel);
      editScene.onConfirmUnlinkLibraryPanel();

      expect(panel.state.$behaviors?.length).toBe(1);
      expect(panel.state.$behaviors![0]).toBe(otherBehavior);
    });
  });

  describe('PanelDataPane', () => {
    it('should not exist if panel is skipDataQuery', async () => {
      const { panelEditor, panel } = await setup({ pluginSkipDataQuery: true });
      expect(panelEditor.state.dataPane).toBeUndefined();

      expect(panel.state.$data).toBeUndefined();
    });

    it('should exist if panel is supporting querying', async () => {
      const { panelEditor, panel } = await setup({ pluginSkipDataQuery: false });
      expect(panelEditor.state.dataPane).toBeDefined();

      expect(panel.state.$data).toBeDefined();
    });
  });

  describe('Query editor version toggle', () => {
    describe('when queryEditorNext feature toggle is enabled', () => {
      beforeEach(() => {
        store.delete(QUERY_EDITOR_V2_PREFERENCE_KEY);
        setTestFlags({ queryEditorNext: true });
      });

      afterEach(() => {
        store.delete(QUERY_EDITOR_V2_PREFERENCE_KEY);
        setTestFlags({});
      });

      it('should use the v2 query editor experience by default', async () => {
        const { panelEditor } = await setup({ pluginSkipDataQuery: false });

        expect(panelEditor.state.dataPane).toBeInstanceOf(PanelDataPaneNext);
      });

      it('should switch to v1 query editor experience when toggled off', async () => {
        const { panelEditor } = await setup({ pluginSkipDataQuery: false });

        panelEditor.onToggleQueryEditorVersion();

        expect(panelEditor.state.dataPane).toBeInstanceOf(PanelDataPane);
      });

      it('should switch back to v2 query editor experience when toggled on again', async () => {
        const { panelEditor } = await setup({ pluginSkipDataQuery: false });

        panelEditor.onToggleQueryEditorVersion(); // v2 -> v1
        panelEditor.onToggleQueryEditorVersion(); // v1 -> v2

        expect(panelEditor.state.dataPane).toBeInstanceOf(PanelDataPaneNext);
      });

      it('should use v2 when stored preference is true', async () => {
        setLocalStorageWithTTL(QUERY_EDITOR_V2_PREFERENCE_KEY, true);
        const { panelEditor } = await setup({ pluginSkipDataQuery: false });

        expect(panelEditor.state.dataPane).toBeInstanceOf(PanelDataPaneNext);
      });

      it('should use v1 when stored preference is false (user downgraded)', async () => {
        setLocalStorageWithTTL(QUERY_EDITOR_V2_PREFERENCE_KEY, false);
        const { panelEditor } = await setup({ pluginSkipDataQuery: false });

        expect(panelEditor.state.dataPane).toBeInstanceOf(PanelDataPane);
      });

      it('should persist the preference to local storage when toggled', async () => {
        const { panelEditor } = await setup({ pluginSkipDataQuery: false });

        panelEditor.onToggleQueryEditorVersion(); // v2 -> v1
        expect(getLocalStorageWithTTL<boolean>(QUERY_EDITOR_V2_PREFERENCE_KEY)).toBe(false);

        panelEditor.onToggleQueryEditorVersion(); // v1 -> v2
        expect(getLocalStorageWithTTL<boolean>(QUERY_EDITOR_V2_PREFERENCE_KEY)).toBe(true);
      });
    });

    describe('when queryEditorNext feature toggle is disabled', () => {
      beforeEach(() => {
        setTestFlags({});
      });

      afterEach(() => {
        store.delete(QUERY_EDITOR_V2_PREFERENCE_KEY);
      });

      it('should use the v1 query editor experience', async () => {
        const { panelEditor } = await setup({ pluginSkipDataQuery: false });

        expect(panelEditor.state.dataPane).toBeInstanceOf(PanelDataPane);
      });

      it('should ignore a stored v2 preference and use the v1 query editor experience', async () => {
        setLocalStorageWithTTL(QUERY_EDITOR_V2_PREFERENCE_KEY, true);

        const { panelEditor } = await setup({ pluginSkipDataQuery: false });

        expect(panelEditor.state.dataPane).toBeInstanceOf(PanelDataPane);
      });
    });
  });
  describe('isVizPickerOpen', () => {
    it('should not auto-open viz picker for new panels when newVizSuggestions=false', async () => {
      config.featureToggles.newVizSuggestions = false;
      const { panelEditor } = await setup({ isNewPanel: true });
      const optionsPane = panelEditor.state.optionsPane;
      expect(optionsPane?.state.isVizPickerOpen).toBe(false);
    });

    it('should auto-open viz picker for new panels when newVizSuggestions=true', async () => {
      config.featureToggles.newVizSuggestions = true;
      const { panelEditor } = await setup({ isNewPanel: true, pluginId: UNCONFIGURED_PANEL_PLUGIN_ID });
      const optionsPane = panelEditor.state.optionsPane;
      expect(optionsPane?.state.isVizPickerOpen).toBe(true);
    });
  });
});

interface SetupOptions {
  isNewPanel?: boolean;
  pluginId?: string;
  pluginSkipDataQuery?: boolean;
  repeatByVariable?: string;
  skipWait?: boolean;
  pluginLoadTime?: number;
}

async function setup(options: SetupOptions = {}) {
  const panelPluginId = options.pluginId ?? 'text';
  const pluginToLoad = getPanelPlugin({ id: panelPluginId, skipDataQuery: options.pluginSkipDataQuery });
  let pluginResolve = (plugin: PanelPlugin) => {};

  pluginPromise = new Promise<PanelPlugin>((resolve) => {
    pluginResolve = resolve;
  });

  const panel = new VizPanel({
    key: 'panel-1',
    pluginId: panelPluginId,
    title: 'original title',
    $data: new SceneDataTransformer({
      transformations: [],
      $data: new SceneQueryRunner({
        queries: [{ refId: 'A' }],
        maxDataPoints: 500,
        datasource: { uid: 'ds1' },
      }),
    }),
  });

  const gridItem = new DashboardGridItem({ body: panel, variableName: options.repeatByVariable });

  const panelEditor = buildPanelEditScene(panel, options.isNewPanel);
  const dashboard = new DashboardScene({
    editPanel: panelEditor,
    isEditing: true,
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    $variables: new SceneVariableSet({
      variables: [
        new CustomVariable({
          name: 'server',
          query: 'A,B,C',
          isMulti: true,
          value: ['A', 'B', 'C'],
          text: ['A', 'B', 'C'],
        }),
      ],
    }),
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: [gridItem],
      }),
    }),
  });

  panelEditor.debounceSaveModelDiff = false;

  deactivate = activateFullSceneTree(dashboard);

  if (!options.skipWait) {
    //console.log('pluginResolve(pluginToLoad)');
    pluginResolve(pluginToLoad);
    await new Promise((r) => setTimeout(r, 1));
  }

  return { dashboard, panel, gridItem, panelEditor, pluginResolve };
}

interface SetupWithPreExistingStyleChangesOptions {
  originalFieldConfig?: { defaults: Record<string, unknown>; overrides: unknown[] };
}

/**
 * Sets up a panel editor scenario where styles were pasted from dashboard view
 * before entering panel edit. This simulates the bug where the discard button
 * is disabled even though the panel has unsaved changes.
 */
async function setupWithPreExistingStyleChanges(options: SetupWithPreExistingStyleChangesOptions = {}) {
  const originalFieldConfig = options.originalFieldConfig ?? { defaults: { color: { mode: 'palette-classic' } }, overrides: [] };
  const pastedFieldConfig = { defaults: { color: { mode: 'fixed' }, custom: { lineWidth: 3 } }, overrides: [] };

  const pluginToLoad = getPanelPlugin({ id: 'timeseries', skipDataQuery: false });
  pluginPromise = Promise.resolve(pluginToLoad);

  // Create the panel with original fieldConfig
  const panel = new VizPanel({
    key: 'panel-1',
    pluginId: 'timeseries',
    title: 'original title',
    fieldConfig: originalFieldConfig,
    $data: new SceneDataTransformer({
      transformations: [],
      $data: new SceneQueryRunner({
        queries: [{ refId: 'A' }],
        maxDataPoints: 500,
        datasource: { uid: 'ds1' },
      }),
    }),
  });

  const gridItem = new DashboardGridItem({ body: panel });

  const dashboard = new DashboardScene({
    isEditing: true,
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: [gridItem],
      }),
    }),
  });

  // Set the initial save model to represent what was last saved (with the original fieldConfig)
  const initialSaveModel: Dashboard = {
    schemaVersion: 36,
    title: 'test dashboard',
    panels: [
      {
        id: 1,
        type: 'timeseries',
        title: 'original title',
        fieldConfig: originalFieldConfig as Dashboard['panels'][0]['fieldConfig'],
        options: {},
        targets: [{ refId: 'A', datasource: { uid: 'ds1' } }],
        datasource: { uid: 'ds1' },
        gridPos: { x: 0, y: 0, h: 8, w: 12 },
      },
    ],
  };
  dashboard.setInitialSaveModel(initialSaveModel);

  // Simulate paste styles from dashboard view (before entering panel edit).
  // Use setState directly because onFieldConfigChange requires the panel plugin to be loaded,
  // which is not the case when pasting from dashboard view (mirrors how DashboardScene.pastePanelStyles works).
  panel.setState({ fieldConfig: pastedFieldConfig });

  // Now enter panel edit (AFTER the paste — this is the bug scenario)
  const panelEditor = buildPanelEditScene(panel);
  dashboard.setState({ editPanel: panelEditor });

  panelEditor.debounceSaveModelDiff = false;
  deactivate = activateFullSceneTree(dashboard);
  await new Promise((r) => setTimeout(r, 1));

  return { dashboard, panel, gridItem, panelEditor };
}
