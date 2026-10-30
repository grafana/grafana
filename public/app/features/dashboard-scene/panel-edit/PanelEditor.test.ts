import { act, screen } from '@testing-library/react';
import { createElement, Fragment } from 'react';
import { of } from 'rxjs';
import { render } from 'test/test-utils';

import {
  type DataQueryRequest,
  type DataSourceApi,
  type DataTransformerConfig,
  LoadingState,
  type PanelPlugin,
  store,
  standardTransformersRegistry,
} from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import {
  type CancelActivationHandler,
  CustomVariable,
  SceneDataNode,
  SceneDataTransformer,
  sceneGraph,
  SceneGridLayout,
  SceneQueryRunner,
  SceneTimeRange,
  SceneVariableSet,
  VizPanel,
} from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';
import * as libAPI from 'app/features/library-panels/state/api';
import { TABLE_TRANSFORMATIONS_OWNER } from 'app/features/table/hooks';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';
import { dispatch } from 'app/store/store';

import { edit } from '../actions/utils/edit';
import { DashboardScene } from '../scene/DashboardScene';
import { LibraryPanelBehavior } from '../scene/LibraryPanelBehavior';
import { UNCONFIGURED_PANEL_PLUGIN_ID } from '../scene/UnconfiguredPanel';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { setupPanelNotices } from '../scene/setupPanelNotices';
import { vizPanelToPanel } from '../serialization/transformSceneToSaveModel';
import { findVizPanelByKey } from '../utils/findVizPanel';
import { getQueryRunnerFor } from '../utils/getQueryRunnerFor';
import { activateFullSceneTree } from '../utils/test-utils';
import { getLibraryPanelBehavior } from '../utils/utils';

import { PanelDataPane } from './PanelDataPane/PanelDataPane';
import { PanelDataTransformationsTab } from './PanelDataPane/PanelDataTransformationsTab';
import { PanelDataPaneNext } from './PanelEditNext/PanelDataPaneNext';
import { usePanelContext, useQueryEditorUIContext } from './PanelEditNext/QueryEditor/QueryEditorContext';
import { QueryEditorContextWrapper } from './PanelEditNext/QueryEditor/QueryEditorContextWrapper';
import { TransformationEditorRenderer } from './PanelEditNext/QueryEditor/TransformationEditorRenderer';
import { QUERY_EDITOR_V2_PREFERENCE_KEY } from './PanelEditNext/constants';
import { getLocalStorageWithTTL, setLocalStorageWithTTL } from './PanelEditNext/localStorageWithTTL';
import { PanelEditPanelWrapper } from './PanelEditPanelWrapper';
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

jest.mock('app/store/store', () => ({
  ...jest.requireActual('app/store/store'),
  dispatch: jest.fn(),
}));

let deactivate: CancelActivationHandler | undefined;

describe('PanelEditor', () => {
  beforeAll(() => standardTransformersRegistry.setInit(getStandardTransformers));
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
    beforeEach(() => jest.mocked(dispatch).mockClear());

    it('applies panel options and tracks changes after the preview layout item remounts', async () => {
      const { panelEditor, panel, gridItem, deactivatePanel } = await setup({ activateFullTree: false });
      let observedDisplayMode = panel.state.displayMode;
      const subscription = panel.subscribeToState((state) => {
        observedDisplayMode = state.displayMode;
      });

      const unmountPreview = gridItem.activate();
      unmountPreview();
      deactivatePanel!();
      const unmountRemountedPreview = gridItem.activate();
      const unmountRemountedPanel = panel.activate();

      try {
        edit({
          meta: { actionId: 'panel.changeBackground' },
          source: panel,
          description: 'Change panel background',
          perform: () => panel.setState({ displayMode: 'transparent' }),
          undo: () => panel.setState({ displayMode: 'default' }),
        });

        expect(panel.state.displayMode).toBe('transparent');
        expect(observedDisplayMode).toBe('transparent');
        expect(panelEditor.state.isDirty).toBe(true);
      } finally {
        subscription.unsubscribe();
        unmountRemountedPanel();
        unmountRemountedPreview();
      }

      deactivate!();
      deactivate = undefined;
      expect(gridItem.isActive).toBe(false);
      expect(panel.isActive).toBe(false);
    });

    it('keeps a replacement data provider active until editing ends', async () => {
      const { panelEditor, panel, deactivatePanel } = await setup({
        activateFullTree: false,
        pluginSkipDataQuery: false,
      });
      const original = panel.state.$data!;
      const replacement = new SceneDataNode({
        data: { state: LoadingState.Done, series: [], timeRange: sceneGraph.getTimeRange(panel).state.value },
      });
      const releasePreviewProvider = replacement.activate();

      panel.setState({ $data: replacement });
      releasePreviewProvider();
      deactivatePanel!();

      expect(original.isActive).toBe(false);
      expect(replacement.isActive).toBe(true);
      expect(panelEditor.isActive).toBe(true);

      deactivate!();
      deactivate = undefined;
      expect(replacement.isActive).toBe(false);
    });

    it('pauses ad hoc table transformations and restores them on exit', async () => {
      const transformations: DataTransformerConfig[] = [{ id: 'organize', options: { indexByName: { B: 0, A: 1 } } }];
      const { panel } = await setup({ pluginId: 'table', initialTableTransformations: transformations });

      expect(panel.getRuntimeTransformations().get(TABLE_TRANSFORMATIONS_OWNER)).toEqual([]);
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            title: 'Ad hoc transformations are disabled in edit mode',
          }),
        })
      );

      deactivate!();
      deactivate = undefined;
      expect(panel.getRuntimeTransformations().get(TABLE_TRANSFORMATIONS_OWNER)).toEqual(transformations);
    });

    it('does not notify when the table has no ad hoc transformations', async () => {
      const { panel } = await setup({ pluginId: 'table' });

      expect(panel.getRuntimeTransformations().get(TABLE_TRANSFORMATIONS_OWNER)).toEqual([]);
      expect(dispatch).not.toHaveBeenCalled();
    });

    it('should clear sidebar selection', () => {
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

      dashboard.state.sidebar.selectObject(panel, { force: true });
      expect(dashboard.state.sidebar.getSelectedObject()).toBe(panel);

      deactivate = activateFullSceneTree(dashboard);

      expect(dashboard.state.sidebar.getSelectedObject()).toBeUndefined();
    });
  });

  describe.each([
    { useNext: false, noticesFirst: false },
    { useNext: true, noticesFirst: false },
    { useNext: false, noticesFirst: true },
    { useNext: true, noticesFirst: true },
  ])(
    'transformation editing with queryEditorNext=$useNext and noticesFirst=$noticesFirst',
    ({ useNext, noticesFirst }) => {
      beforeEach(() => {
        setTestFlags({ queryEditorNext: useNext });
        setLocalStorageWithTTL(QUERY_EDITOR_V2_PREFERENCE_KEY, useNext);
      });

      afterEach(() => {
        setTestFlags({});
        store.delete(QUERY_EDITOR_V2_PREFERENCE_KEY);
      });

      it('keeps format edits synchronized after preview remounts and Table View changes', async () => {
        const { dashboard, panelEditor, panel, gridItem, deactivatePanel, deactivateNotices } = await setup({
          activateFullTree: false,
          pluginSkipDataQuery: false,
          activateNoticesFirst: noticesFirst,
        });
        const transformer = panel.state.$data as SceneDataTransformer;
        const queryRunner = getQueryRunnerFor(panel)!;
        const dataPane = panelEditor.state.dataPane!;
        transformer.setState({ transformations: [{ id: 'formatTime', options: { outputFormat: '' } }] });

        let preview = render(createElement(PanelEditPanelWrapper, { panel, dashboard }));
        act(() => {
          deactivatePanel!();
          deactivateNotices?.();
        });
        const data = { state: LoadingState.Done, series: [], timeRange: sceneGraph.getTimeRange(panel).state.value };
        act(() => {
          queryRunner.setState({ data });
          transformer.setState({ data });
        });
        const editor = render(
          dataPane instanceof PanelDataPaneNext
            ? createElement(QueryEditorContextWrapper, {
                dataPane,
                children: createElement(MountedTransformationEditor),
              })
            : createElement(PanelDataTransformationsTab.Component, {
                model: dataPane.state.tabs.find(
                  (tab): tab is PanelDataTransformationsTab => tab instanceof PanelDataTransformationsTab
                )!,
              })
        );
        if (useNext) {
          await editor.user.click(screen.getByRole('button', { name: 'Edit transformation' }));
        }
        const format = await screen.findByRole('textbox', { name: 'Format' });
        expect(screen.getByRole('region', { name: 'original title' })).toBeInTheDocument();

        if (!noticesFirst) {
          // The preview's scene activations end while the transformation editor stays mounted.
          preview.unmount();
          preview = render(createElement(PanelEditPanelWrapper, { panel, dashboard }));
        }

        try {
          await editor.user.type(format, 'YYYY');
          expect(format).toHaveValue('YYYY');
          expect(transformer.state.transformations).toEqual([
            { id: 'formatTime', options: { outputFormat: 'YYYY', timeField: '', useTimezone: true } },
          ]);

          act(() => panelEditor.onToggleTableView());
          preview.rerender(
            createElement(PanelEditPanelWrapper, { panel, dashboard, tableView: panelEditor.state.tableView })
          );
          expect(screen.queryByRole('region', { name: 'original title' })).not.toBeInTheDocument();
          await editor.user.type(format, '-MM');
          expect(format).toHaveValue('YYYY-MM');
          expect(transformer.isActive).toBe(true);
          expect(queryRunner.isActive).toBe(true);
          expect(transformer.state.transformations).toEqual([
            { id: 'formatTime', options: { outputFormat: 'YYYY-MM', timeField: '', useTimezone: true } },
          ]);

          act(() => panelEditor.onToggleTableView());
          preview.rerender(
            createElement(PanelEditPanelWrapper, { panel, dashboard, tableView: panelEditor.state.tableView })
          );
          await editor.user.type(format, '-DD');
          expect(format).toHaveValue('YYYY-MM-DD');
          expect(transformer.state.transformations).toEqual([
            { id: 'formatTime', options: { outputFormat: 'YYYY-MM-DD', timeField: '', useTimezone: true } },
          ]);
          expect(panelEditor.state.isDirty).toBe(true);
        } finally {
          editor.unmount();
          preview.unmount();
        }

        deactivate!();
        deactivate = undefined;
        expect(gridItem.isActive).toBe(false);
        expect(panel.isActive).toBe(false);
        expect(transformer.isActive).toBe(false);
        expect(queryRunner.isActive).toBe(false);
      });
    }
  );

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

  describe('When the scene is rebuilt underneath the editor', () => {
    /** Replace the layout tree wholesale, as APPLY_SPEC and the json/code editors do. */
    function swapBody(dashboard: DashboardScene) {
      dashboard.setState({
        body: DefaultGridLayoutManager.fromVizPanels([new VizPanel({ key: 'panel-1', pluginId: 'text' })]),
      });
    }

    it('Should not commit the panel edit onto the discarded layout item', async () => {
      const { dashboard, panel } = await setup({});
      const setPanelEditAction = jest.spyOn(dashboard.state.sidebar, 'setPanelEditAction');

      panel.setState({ title: 'changed title' });
      swapBody(dashboard);

      deactivate!();
      deactivate = undefined;

      // The action's source would be the layout item of the discarded tree. It never activates
      // again, and DashboardSidebar retries an inactive source on an unbounded setTimeout loop.
      expect(setPanelEditAction).not.toHaveBeenCalled();
    });

    it('Should still commit when the editor is attached to the live tree', async () => {
      const { dashboard, panel } = await setup({});
      const setPanelEditAction = jest.spyOn(dashboard.state.sidebar, 'setPanelEditAction');

      panel.setState({ title: 'changed title' });

      deactivate!();
      deactivate = undefined;

      expect(setPanelEditAction).toHaveBeenCalled();
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

    it('restores the library link when undoing a completed panel edit', async () => {
      setTestFlags({ dashboardNewLayouts: true });
      const libraryPanel = new LibraryPanelBehavior({
        uid: 'lib-uid',
        name: 'Library panel',
        isLoaded: true,
        _loadedPanel: { uid: 'lib-uid', name: 'Library panel', type: 'panel', version: 1, model: { type: 'text' } },
      });
      const { dashboard, panel, panelEditor, gridItem } = await setup({ libraryPanel });
      panelEditor.onConfirmUnlinkLibraryPanel();
      expect(getLibraryPanelBehavior(panel)).toBeUndefined();
      deactivate!();
      deactivate = undefined;
      dashboard.setState({ editPanel: undefined });
      deactivate = activateFullSceneTree(dashboard);
      expect(dashboard.state.sidebar.state.undoStack).toHaveLength(1);
      dashboard.state.sidebar.undoAction();
      expect(getLibraryPanelBehavior(gridItem.state.body)?.state.uid).toBe('lib-uid');
      dashboard.state.sidebar.redoAction();
      expect(getLibraryPanelBehavior(gridItem.state.body)).toBeUndefined();
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
    it('should auto-open viz picker for new unconfigured panels', async () => {
      const { panelEditor } = await setup({ isNewPanel: true, pluginId: UNCONFIGURED_PANEL_PLUGIN_ID });
      const optionsPane = panelEditor.state.optionsPane;
      expect(optionsPane?.state.isVizPickerOpen).toBe(true);
    });
  });
});

interface SetupOptions {
  activateFullTree?: boolean;
  activateNoticesFirst?: boolean;
  isNewPanel?: boolean;
  pluginId?: string;
  pluginSkipDataQuery?: boolean;
  repeatByVariable?: string;
  skipWait?: boolean;
  pluginLoadTime?: number;
  libraryPanel?: LibraryPanelBehavior;
  initialTableTransformations?: DataTransformerConfig[];
}

async function setup(options: SetupOptions = {}) {
  const panelPluginId = options.pluginId ?? 'text';
  const pluginToLoad = getPanelPlugin({ id: panelPluginId, skipDataQuery: options.pluginSkipDataQuery }, () =>
    createElement('div', null, 'Preview visualization')
  );
  let pluginResolve = (plugin: PanelPlugin) => {};

  pluginPromise = new Promise<PanelPlugin>((resolve) => {
    pluginResolve = resolve;
  });

  const panel = new VizPanel({
    key: 'panel-1',
    pluginId: panelPluginId,
    title: 'original title',
    extendPanelContext: options.activateNoticesFirst ? setupPanelNotices : undefined,
    $behaviors: options.libraryPanel ? [options.libraryPanel] : undefined,
    $data: new SceneDataTransformer({
      transformations: [],
      $data: new SceneQueryRunner({
        queries: [{ refId: 'A' }],
        maxDataPoints: 500,
        datasource: { uid: 'ds1' },
      }),
    }),
  });

  if (options.initialTableTransformations) {
    panel.getRuntimeTransformations().set(TABLE_TRANSFORMATIONS_OWNER, options.initialTableTransformations);
  }

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

  // Notices can own the provider before the panel activates, as with an existing status surface.
  const deactivateNotices = options.activateNoticesFirst ? panel.getPanelContext().activateNotices!() : undefined;
  let deactivatePanel: CancelActivationHandler | undefined;
  if (options.activateFullTree === false) {
    deactivatePanel = panel.activate();
    deactivate = panelEditor.activate();
  } else {
    deactivate = activateFullSceneTree(dashboard);
  }

  if (!options.skipWait) {
    //console.log('pluginResolve(pluginToLoad)');
    pluginResolve(pluginToLoad);
    await new Promise((r) => setTimeout(r, 1));
  }

  return { dashboard, panel, gridItem, panelEditor, pluginResolve, deactivatePanel, deactivateNotices };
}

function MountedTransformationEditor() {
  const { transformations } = usePanelContext();
  const { setSelectedTransformation } = useQueryEditorUIContext();
  return createElement(
    Fragment,
    null,
    createElement('button', { onClick: () => setSelectedTransformation(transformations[0]) }, 'Edit transformation'),
    createElement(TransformationEditorRenderer)
  );
}
