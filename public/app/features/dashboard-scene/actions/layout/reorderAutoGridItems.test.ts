import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../../scene/layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';

import { reorderAutoGridItems } from './reorderAutoGridItems';

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

function buildTestScene() {
  const itemA = new AutoGridItem({
    key: 'item-a',
    body: new VizPanel({ title: 'A', key: 'panel-a', pluginId: 'table' }),
  });
  const itemB = new AutoGridItem({
    key: 'item-b',
    body: new VizPanel({ title: 'B', key: 'panel-b', pluginId: 'table' }),
  });
  const layout = new AutoGridLayout({ children: [itemA, itemB] });
  const gridManager = new AutoGridLayoutManager({ layout });
  const dashboard = new DashboardScene({ isEditing: true, body: gridManager });

  return { dashboard, layout, itemA, itemB };
}

describe('reorderAutoGridItems', () => {
  let deactivate: (() => void) | undefined;

  afterEach(() => {
    deactivate?.();
    deactivate = undefined;
  });

  describe('when the order changes', () => {
    test('the layout children are updated to the new order', () => {
      const { dashboard, layout, itemA, itemB } = buildTestScene();
      deactivate = activateFullSceneTree(dashboard);

      reorderAutoGridItems({ layout, movedItem: itemA, fromChildren: [itemA, itemB], toChildren: [itemB, itemA] });

      expect(layout.state.children.map((c) => c.state.key)).toEqual(['item-b', 'item-a']);
    });

    test('the moved panel is not selected', () => {
      const { dashboard, layout, itemA, itemB } = buildTestScene();
      deactivate = activateFullSceneTree(dashboard);

      reorderAutoGridItems({ layout, movedItem: itemA, fromChildren: [itemA, itemB], toChildren: [itemB, itemA] });

      expect(dashboard.state.sidebar.getSelectedObject()).toBeUndefined();
    });
  });

  describe('when undo is called after reorderAutoGridItems', () => {
    test('the layout children revert to the original order', () => {
      const { dashboard, layout, itemA, itemB } = buildTestScene();
      deactivate = activateFullSceneTree(dashboard);
      reorderAutoGridItems({ layout, movedItem: itemA, fromChildren: [itemA, itemB], toChildren: [itemB, itemA] });

      dashboard.state.sidebar.undoAction();

      expect(layout.state.children.map((c) => c.state.key)).toEqual(['item-a', 'item-b']);
    });
  });

  describe('when redo is called after undo', () => {
    test('the layout children are reordered again', () => {
      const { dashboard, layout, itemA, itemB } = buildTestScene();
      deactivate = activateFullSceneTree(dashboard);
      reorderAutoGridItems({ layout, movedItem: itemA, fromChildren: [itemA, itemB], toChildren: [itemB, itemA] });
      dashboard.state.sidebar.undoAction();

      dashboard.state.sidebar.redoAction();

      expect(layout.state.children.map((c) => c.state.key)).toEqual(['item-b', 'item-a']);
    });
  });
});
