import { getPanelPlugin } from '@grafana/data/test';
import { config, setPluginImportUtils } from '@grafana/runtime';
import {
  ConstantVariable,
  type MultiValueVariable,
  SceneGridLayout,
  SceneTimeRange,
  SceneVariableSet,
  TestVariable,
  VizPanel,
} from '@grafana/scenes';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from 'app/features/variables/constants';

import { DashboardScene } from '../scene/DashboardScene';
import { AutoGridItem } from '../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../scene/layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../scene/layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../scene/layout-rows/RowItem';
import { performRowRepeats } from '../scene/layout-rows/RowItemRepeater';
import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { performTabRepeats } from '../scene/layout-tabs/TabItemRepeater';
import { TabsLayoutManager } from '../scene/layout-tabs/TabsLayoutManager';
import { type DashboardLayoutManager } from '../scene/types/DashboardLayoutManager';
import { activateFullSceneTree } from '../utils/test-utils';

import { type DashboardEditPane } from './DashboardEditPane';
import { dashboardEditActions } from './shared';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: (_uid: string | null) => ({ uid: 'ds1' }),
  }),
}));

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

describe('DashboardEditPane', () => {
  it('Handles edit action events that adds objects', () => {
    const scene = buildTestScene();
    const editPane = scene.state.editPane;

    scene.onCreateNewPanel();

    expect(editPane.state.undoStack).toHaveLength(1);

    // Should select object
    expect(editPane.getSelection()).toBeDefined();

    editPane.undoAction();

    expect(editPane.state.undoStack).toHaveLength(0);

    // should clear selection
    expect(editPane.getSelection()).toBeUndefined();
  });

  it('when new action comes in clears redo stack', () => {
    const scene = buildTestScene();
    const editPane = scene.state.editPane;

    scene.onCreateNewPanel();

    editPane.undoAction();

    expect(editPane.state.redoStack).toHaveLength(1);

    scene.onCreateNewPanel();

    expect(editPane.state.redoStack).toHaveLength(0);
  });

  it('clone should not include undo/redo history', () => {
    const scene = buildTestScene();
    const editPane = scene.state.editPane;

    scene.onCreateNewPanel();
    scene.onCreateNewPanel();

    editPane.undoAction();

    expect(editPane.state.redoStack).toHaveLength(1);
    expect(editPane.state.undoStack).toHaveLength(1);

    const cloned = editPane.clone({});

    expect(cloned.state.redoStack).toHaveLength(0);
    expect(cloned.state.undoStack).toHaveLength(0);
  });

  it('keeps the variable selected when undoing and redoing variable type changes', () => {
    const variable = new TestVariable({
      name: 'service',
      delayMs: 0,
      value: 'prod',
      text: 'prod',
      optionsToReturn: [{ label: 'prod', value: 'prod' }],
    });
    const variableSet = new SceneVariableSet({ variables: [variable] });
    const dashboard = new DashboardScene({
      $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      $variables: variableSet,
      isEditing: true,
      body: AutoGridLayoutManager.createEmpty(),
    });

    activateFullSceneTree(dashboard);

    const editPane = dashboard.state.editPane;
    editPane.selectObject(variable, variable.state.key!, { force: true });

    const changedVariable = new ConstantVariable({ name: 'service' });
    dashboardEditActions.changeVariableType({
      source: variableSet,
      oldVariable: variable,
      newVariable: changedVariable,
    });

    expect(variableSet.state.variables[0]).toBe(changedVariable);
    expect(editPane.getSelection()).toBe(changedVariable);

    editPane.undoAction();

    expect(variableSet.state.variables[0]).toBe(variable);
    expect(editPane.getSelection()).toBe(variable);

    editPane.redoAction();

    expect(variableSet.state.variables[0]).toBe(changedVariable);
    expect(editPane.getSelection()).toBe(changedVariable);
  });

  describe('Selecting repeated elements', () => {
    it('Selecting a repeated panel selects the source panel', () => {
      const layoutManager = new DefaultGridLayoutManager({
        grid: new SceneGridLayout({
          children: [
            new DashboardGridItem({
              variableName: 'env',
              repeatedPanels: [],
              body: new VizPanel({
                key: 'panel-1',
                title: 'Panel $env',
                pluginId: 'table',
              }),
            }),
          ],
        }),
      });

      const { editPane } = buildTestSceneWithRepeat(layoutManager);
      editPane.enableSelection();

      const gridItems = layoutManager.state.grid.state.children as DashboardGridItem[];
      const sourcePanel = gridItems[0].state.body;
      // DashboardGridItem performs repeats during activation, so repeatedPanels is already populated
      const [clonePanel] = gridItems[0].state.repeatedPanels!;

      expect(clonePanel.state.repeatSourceKey).toBe(sourcePanel.state.key);

      editPane.state.selectionContext.onSelect({ id: clonePanel.state.key! }, {});

      expect(editPane.getSelection()).toBe(sourcePanel);
    });

    it('Selecting a repeated tab inside a repeated row selects the source tab', () => {
      const layoutManager = new RowsLayoutManager({
        rows: [
          new RowItem({
            key: 'row-1',
            title: 'Row $env',
            repeatByVariable: 'env',
            layout: new TabsLayoutManager({
              tabs: [
                new TabItem({
                  key: 'tab-1',
                  title: 'Tab $region',
                  repeatByVariable: 'region',
                }),
              ],
            }),
          }),
        ],
      });
      const { editPane, variables } = buildTestSceneWithRepeat(layoutManager);
      editPane.enableSelection();

      const [sourceRow] = layoutManager.state.rows;
      const [sourceTab] = (sourceRow.state.layout as TabsLayoutManager).state.tabs;

      // unlike DashboardGridItem which repeats during activation, row/tab repeats
      // are triggered by React useEffect in RowItemRepeater/TabItemRepeater
      // since this test activates the scene tree without rendering, we call them manually
      performRowRepeats(variables[0], sourceRow, false);
      const [clonedRow] = sourceRow.state.repeatedRows!;
      expect(clonedRow.state.repeatSourceKey).toBe(sourceRow.state.key);

      performTabRepeats(variables[1], sourceTab, false);
      const [clonedTabInSourceRow] = sourceTab.state.repeatedTabs!;
      expect(clonedTabInSourceRow.state.repeatSourceKey).toBe(sourceTab.state.key);

      const clonedRowTabsLayout = clonedRow.state.layout as TabsLayoutManager;
      const [tabInClonedRow] = clonedRowTabsLayout.state.tabs;

      performTabRepeats(variables[1], tabInClonedRow, false);
      const [clonedTabInClonedRow] = tabInClonedRow.state.repeatedTabs!;
      expect(clonedTabInClonedRow.state.repeatSourceKey).toBe(sourceTab.state.key);

      editPane.state.selectionContext.onSelect({ id: clonedTabInClonedRow.state.key! }, {});

      expect(editPane.getSelection()).toBe(sourceTab);
    });
  });

  describe('addNewPanel', () => {
    it('adds panel to the correct tab layout when target is first tab', () => {
      const { tab1, tab2, editPane } = setupWithTwoTabs();
      editPane.addNewPanel(tab1);
      expect(tab1.getLayout().getVizPanels()).toHaveLength(2);
      expect(tab2.getLayout().getVizPanels()).toHaveLength(0);
    });

    it('adds panel to the correct tab layout when target is second tab', () => {
      const { tab1, tab2, editPane } = setupWithTwoTabs();
      editPane.addNewPanel(tab2);
      expect(tab1.getLayout().getVizPanels()).toHaveLength(1);
      expect(tab2.getLayout().getVizPanels()).toHaveLength(1);
    });

    it('adds panel to the correct row layout when target is first row', () => {
      const { row1, row2, editPane } = setupWithTwoRows();
      editPane.addNewPanel(row1);
      expect(row1.getLayout().getVizPanels()).toHaveLength(2);
      expect(row2.getLayout().getVizPanels()).toHaveLength(0);
    });

    it('adds panel to the correct row layout when target is second row', () => {
      const { row1, row2, editPane } = setupWithTwoRows();
      editPane.addNewPanel(row2);
      expect(row1.getLayout().getVizPanels()).toHaveLength(1);
      expect(row2.getLayout().getVizPanels()).toHaveLength(1);
    });

    it('adds panel to the first element in the dashboard when target is the dashboard itself', () => {
      const { dashboard, tab1, tab2, editPane } = setupWithTwoTabs();
      editPane.addNewPanel(dashboard);
      expect(tab1.getLayout().getVizPanels()).toHaveLength(2);
      expect(tab2.getLayout().getVizPanels()).toHaveLength(0);
    });

    it('adds panel to the first element in the dashboard when target is undefined', () => {
      const { tab1, tab2, editPane } = setupWithTwoTabs();
      editPane.addNewPanel(undefined);
      expect(tab1.getLayout().getVizPanels()).toHaveLength(2);
      expect(tab2.getLayout().getVizPanels()).toHaveLength(0);
    });

    it('adds panel to the dashboard when dashboard is empty', () => {
      const { dashboard, editPane } = setupEmptyDashboard();
      editPane.addNewPanel(undefined);
      expect(dashboard.getLayout().getVizPanels()).toHaveLength(1);
    });
  });

  describe('pastePanel', () => {
    it('adds pasted panel to the correct tab layout when target is first tab', () => {
      const { dashboard, tab1, tab2, tab1Viz, editPane } = setupWithTwoTabs();
      dashboard.copyPanel(tab1Viz);
      editPane.pastePanel(tab1);
      expect(tab1.getLayout().getVizPanels()).toHaveLength(2);
      expect(tab2.getLayout().getVizPanels()).toHaveLength(0);
    });

    it('adds pasted panel to the correct tab layout when target is second tab', () => {
      const { dashboard, tab1, tab2, tab1Viz, editPane } = setupWithTwoTabs();
      dashboard.copyPanel(tab1Viz);
      editPane.pastePanel(tab2);
      expect(tab1.getLayout().getVizPanels()).toHaveLength(1);
      expect(tab2.getLayout().getVizPanels()).toHaveLength(1);
    });

    it('adds pasted panel to the correct row layout when target is first row', () => {
      const { dashboard, row1, row2, row1Viz, editPane } = setupWithTwoRows();
      dashboard.copyPanel(row1Viz);
      editPane.pastePanel(row1);
      expect(row1.getLayout().getVizPanels()).toHaveLength(2);
      expect(row2.getLayout().getVizPanels()).toHaveLength(0);
    });

    it('adds pasted panel to the correct row layout when target is second row', () => {
      const { dashboard, row1, row2, row1Viz, editPane } = setupWithTwoRows();
      dashboard.copyPanel(row1Viz);
      editPane.pastePanel(row2);
      expect(row1.getLayout().getVizPanels()).toHaveLength(1);
      expect(row2.getLayout().getVizPanels()).toHaveLength(1);
    });

    it('adds pasted panel to the first element in the dashboard when target is the dashboard itself', () => {
      const { dashboard, tab1, tab2, editPane } = setupWithTwoTabs();
      dashboard.copyPanel(tab1.getLayout().getVizPanels()[0]);
      editPane.pastePanel(dashboard);
      expect(tab1.getLayout().getVizPanels()).toHaveLength(2);
      expect(tab2.getLayout().getVizPanels()).toHaveLength(0);
    });

    it('adds pasted panel to the first element in the dashboard when target is undefined', () => {
      const { dashboard, tab1, tab2, editPane } = setupWithTwoTabs();
      dashboard.copyPanel(tab1.getLayout().getVizPanels()[0]);
      editPane.pastePanel(undefined);
      expect(tab1.getLayout().getVizPanels()).toHaveLength(2);
      expect(tab2.getLayout().getVizPanels()).toHaveLength(0);
    });

    it('preserves the source panel config when pasting with target undefined into a RowsLayout dashboard', () => {
      const { dashboard, row1, row2, row1Viz, editPane } = setupWithTwoRows();
      dashboard.copyPanel(row1Viz);

      editPane.pastePanel(undefined);

      const row1Panels = row1.getLayout().getVizPanels();
      expect(row1Panels).toHaveLength(2);
      expect(row2.getLayout().getVizPanels()).toHaveLength(0);

      const pastedPanel = row1Panels[row1Panels.length - 1];
      expect(pastedPanel.state.pluginId).toBe(row1Viz.state.pluginId);
      expect(pastedPanel.state.title).toBe(row1Viz.state.title);
    });

    it('preserves the source panel config when pasting with target undefined into a TabsLayout dashboard', () => {
      const { dashboard, tab1, tab2, tab1Viz, editPane } = setupWithTwoTabs();
      dashboard.copyPanel(tab1Viz);

      editPane.pastePanel(undefined);

      const tab1Panels = tab1.getLayout().getVizPanels();
      expect(tab1Panels).toHaveLength(2);
      expect(tab2.getLayout().getVizPanels()).toHaveLength(0);

      const pastedPanel = tab1Panels[tab1Panels.length - 1];
      expect(pastedPanel.state.pluginId).toBe(tab1Viz.state.pluginId);
      expect(pastedPanel.state.title).toBe(tab1Viz.state.title);
    });

    it('adds pasted panel to the dashboard when dashboard is empty', () => {
      const { dashboard, editPane } = setupEmptyDashboard();
      const panel = new VizPanel({ key: 'panel-1', pluginId: 'text', title: 'P1' });
      const gridItem = new AutoGridItem({ body: panel });
      const layoutWithPanel = new AutoGridLayoutManager({
        layout: new AutoGridLayout({ children: [gridItem] }),
      });
      const tabWithPanel = new TabItem({ title: 'Source', layout: layoutWithPanel });
      const sourceDashboard = new DashboardScene({
        $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
        isEditing: true,
        body: new TabsLayoutManager({ tabs: [tabWithPanel] }),
      });
      config.featureToggles.dashboardNewLayouts = true;
      activateFullSceneTree(sourceDashboard);
      sourceDashboard.copyPanel(panel);

      editPane.pastePanel(dashboard);
      expect(dashboard.getLayout().getVizPanels()).toHaveLength(1);
    });
  });
});

function buildTestScene() {
  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    description: 'hello description',
    tags: ['tag1', 'tag2'],
    editable: true,
  });
  config.featureToggles.dashboardNewLayouts = true;
  activateFullSceneTree(scene);

  return scene;
}

function buildTestSceneWithRepeat(layoutManager: DashboardLayoutManager) {
  const variables = [
    new TestVariable({
      name: 'env',
      query: 'A.*',
      value: ALL_VARIABLE_VALUE,
      text: ALL_VARIABLE_TEXT,
      isMulti: true,
      includeAll: true,
      delayMs: 0,
      optionsToReturn: [
        { label: 'test', value: 'test' },
        { label: 'production', value: 'production' },
      ],
    }),
    new TestVariable({
      name: 'region',
      query: 'A.*',
      value: ALL_VARIABLE_VALUE,
      text: ALL_VARIABLE_TEXT,
      isMulti: true,
      includeAll: true,
      delayMs: 0,
      optionsToReturn: [
        { label: 'us', value: 'us' },
        { label: 'eu', value: 'eu' },
      ],
    }),
  ] as unknown as MultiValueVariable[];

  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    editable: true,
    $variables: new SceneVariableSet({ variables }),
    body: layoutManager,
  });

  activateFullSceneTree(scene);

  return {
    variables,
    editPane: scene.state.editPane,
  };
}

function setupEmptyDashboard(): {
  dashboard: DashboardScene;
  editPane: DashboardEditPane;
} {
  const dashboard = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    isEditing: true,
    body: AutoGridLayoutManager.createEmpty(),
  });
  config.featureToggles.dashboardNewLayouts = true;
  activateFullSceneTree(dashboard);
  return { dashboard, editPane: dashboard.state.editPane };
}

function setupWithTwoTabs(): {
  dashboard: DashboardScene;
  tab1: TabItem;
  tab2: TabItem;
  tab1Viz: VizPanel;
  editPane: DashboardEditPane;
} {
  const panel = new VizPanel({ key: 'panel-1', pluginId: 'text', title: 'P1' });
  const gridItem = new AutoGridItem({ body: panel });
  const layoutWithPanel = new AutoGridLayoutManager({
    layout: new AutoGridLayout({ children: [gridItem] }),
  });
  const tab1 = new TabItem({ title: 'Tab 1', layout: layoutWithPanel });
  const tab2 = new TabItem({ title: 'Tab 2' });
  const dashboard = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    isEditing: true,
    body: new TabsLayoutManager({ tabs: [tab1, tab2] }),
  });
  config.featureToggles.dashboardNewLayouts = true;
  activateFullSceneTree(dashboard);
  return { dashboard, tab1, tab2, tab1Viz: panel, editPane: dashboard.state.editPane };
}

function setupWithTwoRows(): {
  dashboard: DashboardScene;
  row1: RowItem;
  row2: RowItem;
  row1Viz: VizPanel;
  editPane: DashboardEditPane;
} {
  const panel = new VizPanel({ key: 'panel-1', pluginId: 'text', title: 'P1' });
  const gridItem = new AutoGridItem({ body: panel });
  const layoutWithPanel = new AutoGridLayoutManager({
    layout: new AutoGridLayout({ children: [gridItem] }),
  });
  const row1 = new RowItem({ title: 'Row 1', layout: layoutWithPanel });
  const row2 = new RowItem({ title: 'Row 2' });
  const dashboard = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    isEditing: true,
    body: new RowsLayoutManager({ rows: [row1, row2] }),
  });
  config.featureToggles.dashboardNewLayouts = true;
  activateFullSceneTree(dashboard);
  return { dashboard, row1, row2, row1Viz: panel, editPane: dashboard.state.editPane };
}
