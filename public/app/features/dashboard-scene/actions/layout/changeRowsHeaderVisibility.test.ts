import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowItems } from '../../scene/layout-rows/RowItems';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';

function setup() {
  const rows = [
    new RowItem({ title: 'A', layout: AutoGridLayoutManager.createEmpty() }),
    new RowItem({ title: 'B', hideHeader: true, layout: AutoGridLayoutManager.createEmpty() }),
  ];
  const dashboard = new DashboardScene({ isEditing: true, body: new RowsLayoutManager({ rows }) });
  const deactivate = activateFullSceneTree(dashboard);

  return { rows, dashboard, sidebar: dashboard.state.sidebar, deactivate };
}

it('hides headers of multiple selected rows as one undoable action', () => {
  const { rows, dashboard, sidebar, deactivate } = setup();

  new RowItems(rows, dashboard).onHeaderHiddenToggle(true, true);
  expect(rows.map((row) => row.state.hideHeader)).toEqual([true, true]);
  expect(sidebar.state.undoStack).toHaveLength(1);

  sidebar.undoAction();
  expect(rows.map((row) => row.state.hideHeader)).toEqual([undefined, true]);

  sidebar.redoAction();
  expect(rows.map((row) => row.state.hideHeader)).toEqual([true, true]);

  deactivate();
});
