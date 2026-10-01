import { testWithFeatureToggles } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneGridLayout, SceneGridRow, SceneQueryRunner, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { findVizPanelByKey } from '../../utils/findVizPanel';
import { activateFullSceneTree } from '../../utils/test-utils';

import { duplicateDefaultGridPanel } from './duplicateDefaultGridPanel';

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

describe('duplicateDefaultGridPanel', () => {
  testWithFeatureToggles({ enable: ['dashboardNewLayouts'] });
  let deactivate: () => void;

  function setup() {
    const panel = new VizPanel({
      key: 'panel-1',
      title: 'Panel',
      pluginId: 'table',
      $data: new SceneQueryRunner({ queries: [{ refId: 'A' }], runQueriesMode: 'manual' }),
    });
    const item = new DashboardGridItem({ key: 'grid-item-1', body: panel, x: 0, y: 0, width: 12, height: 8 });
    const sibling = new DashboardGridItem({
      key: 'grid-item-2',
      body: new VizPanel({ key: 'panel-2', pluginId: 'table' }),
    });
    const grid = new SceneGridLayout({ children: [item, sibling] });
    const manager = new DefaultGridLayoutManager({ grid });
    const dashboard = new DashboardScene({ isEditing: true, body: manager });
    deactivate = activateFullSceneTree(dashboard);
    return { panel, item, sibling, grid, manager, sidebar: dashboard.state.sidebar };
  }

  afterEach(() => deactivate?.());

  it('inserts a clone after the source and records one duplicate action', () => {
    const { panel, grid, manager, sidebar } = setup();

    duplicateDefaultGridPanel(manager, panel);

    expect(grid.state.children.map((child) => child.state.key)).toEqual(['grid-item-1', 'grid-item-3', 'grid-item-2']);
    const duplicate = grid.state.children[1] as DashboardGridItem;
    expect(duplicate.state).toMatchObject({ x: 0, y: 0, width: 12, height: 8, itemHeight: 8 });
    expect(duplicate.state.body.state).toMatchObject({ key: 'panel-3', title: 'Panel' });
    expect(duplicate.state.body.state.$data).not.toBe(panel.state.$data);
    expect(sidebar.getSelectedObject()).toBe(duplicate.state.body);
    expect(sidebar.state.undoStack.map((action) => action.description)).toEqual(['Duplicate panel']);
  });

  it('restores the original children on undo', () => {
    const { panel, item, sibling, grid, manager, sidebar } = setup();
    duplicateDefaultGridPanel(manager, panel);

    sidebar.undoAction();

    expect(grid.state.children).toEqual([item, sibling]);
    expect(sidebar.getSelectedObject()).toBeUndefined();
    expect(sidebar.state.undoStack).toEqual([]);
  });

  it('restores the same duplicate on redo', () => {
    const { panel, grid, manager, sidebar } = setup();
    duplicateDefaultGridPanel(manager, panel);
    const duplicate = grid.state.children[1] as DashboardGridItem;
    sidebar.undoAction();

    sidebar.redoAction();

    expect(grid.state.children.map((child) => child.state.key)).toEqual(['grid-item-1', 'grid-item-3', 'grid-item-2']);
    expect(grid.state.children[1]).toBe(duplicate);
    expect(sidebar.getSelectedObject()).toBe(duplicate.state.body);
    expect(sidebar.state.undoStack.map((action) => action.description)).toEqual(['Duplicate panel']);
    expect(sidebar.state.redoStack).toEqual([]);
  });
});

describe('legacy duplication', () => {
  testWithFeatureToggles({ disable: ['dashboardNewLayouts'] });
  describe('duplicatePanel', () => {
    it('Should duplicate a panel', () => {
      const { manager, grid } = setupLegacy();
      const vizPanel = findVizPanelByKey(manager, 'panel-1')!;

      expect(grid.state.children.length).toBe(3);

      duplicateDefaultGridPanel(manager, vizPanel);

      const newGridItem = grid.state.children[3];

      expect(grid.state.children.length).toBe(4);
      expect(newGridItem.state.key).toBe('grid-item-4');
    });

    it('Should maintain size of duplicated panel', () => {
      const { manager, grid } = setupLegacy();

      const gItem = grid.state.children[0] as DashboardGridItem;
      gItem.setState({ height: 1 });

      const vizPanel = gItem.state.body;
      duplicateDefaultGridPanel(manager, vizPanel);

      const newGridItem = grid.state.children[grid.state.children.length - 1] as DashboardGridItem;

      expect(newGridItem.state.height).toBe(1);
      expect(newGridItem.state.itemHeight).toBe(1);
    });

    it('Should duplicate a repeated panel', () => {
      const { manager, grid } = setupLegacy();
      const gItem = grid.state.children[0] as DashboardGridItem;
      gItem.setState({ variableName: 'server', repeatDirection: 'v', maxPerRow: 100 });
      const vizPanel = gItem.state.body;
      duplicateDefaultGridPanel(manager, vizPanel as VizPanel);

      const newGridItem = grid.state.children[grid.state.children.length - 1] as DashboardGridItem;

      expect(newGridItem.state.variableName).toBe('server');
      expect(newGridItem.state.repeatDirection).toBe('v');
      expect(newGridItem.state.maxPerRow).toBe(100);
    });

    it('Should duplicate a panel in a row', () => {
      const { manager } = setupLegacy();
      const vizPanel = findVizPanelByKey(manager, 'panel-within-row1')!;
      const gridRow = vizPanel.parent?.parent as SceneGridRow;

      expect(gridRow.state.children.length).toBe(2);

      duplicateDefaultGridPanel(manager, vizPanel);

      expect(gridRow.state.children.length).toBe(3);
    });

    it('Should carry over the plugin transformations opt-in', () => {
      // The duplicate is built from live panel state rather than from a save model, which is why
      // this is the one panel-building path that does not read the rollout flag itself.
      const { manager, grid } = setupLegacy();
      const gItem = grid.state.children[0] as DashboardGridItem;
      gItem.state.body.setState({ applyPluginTransformations: true });

      duplicateDefaultGridPanel(manager, gItem.state.body);

      const newGridItem = grid.state.children[grid.state.children.length - 1] as DashboardGridItem;

      expect(newGridItem.state.body.state.applyPluginTransformations).toBe(true);
    });
  });
});

function setupLegacy() {
  const gridItems = [
    new DashboardGridItem({
      key: 'griditem-1',
      x: 0,
      body: new VizPanel({
        title: 'Panel A',
        key: 'panel-1',
        pluginId: 'table',
        $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
      }),
    }),
    new DashboardGridItem({
      key: 'griditem-2',
      body: new VizPanel({
        title: 'Panel B',
        key: 'panel-2',
        pluginId: 'table',
      }),
    }),
    new SceneGridRow({
      key: 'panel-3',
      title: 'row',
      children: [
        new DashboardGridItem({
          body: new VizPanel({
            title: 'Panel C',
            key: 'panel-within-row1',
            pluginId: 'table',
          }),
        }),
        new DashboardGridItem({
          body: new VizPanel({
            title: 'Panel D',
            key: 'panel-within-row2',
            pluginId: 'table',
          }),
        }),
      ],
    }),
  ];

  const grid = new SceneGridLayout({ children: gridItems });
  const manager = new DefaultGridLayoutManager({ grid: grid });

  new DashboardScene({ body: manager });

  return { manager, grid };
}
