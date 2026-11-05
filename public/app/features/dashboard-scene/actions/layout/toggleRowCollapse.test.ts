import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';

import { toggleRowCollapse } from './toggleRowCollapse';

function setup(collapse?: boolean) {
  const row = new RowItem({ title: 'A', collapse, layout: AutoGridLayoutManager.createEmpty() });
  const dashboard = new DashboardScene({ isEditing: true, body: new RowsLayoutManager({ rows: [row] }) });
  const deactivate = activateFullSceneTree(dashboard);

  return { row, sidebar: dashboard.state.sidebar, deactivate };
}

it('collapses a row as one undoable action', () => {
  const { row, sidebar, deactivate } = setup();

  toggleRowCollapse(row);
  expect(row.state.collapse).toBe(true);
  expect(sidebar.state.undoStack).toHaveLength(1);

  sidebar.undoAction();
  expect(row.state.collapse).toBeUndefined();

  sidebar.redoAction();
  expect(row.state.collapse).toBe(true);

  deactivate();
});

it('expands a row as one undoable action', () => {
  const { row, sidebar, deactivate } = setup(true);

  toggleRowCollapse(row);
  expect(row.state.collapse).toBe(false);

  sidebar.undoAction();
  expect(row.state.collapse).toBe(true);

  sidebar.redoAction();
  expect(row.state.collapse).toBe(false);

  deactivate();
});
