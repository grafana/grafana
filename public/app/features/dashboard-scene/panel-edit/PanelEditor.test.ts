import { act, screen, waitFor } from '@testing-library/react';
import { createElement, Fragment } from 'react';
import { of } from 'rxjs';
import { render } from 'test/test-utils';

import {
  type DataQueryRequest,
  type DataQuery,
  type DataSourceApi,
  type DataTransformerConfig,
  FieldType,
  LoadingState,
  VariableRefresh,
  type PanelPlugin,
  store,
  standardTransformersRegistry,
  toDataFrame,
} from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { locationService } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import {
  type CancelActivationHandler,
  CustomVariable,
  registerRuntimeDataSource,
  RuntimeDataSource,
  SceneDataNode,
  SceneDataTransformer,
  sceneGraph,
  SceneGridLayout,
  SceneQueryRunner,
  SceneTimeRange,
  SceneVariableSet,
  TestVariable,
  VizPanel,
} from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { ModalsContext } from '@grafana/ui';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { mockDataSource } from 'app/features/alerting/unified/testSetup/mockDataSource';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';
import * as libAPI from 'app/features/library-panels/state/api';
import { TABLE_TRANSFORMATIONS_OWNER } from 'app/features/table/constants';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { edit } from '../actions/utils/edit';
import { ConditionalRenderingData } from '../conditional-rendering/conditions/ConditionalRenderingData';
import { DashboardPrompt } from '../saving/DashboardPrompt';
import { DashboardScene } from '../scene/DashboardScene';
import { LibraryPanelBehavior } from '../scene/LibraryPanelBehavior';
import { UNCONFIGURED_PANEL_PLUGIN_ID } from '../scene/UnconfiguredPanel';
import { AutoGridItem } from '../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../scene/layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../scene/layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem, type DashboardGridItemState } from '../scene/layout-default/DashboardGridItem';
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
import { SaveLibraryVizPanelModal } from './SaveLibraryVizPanelModal';

const loadingResponse = (ds: DataSourceApi, request: DataQueryRequest) => {
  return of({
    state: LoadingState.Loading,
    series: [],
    timeRange: request.range,
  });
};
const runRequestMock = jest.fn().mockImplementation(loadingResponse);

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
    defaultDatasource: 'ds1',
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

const RUNTIME_DS_UID = 'panel-editor-runtime-ds';

class RuntimeTestDataSource extends RuntimeDataSource {
  query() {
    return of({ data: [] });
  }
}

// Runtime datasources skip plugin loading, so query runners reach the mocked runRequest.
registerRuntimeDataSource({ dataSource: new RuntimeTestDataSource('panel-editor-runtime-ds', RUNTIME_DS_UID) });

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

    it('releases a replaced data provider, then the replacement when editing ends', async () => {
      const { panel, deactivatePanel } = await setup({
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

      deactivate!();
      deactivate = undefined;
      expect(replacement.isActive).toBe(false);
    });

    it('keeps ad hoc table transformations applied while editing and after leaving', async () => {
      const transformations: DataTransformerConfig[] = [{ id: 'organize', options: { indexByName: { B: 0, A: 1 } } }];
      const { panel } = await setup({ pluginId: 'table', initialTableTransformations: transformations });

      expect(panel.getRuntimeTransformations().get(TABLE_TRANSFORMATIONS_OWNER)).toEqual(transformations);

      deactivate!();
      deactivate = undefined;
      expect(panel.getRuntimeTransformations().get(TABLE_TRANSFORMATIONS_OWNER)).toEqual(transformations);
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
        runRequestMock.mockImplementation(loadingResponse);
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
        transformer.setState({
          transformations: [{ id: 'formatTime', options: { timeField: 'time', outputFormat: '' } }],
        });
        const formattedTime = () => transformer.state.data?.series[0]?.fields[0].values[0];

        // Only the query returns the source frame, so each edit must reach the transformer's output: the classic
        // editor reprocesses the transformations, and the next editor re-runs the query.
        const sourceFrame = () =>
          toDataFrame({ fields: [{ name: 'time', type: FieldType.time, values: [Date.UTC(2026, 0, 2, 12)] }] });
        runRequestMock.mockImplementation((ds: DataSourceApi, request: DataQueryRequest) =>
          of({ state: LoadingState.Done, series: [sourceFrame()], timeRange: request.range })
        );
        queryRunner.setState({ datasource: { uid: RUNTIME_DS_UID } });

        let preview = render(createElement(PanelEditPanelWrapper, { panel, dashboard }));
        act(() => {
          deactivatePanel!();
          deactivateNotices?.();
        });
        act(() => {
          queryRunner.setState({
            data: {
              state: LoadingState.Done,
              series: [sourceFrame()],
              timeRange: sceneGraph.getTimeRange(panel).state.value,
            },
          });
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
            { id: 'formatTime', options: { outputFormat: 'YYYY', timeField: 'time', useTimezone: true } },
          ]);
          await waitFor(() => expect(formattedTime()).toBe('2026'));

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
            { id: 'formatTime', options: { outputFormat: 'YYYY-MM', timeField: 'time', useTimezone: true } },
          ]);
          await waitFor(() => expect(formattedTime()).toBe('2026-01'));

          act(() => panelEditor.onToggleTableView());
          preview.rerender(
            createElement(PanelEditPanelWrapper, { panel, dashboard, tableView: panelEditor.state.tableView })
          );
          await editor.user.type(format, '-DD');
          expect(format).toHaveValue('YYYY-MM-DD');
          expect(transformer.state.transformations).toEqual([
            { id: 'formatTime', options: { outputFormat: 'YYYY-MM-DD', timeField: 'time', useTimezone: true } },
          ]);
          await waitFor(() => expect(formattedTime()).toBe('2026-01-02'));
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

    it('gives the reverted panel the ad hoc table transformations it showed', async () => {
      const hideB: DataTransformerConfig[] = [{ id: 'organize', options: { excludeByName: { B: true } } }];
      const { panelEditor, panel, dashboard } = await setup({ pluginId: 'table', initialTableTransformations: [] });

      panel.setState({ title: 'changed title' });
      panel.getRuntimeTransformations().set(TABLE_TRANSFORMATIONS_OWNER, hideB);
      panelEditor.onDiscard();

      const discardedPanel = findVizPanelByKey(dashboard, panel.state.key!)!;
      expect(discardedPanel.state.title).toBe('original title');
      expect(discardedPanel.getRuntimeTransformations().get(TABLE_TRANSFORMATIONS_OWNER)).toEqual(hideB);
    });

    it('gives the reverted panel its ad hoc table transformations from when editing started if its transformations changed', async () => {
      const hideA: DataTransformerConfig[] = [{ id: 'organize', options: { excludeByName: { A: true } } }];
      const hideB: DataTransformerConfig[] = [{ id: 'organize', options: { excludeByName: { B: true } } }];
      const { panelEditor, panel, dashboard } = await setup({ pluginId: 'table', initialTableTransformations: hideA });
      const transformer = panel.state.$data;
      if (!(transformer instanceof SceneDataTransformer)) {
        throw new Error('Expected a data transformer');
      }

      transformer.setState({ transformations: [{ id: 'organize', options: { renameByName: { A: 'Renamed' } } }] });
      panel.getRuntimeTransformations().set(TABLE_TRANSFORMATIONS_OWNER, hideB);
      panelEditor.onDiscard();

      const discardedPanel = findVizPanelByKey(dashboard, panel.state.key!)!;
      expect(discardedPanel.state.$data?.state).toMatchObject({ transformations: [] });
      expect(discardedPanel.getRuntimeTransformations().get(TABLE_TRANSFORMATIONS_OWNER)).toEqual(hideA);
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

  describe('When panel changes are undone', () => {
    afterEach(() => setTestFlags({}));

    it('keeps the ad hoc table transformations a panel shows when its panel changes are undone and redone', async () => {
      setTestFlags({ dashboardNewLayouts: true });
      const hideB: DataTransformerConfig[] = [{ id: 'organize', options: { excludeByName: { B: true } } }];
      const { dashboard, panel, gridItem } = await setup({ pluginId: 'table', initialTableTransformations: [] });
      panel.setState({ title: 'changed title' });
      panel.getRuntimeTransformations().set(TABLE_TRANSFORMATIONS_OWNER, hideB);
      deactivate!();
      deactivate = undefined;
      dashboard.setState({ editPanel: undefined });
      deactivate = activateFullSceneTree(dashboard);

      dashboard.state.sidebar.undoAction();
      expect(gridItem.state.body.state.title).toBe('original title');
      expect(gridItem.state.body.getRuntimeTransformations().get(TABLE_TRANSFORMATIONS_OWNER)).toEqual(hideB);

      dashboard.state.sidebar.redoAction();
      expect(gridItem.state.body.state.title).toBe('changed title');
      expect(gridItem.state.body.getRuntimeTransformations().get(TABLE_TRANSFORMATIONS_OWNER)).toEqual(hideB);
    });
  });

  describe('When changes are made', () => {
    it.each<Partial<DashboardGridItemState>>([{ variableName: 'server' }, { maxPerRow: 2 }, { repeatDirection: 'v' }])(
      'detects unsaved repeat settings %j and becomes clean when restored',
      async (change) => {
        const { panelEditor, gridItem } = await setup({});
        const original = gridItem.state;
        expect(panelEditor.hasUnsavedChanges()).toBe(false);

        gridItem.setState(change);
        expect(panelEditor.hasUnsavedChanges()).toBe(true);
        expect(panelEditor.state.isDirty).toBe(true);

        gridItem.setState({
          variableName: original.variableName,
          maxPerRow: original.maxPerRow,
          repeatDirection: original.repeatDirection,
        });
        expect(panelEditor.hasUnsavedChanges()).toBe(false);
        expect(panelEditor.state.isDirty).toBe(false);
      }
    );

    it('Should set state to dirty', async () => {
      const { panelEditor, panel } = await setup({});

      expect(panelEditor.state.isDirty).toBe(undefined);

      panel.setState({ title: 'changed title' });

      expect(panelEditor.state.isDirty).toBe(true);
    });

    it('sets state to dirty for changes made after the editor is activated again', async () => {
      const { panelEditor, panel } = await setup({ activateFullTree: false });

      deactivate!();
      deactivate = panelEditor.activate();
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
    it.each(['query', 'options'])('preserves unsaved library panel %s edits across dashboard save', async (edit) => {
      const libraryPanel = new LibraryPanelBehavior({
        uid: 'lib-uid',
        name: 'Library panel',
        isLoaded: true,
        _loadedPanel: { uid: 'lib-uid', name: 'Library panel', type: 'panel', version: 1, model: { type: 'text' } },
      });
      const { panelEditor, panel } = await setup({ libraryPanel });
      expect(panelEditor.hasUnsavedChanges()).toBe(false);
      expect(panelEditor.state.isDirty).not.toBe(true);

      if (edit === 'query') {
        getQueryRunnerFor(panel)?.setState({ queries: [{ refId: 'A', expression: '2' }] });
      } else {
        panel.setState({ options: { content: 'Edited library content' } });
      }
      expect(panelEditor.hasUnsavedChanges()).toBe(true);
      expect(panelEditor.state.isDirty).toBe(true);

      panelEditor.dashboardSaved();
      expect(panelEditor.hasUnsavedChanges()).toBe(true);
      expect(panelEditor.state.isDirty).toBe(true);
    });

    it.each([false, true])(
      'advances the saved layout dirty baseline while retaining unsaved library content (auto=%s)',
      async (auto) => {
        const { panelEditor, panel, layout } = await setupLibraryLayout(auto);
        layout.setState({ variableName: 'server' });
        if (layout instanceof DashboardGridItem) {
          layout.setState({ maxPerRow: 2 });
        } else {
          layout.setState({ fitContent: true });
        }
        panelEditor.dashboardSaved();
        expect(panelEditor.hasUnsavedChanges()).toBe(false);
        expect(panelEditor.state.isDirty).toBe(false);
        getQueryRunnerFor(panel)?.setState({ queries: [{ refId: 'A', expression: '2' }] });
        panelEditor.dashboardSaved();
        expect(panelEditor.hasUnsavedChanges()).toBe(true);
        expect(panelEditor.state.isDirty).toBe(true);
        getQueryRunnerFor(panel)?.setState({ queries: [{ refId: 'A' }] });
        expect(panelEditor.hasUnsavedChanges()).toBe(false);
        expect(panelEditor.state.isDirty).toBe(false);
      }
    );

    it.each([
      { auto: false, action: 'discard' },
      { auto: true, action: 'discard' },
      { auto: false, action: 'undo' },
      { auto: true, action: 'undo' },
    ])('restores saved library repeats after unlink then $action (auto=$auto)', async ({ auto, action }) => {
      setTestFlags({ dashboardNewLayouts: true });
      const { dashboard, panelEditor, panel, layout } = await setupLibraryLayout(auto);
      getQueryRunnerFor(panel)?.setState({ queries: [{ refId: 'A', expression: 'dirty' }] });
      layout.setRepeatByVariable('server');
      if (layout instanceof DashboardGridItem) {
        layout.handleVariableName();
      }
      layout.handleEditChange();
      panelEditor.dashboardSaved();
      panelEditor.onConfirmUnlinkLibraryPanel();
      expect(getLibraryPanelBehavior(panel)).toBeUndefined();
      if (action === 'discard') {
        panelEditor.onDiscard();
      } else {
        deactivate?.();
        dashboard.setState({ editPanel: undefined });
        deactivate = activateFullSceneTree(dashboard);
        dashboard.state.sidebar.undoAction();
      }
      const restored = [layout.state.body, ...(layout.state.repeatedPanels ?? [])];
      expect(restored).toHaveLength(3);
      for (const copy of restored) {
        expect(getLibraryPanelBehavior(copy)?.state.uid).toBe('lib-uid');
        expect(getQueryRunnerFor(copy)?.state.queries).toEqual([{ refId: 'A' }]);
      }
      if (action === 'undo') {
        dashboard.state.sidebar.redoAction();
        const unlinked = [layout.state.body, ...(layout.state.repeatedPanels ?? [])];
        expect(unlinked).toHaveLength(3);
        for (const copy of unlinked) {
          expect(getLibraryPanelBehavior(copy)).toBeUndefined();
          expect(getQueryRunnerFor(copy)?.state.queries).toEqual([{ refId: 'A', expression: 'dirty' }]);
        }
        dashboard.state.sidebar.undoAction();
        expect(layout.state.repeatedPanels).toHaveLength(2);
        expect(getLibraryPanelBehavior(layout.state.body)?.state.uid).toBe('lib-uid');
      }
    });

    it.each<{ schemaVersion: 'v1' | 'v2'; preferLibraryTitle: boolean; action: string; savedTitle: string }>(
      ['v1', 'v2'].flatMap((schemaVersion) => {
        if (schemaVersion !== 'v1' && schemaVersion !== 'v2') {
          throw new Error('Unexpected schema');
        }
        return [false, true].flatMap((preferLibraryTitle) =>
          ['discard', 'undo'].flatMap((action) =>
            ['Second saved title', ''].map((savedTitle) => ({ schemaVersion, preferLibraryTitle, action, savedTitle }))
          )
        );
      })
    )(
      'retains the authoritative saved title after $action ($schemaVersion, library title=$preferLibraryTitle, saved=$savedTitle)',
      async ({ schemaVersion, preferLibraryTitle, action, savedTitle }) => {
        setTestFlags({ dashboardNewLayouts: true, [FlagKeys.PreferLibraryPanelTitle]: preferLibraryTitle });
        const { dashboard, panelEditor, panel, layout } = await setupLibraryLayout(false, schemaVersion);
        dashboard.updatePanelTitle(panel, 'Saved title');
        panelEditor.dashboardSaved();
        const titleOnlyDirty = panelEditor.hasUnsavedChanges();
        dashboard.updatePanelTitle(panel, savedTitle);
        getQueryRunnerFor(panel)?.setState({ queries: [{ refId: 'A', expression: 'dirty' }] });
        layout.setRepeatByVariable('server');
        layout.handleEditChange();
        const model = dashboard.serializer.getSaveModel(dashboard);
        if ('panels' in model) {
          expect(model.panels?.[0].title).toBe(savedTitle);
        } else {
          expect(Object.values(model.elements)).toEqual([
            expect.objectContaining({ kind: 'LibraryPanel', spec: expect.objectContaining({ title: savedTitle }) }),
          ]);
        }
        panelEditor.dashboardSaved();
        expect(panelEditor.hasUnsavedChanges()).toBe(true);
        dashboard.updatePanelTitle(panel, 'Later title');
        if (action === 'discard') {
          panelEditor.onDiscard();
        } else {
          deactivate?.();
          dashboard.setState({ editPanel: undefined });
          deactivate = activateFullSceneTree(dashboard);
          dashboard.state.sidebar.undoAction();
        }
        expect(layout.state.body.state.title).toBe(preferLibraryTitle ? 'original title' : savedTitle);
        expect(layout.state.body.state.hoverHeader ?? false).toBe(!preferLibraryTitle && savedTitle === '');
        expect(titleOnlyDirty).toBe(preferLibraryTitle);
        expect(getQueryRunnerFor(layout.state.body)?.state.queries).toEqual([{ refId: 'A' }]);
        expect(layout.state.variableName).toBe(schemaVersion === 'v1' ? undefined : 'server');
        if (action === 'undo') {
          dashboard.state.sidebar.redoAction();
          expect(layout.state.body.state.title).toBe('Later title');
          expect(getQueryRunnerFor(layout.state.body)?.state.queries).toEqual([{ refId: 'A', expression: 'dirty' }]);
        }
      }
    );

    it.each([false, true])(
      'keeps live repeat expansion from shifting siblings again on Discard (loading=%s)',
      async (loading) => {
        setTestFlags({ dashboardNewLayouts: true });
        const pending = loading
          ? new TestVariable({
              name: 'server',
              query: 'initial',
              isMulti: true,
              value: ['A', 'B'],
              text: ['A', 'B'],
              delayMs: 0,
              refresh: VariableRefresh.onTimeRangeChanged,
              optionsToReturn: ['A', 'B', 'C', 'D'].map((value) => ({ value, label: value })),
            })
          : undefined;
        const { dashboard, panelEditor, panel, layout } = await setupLibraryLayout(false, 'v2', pending);
        if (!(layout instanceof DashboardGridItem) || !(layout.parent instanceof SceneGridLayout)) {
          throw new Error('Expected grid');
        }
        const variable = dashboard.state.$variables?.getByName('server');
        if (!(variable instanceof CustomVariable) && !(variable instanceof TestVariable)) {
          throw new Error('Expected server variable');
        }
        variable.changeValueTo(['A', 'B']);
        layout.setRepeatByVariable('server');
        layout.handleVariableName();
        layout.setState({ repeatDirection: 'v', itemHeight: 10, x: 0, y: 0, width: 12 });
        layout.handleEditChange();
        expect(layout.state.height).toBe(20);
        const following = new DashboardGridItem({
          y: 20,
          x: 0,
          width: 12,
          height: 5,
          body: new VizPanel({ key: 'panel-2', pluginId: 'text' }),
        });
        layout.parent.setState({ children: [...layout.parent.state.children, following] });
        getQueryRunnerFor(panel)?.setState({ queries: [{ refId: 'A', expression: 'dirty' }] });
        panelEditor.dashboardSaved();
        variable.changeValueTo(['A', 'B', 'C', 'D']);
        await waitFor(() => expect(layout.state.height).toBe(40));
        expect(following.state.y).toBe(40);
        if (pending) {
          pending.setState({ delayMs: undefined });
          const timeRange = dashboard.state.$timeRange;
          if (!(timeRange instanceof SceneTimeRange)) {
            throw new Error('Expected time range');
          }
          timeRange.setState({ from: 'now-5h' });
          await waitFor(() => expect(pending.state.loading).toBe(true));
        }
        panelEditor.onDiscard();
        expect(following.state.y).toBe(40);
        if (loading) {
          expect(layout.state.repeatedPanels).toBeUndefined();
          pending?.signalUpdateCompleted();
        }
        await waitFor(() => expect(layout.state.repeatedPanels).toHaveLength(3));
        expect(layout.state.height).toBe(40);
        expect(following.state.y).toBe(40);
        for (const copy of [layout.state.body, ...(layout.state.repeatedPanels ?? [])]) {
          expect(getQueryRunnerFor(copy)?.state.queries).toEqual([{ refId: 'A' }]);
        }
      }
    );

    it.each<{ schemaVersion: 'v1' | 'v2' }>([{ schemaVersion: 'v1' }, { schemaVersion: 'v2' }])(
      'keeps only actually persisted $schemaVersion library repeat changes after save',
      async ({ schemaVersion }) => {
        setTestFlags({ dashboardNewLayouts: true });
        const libraryPanel = new LibraryPanelBehavior({
          uid: 'lib-uid',
          name: 'Library panel',
          isLoaded: true,
          _loadedPanel: { uid: 'lib-uid', name: 'Library panel', type: 'panel', version: 1, model: { type: 'text' } },
        });
        const { dashboard, panelEditor, gridItem } = await setup({ libraryPanel, schemaVersion });
        gridItem.setRepeatByVariable('server');
        gridItem.handleEditChange();
        const saved = dashboard.serializer.getSaveModel(dashboard);
        if ('panels' in saved) {
          expect(saved.panels?.[0].libraryPanel).toEqual({ uid: 'lib-uid', name: 'Library panel' });
          expect(saved.panels?.[0]).not.toHaveProperty('repeat');
        } else {
          expect(saved.layout).toMatchObject({
            kind: 'GridLayout',
            spec: { items: [{ spec: { repeat: { value: 'server' } } }] },
          });
        }
        panelEditor.dashboardSaved();
        expect(panelEditor.hasUnsavedChanges()).toBe(schemaVersion === 'v1');
        expect(panelEditor.state.isDirty).toBe(schemaVersion === 'v1');
        panelEditor.onDiscard();
        expect(gridItem.state.variableName).toBe(schemaVersion === 'v1' ? undefined : 'server');
        expect(gridItem.state.repeatedPanels?.length ?? 0).toBe(schemaVersion === 'v1' ? 0 : 2);
      }
    );

    it.each([
      { auto: false, savedRepeat: false, action: 'discard' },
      { auto: true, savedRepeat: false, action: 'discard' },
      { auto: false, savedRepeat: true, action: 'discard' },
      { auto: true, savedRepeat: true, action: 'discard' },
      { auto: false, savedRepeat: false, action: 'undo' },
      { auto: true, savedRepeat: false, action: 'undo' },
      { auto: false, savedRepeat: true, action: 'undo' },
      { auto: true, savedRepeat: true, action: 'undo' },
    ])(
      'restores saved repeat enablement and dependencies after $action (auto=$auto, enabled=$savedRepeat)',
      async ({ auto, savedRepeat, action }) => {
        setTestFlags({ dashboardNewLayouts: true });
        const { dashboard, panelEditor, panel, layout } = await setupLibraryLayout(auto);
        const variables = dashboard.state.$variables;
        if (!(variables instanceof SceneVariableSet)) {
          throw new Error('Expected dashboard variables');
        }
        variables.setState({
          variables: [
            ...variables.state.variables,
            new CustomVariable({
              name: 'other',
              query: 'X,Y',
              isMulti: true,
              value: ['X', 'Y'],
              text: ['X', 'Y'],
            }),
          ],
        });
        getQueryRunnerFor(panel)?.setState({ queries: [{ refId: 'A', expression: 'dirty' }] });
        layout.setRepeatByVariable(savedRepeat ? 'server' : undefined);
        layout.handleEditChange();
        panelEditor.dashboardSaved();
        layout.setRepeatByVariable('other');
        layout.handleEditChange();
        expect(layout.state.repeatedPanels).toHaveLength(1);
        // Restore while inactive, before sidebar actions can repair repeat state.
        deactivate?.();
        deactivate = undefined;
        if (action === 'discard') {
          panelEditor.onDiscard();
        } else {
          dashboard.setState({ editPanel: undefined });
          deactivate = activateFullSceneTree(dashboard);
          dashboard.state.sidebar.undoAction();
        }
        const checkRestored = () => {
          expect(layout.state.variableName).toBe(savedRepeat ? 'server' : undefined);
          const copies = [layout.state.body, ...(layout.state.repeatedPanels ?? [])];
          expect(copies).toHaveLength(savedRepeat ? 3 : 1);
          copies.forEach((copy, index) => {
            expect(getQueryRunnerFor(copy)?.state.queries).toEqual([{ refId: 'A' }]);
            expect(copy.state.$variables?.getByName('other')).toBeUndefined();
            expect(copy.state.$variables?.getByName('server')?.getValue()).toBe(
              savedRepeat ? ['A', 'B', 'C'][index] : undefined
            );
          });
          if (layout instanceof AutoGridItem) {
            expect(layout.state.repeatedConditionalRendering?.length ?? 0).toBe(savedRepeat ? 2 : 0);
            expect(layout.state.conditionalRendering?.getTarget()).toBe(layout.state.body);
          }
        };
        checkRestored();
        if (action === 'discard' && layout instanceof DashboardGridItem) {
          const height = layout.state.height;
          const itemHeight = layout.state.itemHeight;
          layout.setState({ height: 42 });
          expect(layout.state.itemHeight).toBe(itemHeight);
          layout.setState({ height });
        }
        if (action === 'undo') {
          dashboard.state.sidebar.redoAction();
          expect(layout.state.variableName).toBe('other');
          expect(
            [layout.state.body, ...(layout.state.repeatedPanels ?? [])].map(
              (copy) => getQueryRunnerFor(copy)?.state.queries
            )
          ).toEqual([[{ refId: 'A', expression: 'dirty' }], [{ refId: 'A', expression: 'dirty' }]]);
          dashboard.state.sidebar.undoAction();
          checkRestored();
        }
        deactivate?.();
        dashboard.setState({ editPanel: undefined });
        deactivate = activateFullSceneTree(dashboard);
        checkRestored();
        const other = variables.getByName('other');
        if (!(other instanceof CustomVariable)) {
          throw new Error('Expected other variable');
        }
        other.changeValueTo(['Y']);
        checkRestored();
        const server = variables.getByName('server');
        if (!(server instanceof CustomVariable)) {
          throw new Error('Expected server variable');
        }
        server.changeValueTo(['C']);
        await waitFor(() => expect(layout.state.repeatedPanels?.length ?? 0).toBe(0));
        expect(layout.state.body.state.$variables?.getByName('server')?.getValue()).toBe(savedRepeat ? 'C' : undefined);
      }
    );

    it.each([
      { auto: false, action: 'discard' },
      { auto: false, action: 'undo' },
      { auto: true, action: 'discard' },
      { auto: true, action: 'undo' },
    ])('keeps saved layout and original library content after $action (auto=$auto)', async ({ auto, action }) => {
      setTestFlags({ dashboardNewLayouts: true });
      const { dashboard, panelEditor, panel, layout } = await setupLibraryLayout(auto);
      layout.setState({ variableName: 'server' });
      if (layout instanceof DashboardGridItem) {
        layout.setState({ maxPerRow: 2, repeatDirection: 'v' });
      } else {
        layout.setState({ fitContent: true });
        layout.state.conditionalRendering?.setState({
          visibility: 'hide',
          conditions: [new ConditionalRenderingData({ value: true, result: undefined })],
        });
      }
      getQueryRunnerFor(panel)?.setState({ queries: [{ refId: 'A', expression: '2' }] });
      panelEditor.dashboardSaved();
      layout.setState({ variableName: undefined });
      if (layout instanceof DashboardGridItem) {
        layout.setState({ maxPerRow: 3, repeatDirection: 'h' });
      } else {
        layout.setState({ fitContent: false });
        layout.state.conditionalRendering?.changeVisibility('show');
      }
      getQueryRunnerFor(panel)?.setState({ queries: [{ refId: 'A', expression: '3' }] });
      if (action === 'discard') {
        panelEditor.onDiscard();
      } else {
        deactivate?.();
        deactivate = undefined;
        dashboard.setState({ editPanel: undefined });
        deactivate = activateFullSceneTree(dashboard);
        dashboard.state.sidebar.undoAction();
      }
      expect(layout.state.variableName).toBe('server');
      if (layout instanceof DashboardGridItem) {
        expect(layout.state).toMatchObject({ maxPerRow: 2, repeatDirection: 'v' });
      } else {
        expect(layout.state.fitContent).toBe(true);
        expect(layout.state.conditionalRendering?.serialize()).toMatchObject({
          spec: {
            visibility: 'hide',
            items: [{ kind: 'ConditionalRenderingData', spec: { value: true } }],
          },
        });
      }
      expect(getQueryRunnerFor(layout.state.body)?.state.queries).toEqual([{ refId: 'A' }]);
      if (action === 'undo') {
        dashboard.state.sidebar.redoAction();
        expect(getQueryRunnerFor(layout.state.body)?.state.queries).toEqual([{ refId: 'A', expression: '3' }]);
      }
    });

    it.each([
      { auto: false, action: 'discard' },
      { auto: false, action: 'undo' },
      { auto: true, action: 'discard' },
      { auto: true, action: 'undo' },
    ])(
      'rebuilds every saved library repeat from clean content after $action (auto=$auto)',
      async ({ auto, action }) => {
        setTestFlags({ dashboardNewLayouts: true });
        const { dashboard, panelEditor, panel, layout } = await setupLibraryLayout(auto);
        getQueryRunnerFor(panel)?.setState({ queries: [{ refId: 'A', expression: 'dirty' }] });
        layout.setRepeatByVariable('server');
        if (layout instanceof DashboardGridItem) {
          layout.handleVariableName();
        }
        layout.handleEditChange();
        expect(layout.state.repeatedPanels).toHaveLength(2);
        for (const copy of layout.state.repeatedPanels ?? []) {
          expect(getQueryRunnerFor(copy)?.state.queries).toEqual([{ refId: 'A', expression: 'dirty' }]);
        }
        if (layout instanceof DashboardGridItem) {
          layout.setState({ maxPerRow: 2, itemHeight: 7, repeatDirection: 'h' });
        } else {
          layout.setState({ fitContent: true });
          layout.state.conditionalRendering?.changeVisibility('hide');
        }
        layout.handleEditChange();
        let following: DashboardGridItem | undefined;
        if (layout instanceof DashboardGridItem && layout.parent instanceof SceneGridLayout) {
          layout.setState({ x: 0, y: 4 });
          following = new DashboardGridItem({
            x: 0,
            y: 18,
            width: 12,
            height: 6,
            body: new VizPanel({ key: 'panel-2', pluginId: 'text' }),
          });
          layout.parent.setState({ children: [...layout.parent.state.children, following] });
        }
        panelEditor.dashboardSaved();
        expect(panelEditor.hasUnsavedChanges()).toBe(true);
        if (layout instanceof DashboardGridItem) {
          layout.setState({ height: 20 });
        }
        if (action === 'discard') {
          panelEditor.onDiscard();
        } else {
          deactivate?.();
          deactivate = undefined;
          dashboard.setState({ editPanel: undefined });
          deactivate = activateFullSceneTree(dashboard);
          dashboard.state.sidebar.undoAction();
        }
        const assertRepeats = (expression: string | undefined, values: string[]) => {
          const panels = [layout.state.body, ...(layout.state.repeatedPanels ?? [])];
          expect(panels).toHaveLength(values.length);
          expect(panels.map((copy) => getQueryRunnerFor(copy)?.state.queries)).toEqual(
            values.map(() => [expression ? { refId: 'A', expression } : { refId: 'A' }])
          );
          panels.forEach((copy, index) => {
            expect(copy.state.$variables?.getByName('server')?.getValue()).toBe(values[index]);
          });
          if (layout instanceof AutoGridItem) {
            expect(layout.state.fitContent).toBe(true);
            expect(layout.state.conditionalRendering?.getTarget()).toBe(panels[0]);
            expect(layout.state.repeatedConditionalRendering).toHaveLength(values.length - 1);
            layout.state.repeatedConditionalRendering?.forEach((condition, index) => {
              expect(condition.getTarget()).toBe(panels[index + 1]);
              expect(condition.state.visibility).toBe('hide');
            });
          } else {
            expect(layout.state).toMatchObject({
              variableName: 'server',
              maxPerRow: 2,
              repeatDirection: 'h',
              itemHeight: expression ? 10 : 7,
              width: 24,
              x: 0,
              y: 4,
            });
            expect(layout.state.height).toBe(expression ? 20 : values.length > 2 ? 14 : 7);
            expect(following?.state.y).toBe(18);
          }
        };
        assertRepeats(undefined, ['A', 'B', 'C']);
        // Exercise an inactive restore followed by the same-value activation cache path.
        deactivate?.();
        deactivate = activateFullSceneTree(dashboard);
        assertRepeats(undefined, ['A', 'B', 'C']);
        if (layout instanceof DashboardGridItem) {
          const itemHeights: Array<number | undefined> = [];
          const resize = layout.subscribeToState((state, previous) => {
            if (state.itemHeight !== previous.itemHeight) {
              itemHeights.push(state.itemHeight);
            }
          });
          layout.setState({ height: 18 });
          expect(layout.state.itemHeight).toBe(9);
          layout.setState({ height: 14 });
          expect(itemHeights).toEqual([9, 7]);
          resize.unsubscribe();
        }
        if (action === 'undo') {
          for (let cycle = 0; cycle < 3; cycle++) {
            dashboard.state.sidebar.redoAction();
            assertRepeats('dirty', ['A', 'B', 'C']);
            dashboard.state.sidebar.undoAction();
            assertRepeats(undefined, ['A', 'B', 'C']);
          }
        }
        const variable = dashboard.state.$variables?.getByName('server');
        if (!(variable instanceof CustomVariable)) {
          throw new Error('Expected server variable');
        }
        variable.changeValueTo(['B', 'C']);
        await waitFor(() => expect(layout.state.repeatedPanels).toHaveLength(1));
        assertRepeats(undefined, ['B', 'C']);
      }
    );

    it.each(['discard', 'undo'])(
      'restores ad hoc transformations matching the retained library content after %s',
      async (action) => {
        setTestFlags({ dashboardNewLayouts: true });
        const libraryPanel = new LibraryPanelBehavior({
          uid: 'lib-uid',
          name: 'Library panel',
          isLoaded: true,
          _loadedPanel: { uid: 'lib-uid', name: 'Library panel', type: 'panel', version: 1, model: { type: 'table' } },
        });
        const hideB: DataTransformerConfig[] = [{ id: 'organize', options: { excludeByName: { B: true } } }];
        const hideC: DataTransformerConfig[] = [{ id: 'organize', options: { excludeByName: { C: true } } }];
        const changed: DataTransformerConfig[] = [{ id: 'organize', options: { excludeByName: { A: true } } }];
        const { dashboard, panel, panelEditor, gridItem } = await setup({
          libraryPanel,
          pluginId: 'table',
          initialTableTransformations: hideB,
          schemaVersion: 'v2',
        });
        const transformer = panel.state.$data;
        if (!(transformer instanceof SceneDataTransformer)) {
          throw new Error('Expected transformer');
        }
        transformer.setState({ transformations: changed });
        panel.getRuntimeTransformations().set(TABLE_TRANSFORMATIONS_OWNER, hideC);
        gridItem.setState({ maxPerRow: 2 });
        panelEditor.dashboardSaved();
        gridItem.setState({ maxPerRow: 3 });
        if (action === 'discard') {
          panelEditor.onDiscard();
        } else {
          deactivate?.();
          deactivate = undefined;
          dashboard.setState({ editPanel: undefined });
          deactivate = activateFullSceneTree(dashboard);
          dashboard.state.sidebar.undoAction();
        }
        const restored = gridItem.state.body;
        expect(gridItem.state.maxPerRow).toBe(2);
        expect(restored.state.$data?.state).toMatchObject({ transformations: [] });
        expect(restored.getRuntimeTransformations().get(TABLE_TRANSFORMATIONS_OWNER)).toEqual(hideB);
        if (action === 'undo') {
          dashboard.state.sidebar.redoAction();
          expect(gridItem.state.body.state.$data?.state).toMatchObject({ transformations: changed });
          expect(gridItem.state.body.getRuntimeTransformations().get(TABLE_TRANSFORMATIONS_OWNER)).toEqual(hideC);
        }
      }
    );

    it('resets a formerly linked panel baseline when the dashboard saves its unlinked content', async () => {
      const libraryPanel = new LibraryPanelBehavior({
        uid: 'lib-uid',
        name: 'Library panel',
        isLoaded: true,
        _loadedPanel: { uid: 'lib-uid', name: 'Library panel', type: 'panel', version: 1, model: { type: 'text' } },
      });
      const { panelEditor, panel } = await setup({ libraryPanel });
      getQueryRunnerFor(panel)?.setState({ queries: [{ refId: 'A', expression: '2' }] });
      panelEditor.onConfirmUnlinkLibraryPanel();
      panelEditor.dashboardSaved();
      expect(getLibraryPanelBehavior(panel)).toBeUndefined();
      expect(panelEditor.hasUnsavedChanges()).toBe(false);
      expect(panelEditor.state.isDirty).toBe(false);
    });

    it('requests the library save prompt when leaving after a dashboard save with unsaved library queries', async () => {
      const libraryPanel = new LibraryPanelBehavior({
        uid: 'lib-uid',
        name: 'Library panel',
        isLoaded: true,
        _loadedPanel: { uid: 'lib-uid', name: 'Library panel', type: 'panel', version: 1, model: { type: 'text' } },
      });
      const { dashboard, panelEditor, panel } = await setup({ libraryPanel });
      const previousLocation = locationService.getLocation();
      locationService.push('/d/library-draft?editPanel=1');
      const showModal = jest.fn();
      const view = render(
        createElement(
          ModalsContext.Provider,
          {
            value: { component: null, props: {}, showModal, hideModal: jest.fn() },
          },
          createElement(DashboardPrompt, { dashboard })
        )
      );
      try {
        act(() => {
          getQueryRunnerFor(panel)?.setState({ queries: [{ refId: 'A', expression: '2' }] });
          panelEditor.dashboardSaved();
          locationService.partial({ editPanel: null });
        });
        expect(showModal).toHaveBeenCalledWith(
          SaveLibraryVizPanelModal,
          expect.objectContaining({
            isUnsavedPrompt: true,
            libraryPanel,
          })
        );
        expect(locationService.getLocation().search).toBe('?editPanel=1');
      } finally {
        view.unmount();
        locationService.replace(previousLocation);
      }
    });

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
      expect(panelEditor.hasUnsavedChanges()).toBe(true);
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
    it.each([true, false])('honors skipDefaultQuery=%s when opening a panel without data', async (skipDefaultQuery) => {
      const { panel } = await setup({ pluginSkipDataQuery: false, skipDefaultQuery, withoutData: true });
      expect(getQueryRunnerFor(panel)?.state.queries).toEqual(skipDefaultQuery ? [] : [{ refId: 'A' }]);
      if (skipDefaultQuery) {
        expect(getQueryRunnerFor(panel)?.isDataReadyToDisplay()).toBe(true);
      }
    });

    it('removes only the untouched starter query on a new opted-in panel', async () => {
      const { panel } = await setup({ isNewPanel: true, pluginSkipDataQuery: false, skipDefaultQuery: true });
      expect(getQueryRunnerFor(panel)?.state.queries).toEqual([]);
    });

    it.each([true, false])('preserves configured queries on opted-in panels (new=%s)', async (isNewPanel) => {
      const queries = [{ refId: 'A', expr: 'up', hide: true }];
      const { panel } = await setup({ isNewPanel, pluginSkipDataQuery: false, skipDefaultQuery: true, queries });
      expect(getQueryRunnerFor(panel)?.state.queries).toEqual([{ refId: 'A', expr: 'up', hide: true }]);
    });

    it('preserves an existing panel query even when it looks like a starter', async () => {
      const { panel } = await setup({ pluginSkipDataQuery: false, skipDefaultQuery: true });
      expect(getQueryRunnerFor(panel)?.state.queries).toEqual([{ refId: 'A' }]);
    });

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
  repeatVariable?: TestVariable;
  schemaVersion?: 'v1' | 'v2';
  activateFullTree?: boolean;
  activateNoticesFirst?: boolean;
  isNewPanel?: boolean;
  pluginId?: string;
  pluginSkipDataQuery?: boolean;
  skipDefaultQuery?: boolean;
  queries?: DataQuery[];
  withoutData?: boolean;
  repeatByVariable?: string;
  skipWait?: boolean;
  pluginLoadTime?: number;
  libraryPanel?: LibraryPanelBehavior;
  initialTableTransformations?: DataTransformerConfig[];
}

async function setup(options: SetupOptions = {}) {
  const panelPluginId = options.pluginId ?? 'text';
  const pluginToLoad = getPanelPlugin(
    { id: panelPluginId, skipDataQuery: options.pluginSkipDataQuery, skipDefaultQuery: options.skipDefaultQuery },
    () => createElement('div', null, 'Preview visualization')
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
        queries: options.queries ?? [{ refId: 'A' }],
        maxDataPoints: 500,
        datasource: { uid: 'ds1' },
      }),
    }),
  });

  if (options.withoutData) {
    panel.setState({ $data: undefined });
  }

  if (options.initialTableTransformations) {
    panel.getRuntimeTransformations().set(TABLE_TRANSFORMATIONS_OWNER, options.initialTableTransformations);
  }

  const gridItem = new DashboardGridItem({ body: panel, variableName: options.repeatByVariable });

  const panelEditor = buildPanelEditScene(panel, options.isNewPanel);
  const dashboard = new DashboardScene(
    {
      editPanel: panelEditor,
      isEditing: true,
      $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      $variables: new SceneVariableSet({
        variables: [
          options.repeatVariable ??
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
    },
    options.schemaVersion
  );

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

async function setupLibraryLayout(auto: boolean, schemaVersion: 'v1' | 'v2' = 'v2', repeatVariable?: TestVariable) {
  const libraryPanel = new LibraryPanelBehavior({
    uid: 'lib-uid',
    name: 'Library panel',
    isLoaded: true,
    _loadedPanel: { uid: 'lib-uid', name: 'Library panel', type: 'panel', version: 1, model: { type: 'text' } },
  });
  const fixture = await setup({ libraryPanel, schemaVersion, repeatVariable });
  if (!auto) {
    return { ...fixture, layout: fixture.gridItem };
  }
  deactivate?.();
  deactivate = undefined;
  const panel = fixture.panel.clone();
  const layout = new AutoGridItem({ body: panel });
  fixture.dashboard.setState({
    editPanel: undefined,
    body: new AutoGridLayoutManager({
      layout: new AutoGridLayout({ children: [layout], templateColumns: '1fr', rowGap: 0, columnGap: 0 }),
    }),
  });
  const panelEditor = buildPanelEditScene(panel);
  panelEditor.debounceSaveModelDiff = false;
  fixture.dashboard.setState({ editPanel: panelEditor });
  deactivate = activateFullSceneTree(fixture.dashboard);
  await waitFor(() => expect(panelEditor.state.isInitializing).toBe(false));
  return { ...fixture, panel, panelEditor, layout };
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
