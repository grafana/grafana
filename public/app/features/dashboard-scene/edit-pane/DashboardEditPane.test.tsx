import { getPanelPlugin } from '@grafana/data/test';
import { config, setPluginImportUtils } from '@grafana/runtime';
import { MultiValueVariable, SceneGridLayout, SceneVariableSet, TestVariable, VizPanel } from '@grafana/scenes';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from 'app/features/variables/constants';

import { DashboardScene } from '../scene/DashboardScene';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../scene/layout-rows/RowItem';
import { performRowRepeats } from '../scene/layout-rows/RowItemRepeater';
import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { performTabRepeats } from '../scene/layout-tabs/TabItemRepeater';
import { TabsLayoutManager } from '../scene/layout-tabs/TabsLayoutManager';
import { DashboardLayoutManager } from '../scene/types/DashboardLayoutManager';
import { activateFullSceneTree } from '../utils/test-utils';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => {
    return {
      getInstanceSettings: (uid: string) => ({}),
    };
  },
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

  config.featureToggles.dashboardNewLayouts = true;

  activateFullSceneTree(scene);

  return {
    variables,
    editPane: scene.state.editPane,
  };
}
