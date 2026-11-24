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
  type PanelPlugin,
  standardTransformersRegistry,
  toDataFrame,
} from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { reportInteraction } from '@grafana/runtime';
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
  VizPanel,
} from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { mockDataSource } from 'app/features/alerting/unified/testSetup/mockDataSource';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';
import * as libAPI from 'app/features/library-panels/state/api';
import { TABLE_TRANSFORMATIONS_OWNER } from 'app/features/table/constants';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

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
import { DashboardInteractions } from '../utils/interactions';
import { activateFullSceneTree } from '../utils/test-utils';
import { getLibraryPanelBehavior } from '../utils/utils';

import { PanelDataPane } from './PanelDataPane/PanelDataPane';
import { PanelDataQueriesTab } from './PanelDataPane/PanelDataQueriesTab';
import { PanelDataTransformationsTab } from './PanelDataPane/PanelDataTransformationsTab';
import { PanelDataPaneNext } from './PanelEditNext/PanelDataPaneNext';
import { usePanelContext, useQueryEditorUIContext } from './PanelEditNext/QueryEditor/QueryEditorContext';
import { QueryEditorContextWrapper } from './PanelEditNext/QueryEditor/QueryEditorContextWrapper';
import { TransformationEditorRenderer } from './PanelEditNext/QueryEditor/TransformationEditorRenderer';
import { PanelEditPanelWrapper } from './PanelEditPanelWrapper';
import { buildPanelEditScene } from './PanelEditor';

jest.mock('app/features/library-panels/state/api', () => makeSpyable('app/features/library-panels/state/api'));

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
  reportInteraction: jest.fn(),
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
  it('keeps coauthoring open across query-pane remounts and closes it when panel edit ends', async () => {
    const { panel, panelEditor, deactivatePanel } = await setup({ pluginId: 'timeseries', activateFullTree: false });
    const pane = new PanelDataPaneNext({ panelRef: panel.getRef() });
    panelEditor.setState({ dataPane: pane });
    const deactivatePane = pane.activate();
    const session = pane.startCoauthoringSession('A');

    deactivatePane();
    expect(session.signal.aborted).toBe(false);

    const replacement = new PanelDataPaneNext({ panelRef: panel.getRef() });
    panelEditor.setState({ dataPane: replacement });
    const deactivateReplacement = replacement.activate();
    expect(replacement.getCoauthoringEditorQueries()).toEqual([{ refId: 'A' }]);
    expect(session.signal.aborted).toBe(false);
    deactivate?.();
    deactivate = undefined;
    expect(await session.closed).toBe('left_panel_edit');
    deactivateReplacement();
    deactivatePanel?.();
  });

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
      });

      afterEach(() => {
        setTestFlags({});
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

  describe('Reporting query option changes', () => {
    let panelSettingChanged: jest.SpyInstance;

    beforeEach(() => {
      setTestFlags({ queryEditorNext: false });
      panelSettingChanged = jest.spyOn(DashboardInteractions, 'panelSettingChanged').mockImplementation();
    });

    afterEach(() => {
      panelSettingChanged.mockRestore();
      setTestFlags({});
    });

    it('reports a query option changed in the classic query editor', async () => {
      const { panelEditor } = await setup();
      const { dataPane } = panelEditor.state;
      const queriesTab =
        dataPane instanceof PanelDataPane
          ? dataPane.state.tabs.find((tab) => tab instanceof PanelDataQueriesTab)
          : undefined;
      if (!(queriesTab instanceof PanelDataQueriesTab)) {
        throw new Error('Expected the classic queries tab');
      }

      queriesTab.onQueryOptionsChange({ ...queriesTab.buildQueryOptions(), maxDataPoints: 100 });

      expect(panelSettingChanged).toHaveBeenCalledTimes(1);
      expect(panelSettingChanged).toHaveBeenCalledWith({
        item: 'change_query_option',
        source: 'panel_editor',
        panel_type: 'text',
        panel_id: 1,
        option: 'max_data_points',
        editor: 'classic',
      });
    });

    it('does not report hide time info that the classic query editor drops for lack of a time range', async () => {
      const { panelEditor, panel } = await setup();
      const { dataPane } = panelEditor.state;
      const queriesTab =
        dataPane instanceof PanelDataPane
          ? dataPane.state.tabs.find((tab) => tab instanceof PanelDataQueriesTab)
          : undefined;
      if (!(queriesTab instanceof PanelDataQueriesTab)) {
        throw new Error('Expected the classic queries tab');
      }

      queriesTab.onQueryOptionsChange({ ...queriesTab.buildQueryOptions(), timeRange: { hide: true } });

      expect(panel.state.$timeRange).toBeUndefined();
      expect(panelSettingChanged).not.toHaveBeenCalled();
    });

    it('reports a query option changed in the next query editor', async () => {
      setTestFlags({ queryEditorNext: true });
      const { panelEditor } = await setup();
      const { dataPane } = panelEditor.state;
      if (!(dataPane instanceof PanelDataPaneNext)) {
        throw new Error('Expected the next data pane');
      }

      dataPane.onQueryOptionsChange({
        queries: [],
        dataSource: { uid: 'ds1' },
        maxDataPoints: 500,
        timeRange: { from: '1h' },
      });

      expect(panelSettingChanged).toHaveBeenCalledTimes(1);
      expect(panelSettingChanged).toHaveBeenCalledWith(
        expect.objectContaining({ item: 'change_query_option', option: 'relative_time', editor: 'next' })
      );
    });
  });

  describe('Reporting the close and discard interactions', () => {
    const NO_CHANGES = {
      changed: false,
      changed_options: false,
      changed_field_config: false,
      changed_overrides: false,
      changed_queries: false,
      changed_transformations: false,
      changed_panel_info: false,
      changed_repeat: false,
      saved_in_editor: false,
      panel_type: 'text',
      panel_id: 1,
      is_new_panel: false,
      is_library_panel: false,
      query_change_count: 0,
      query_editor: 'classic',
      isDynamicDashboard: true,
    };

    const reported = (name: string) =>
      jest
        .mocked(reportInteraction)
        .mock.calls.filter(([interactionName]) => interactionName === name)
        .map(([, properties, options]) => ({ properties, options }));

    const closeEditor = () => {
      deactivate!();
      deactivate = undefined;
    };

    beforeEach(() => {
      setTestFlags({ queryEditorNext: false });
      jest.mocked(reportInteraction).mockClear();
    });

    afterEach(() => {
      setTestFlags({});
    });

    it('reports a non-silent close with no changed areas when nothing was edited', async () => {
      await setup();

      closeEditor();

      expect(reported('panel_edit_closed')).toEqual([
        { properties: { ...NO_CHANGES, outcome: 'kept' }, options: undefined },
      ]);
      expect(reported('panel_edit_discarded')).toEqual([]);
    });

    it('reports the areas the user changed when the editor closes', async () => {
      const { panel } = await setup();

      panel.setState({ title: 'changed title', options: { content: 'Hello' } });
      closeEditor();

      expect(reported('panel_edit_closed')).toEqual([
        {
          properties: {
            ...NO_CHANGES,
            changed: true,
            changed_options: true,
            changed_panel_info: true,
            outcome: 'kept',
          },
          options: undefined,
        },
      ]);
    });

    it('does not count the default query the editor adds to a panel without data as a change', async () => {
      const { panel } = await setup({ withoutData: true });
      expect(getQueryRunnerFor(panel)?.state.queries).toHaveLength(1);

      closeEditor();

      expect(reported('panel_edit_closed')[0].properties).toEqual({ ...NO_CHANGES, outcome: 'kept' });
    });

    it('reports a discard with the discarded areas, then a close with the discarded outcome', async () => {
      const { panel, panelEditor } = await setup();

      getQueryRunnerFor(panel)?.setState({ maxDataPoints: 123 });
      panelEditor.onDiscard();
      closeEditor();

      const discardedChanges = { ...NO_CHANGES, changed: true, changed_queries: true };
      expect(reported('panel_edit_discarded')).toEqual([{ properties: discardedChanges, options: undefined }]);
      expect(reported('panel_edit_closed')).toEqual([
        { properties: { ...discardedChanges, outcome: 'discarded' }, options: undefined },
      ]);
    });

    it('keeps the areas changed before a save inside the editor in the close event', async () => {
      const { panel, panelEditor } = await setup();

      getQueryRunnerFor(panel)?.setState({ maxDataPoints: 123 });
      panelEditor.dashboardSaved();
      closeEditor();

      expect(reported('panel_edit_closed')[0].properties).toEqual({
        ...NO_CHANGES,
        changed: true,
        changed_queries: true,
        saved_in_editor: true,
        outcome: 'kept',
      });
    });

    it('reports a discard after a save inside the editor with only the areas changed since the save', async () => {
      const { panel, panelEditor } = await setup();

      getQueryRunnerFor(panel)?.setState({ maxDataPoints: 123 });
      panelEditor.dashboardSaved();
      panel.setState({ title: 'changed title' });
      panelEditor.onDiscard();
      closeEditor();

      const discardedChanges = { ...NO_CHANGES, changed: true, changed_panel_info: true, saved_in_editor: true };
      expect(getQueryRunnerFor(panel)?.state.maxDataPoints).toBe(123);
      expect(reported('panel_edit_discarded')).toEqual([{ properties: discardedChanges, options: undefined }]);
      expect(reported('panel_edit_closed')[0].properties).toEqual({ ...discardedChanges, outcome: 'discarded' });
    });

    it('reports saving a library panel from the editor as a library panel saved in the editor', async () => {
      const saveLibPanel = jest.spyOn(libAPI, 'saveLibPanel').mockResolvedValue(undefined);
      try {
        const libraryPanel = new LibraryPanelBehavior({
          uid: 'lib-uid',
          name: 'Library panel',
          isLoaded: true,
          _loadedPanel: { uid: 'lib-uid', name: 'Library panel', type: 'panel', version: 1, model: { type: 'text' } },
        });
        const { panelEditor } = await setup({ libraryPanel });

        panelEditor.onConfirmSaveLibraryPanel();
        closeEditor();

        expect(saveLibPanel).toHaveBeenCalledTimes(1);
        expect(reported('panel_edit_closed')[0].properties).toEqual({
          ...NO_CHANGES,
          saved_in_editor: true,
          is_library_panel: true,
          outcome: 'kept',
        });
      } finally {
        saveLibPanel.mockRestore();
      }
    });

    it('reports a discarded new panel as a new panel with the discarded outcome', async () => {
      const { panelEditor } = await setup({ isNewPanel: true });

      panelEditor.onDiscard();
      closeEditor();

      expect(reported('panel_edit_closed')[0].properties).toEqual({
        ...NO_CHANGES,
        is_new_panel: true,
        outcome: 'discarded',
      });
    });

    it('reports a repeat change made in the editor', async () => {
      const { gridItem } = await setup();

      gridItem.setState({ variableName: 'server' });
      closeEditor();

      expect(reported('panel_edit_closed')[0].properties).toEqual({
        ...NO_CHANGES,
        changed: true,
        changed_repeat: true,
        outcome: 'kept',
      });
    });

    it('reports the next query editor when the panel was edited with it', async () => {
      setTestFlags({ queryEditorNext: true });
      try {
        await setup();

        closeEditor();

        expect(reported('panel_edit_closed')[0].properties).toEqual({
          ...NO_CHANGES,
          query_editor: 'next',
          outcome: 'kept',
        });
      } finally {
        setTestFlags({});
      }
    });

    it('reports a dashboard without dynamic layouts as not dynamic', async () => {
      setTestFlags({ queryEditorNext: false, dashboardNewLayouts: false });
      try {
        await setup();

        closeEditor();

        expect(reported('panel_edit_closed')[0].properties).toEqual({
          ...NO_CHANGES,
          isDynamicDashboard: false,
          outcome: 'kept',
        });
      } finally {
        setTestFlags({});
      }
    });

    it('counts query edits less than two seconds apart as one', async () => {
      const { panelEditor } = await setup();

      panelEditor.recordQueryEdit(10_000);
      panelEditor.recordQueryEdit(11_500);
      panelEditor.recordQueryEdit(13_000);
      panelEditor.recordQueryEdit(15_500);
      closeEditor();

      expect(reported('panel_edit_closed')[0].properties).toEqual({
        ...NO_CHANGES,
        query_change_count: 2,
        outcome: 'kept',
      });
    });

    it('counts a query edit reported by the classic query editor', async () => {
      const { panelEditor } = await setup();
      const { dataPane } = panelEditor.state;
      const queriesTab =
        dataPane instanceof PanelDataPane
          ? dataPane.state.tabs.find((tab) => tab instanceof PanelDataQueriesTab)
          : undefined;
      if (!(queriesTab instanceof PanelDataQueriesTab)) {
        throw new Error('Expected the classic queries tab');
      }

      queriesTab.onQueryEdited();
      closeEditor();

      expect(reported('panel_edit_closed')[0].properties).toMatchObject({ query_change_count: 1 });
    });

    it('counts a query edit reported by the next query editor', async () => {
      setTestFlags({ queryEditorNext: true });
      try {
        const { panelEditor } = await setup();
        const { dataPane } = panelEditor.state;
        if (!(dataPane instanceof PanelDataPaneNext)) {
          throw new Error('Expected the next data pane');
        }

        dataPane.onQueryEdited();
        closeEditor();

        expect(reported('panel_edit_closed')[0].properties).toMatchObject({
          query_change_count: 1,
          query_editor: 'next',
        });
      } finally {
        setTestFlags({});
      }
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

    it('reports clicking Save and Unlink on a library panel from the panel editor', () => {
      const track = jest.spyOn(DashboardInteractions, 'panelActionClicked').mockImplementation();
      const panel = new VizPanel({
        key: 'panel-1',
        pluginId: 'text',
        $behaviors: [new LibraryPanelBehavior({ isLoaded: true, uid: 'uid', name: 'libraryPanelName' })],
      });
      new DashboardGridItem({ body: panel });
      const editScene = buildPanelEditScene(panel);

      editScene.onSaveLibraryPanel();
      editScene.onUnlinkLibraryPanel();

      expect(track.mock.calls).toEqual([
        ['save_library_panel', 1, 'panel_editor', 'text'],
        ['unlink_library_panel', 1, 'panel_editor', 'text'],
      ]);
      track.mockRestore();
    });
  });

  describe('PanelDataPane', () => {
    it('allows reload after default query setup and protects a subsequent query edit', async () => {
      const { panel, panelEditor } = await setup({ pluginId: 'timeseries', withoutData: true });
      const runner = getQueryRunnerFor(panel)!;
      expect(runner.state.queries).toEqual([{ refId: 'A' }]);
      expect(panelEditor.hasUnsavedChangesForReload()).toBe(false);

      runner.setState({ queries: [{ refId: 'A', expression: '2' }] });
      expect(panelEditor.hasUnsavedChangesForReload()).toBe(true);
    });

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
        setTestFlags({ queryEditorNext: true });
      });

      afterEach(() => {
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

      it('should open the next panel edit in the v2 query editor after switching to v1', async () => {
        const { panelEditor } = await setup({ pluginSkipDataQuery: false });
        panelEditor.onToggleQueryEditorVersion();

        const { panelEditor: nextPanelEditor } = await setup({ pluginSkipDataQuery: false });

        expect(nextPanelEditor.state.dataPane).toBeInstanceOf(PanelDataPaneNext);
      });
    });

    describe('when queryEditorNext feature toggle is unresolved', () => {
      beforeEach(() => {
        setTestFlags({});
      });

      it('should fall back to the v2 query editor experience', async () => {
        const { panelEditor } = await setup({ pluginSkipDataQuery: false });

        expect(panelEditor.state.dataPane).toBeInstanceOf(PanelDataPaneNext);
      });
    });

    describe('when queryEditorNext feature toggle is disabled', () => {
      beforeEach(() => {
        setTestFlags({ queryEditorNext: false });
      });

      afterEach(() => {
        setTestFlags({});
      });

      it('should use the v1 query editor experience', async () => {
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
