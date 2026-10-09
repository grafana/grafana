import { DashboardScene } from '../../scene/DashboardScene';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { ObjectsReorderedOnCanvasEvent } from '../../sidebar/events';
import { activateFullSceneTree } from '../../utils/test-utils';

import { reorderRows } from './reorderRows';

it.each([
  { from: 0, to: 2, expected: ['B', 'C', 'A'] },
  { from: 2, to: 0, expected: ['C', 'A', 'B'] },
])('reorders a row from $from to $to as one undoable action', ({ from, to, expected }) => {
  const rows = ['A', 'B', 'C'].map((title) => new RowItem({ title }));
  const layout = new RowsLayoutManager({ rows });
  const dashboard = new DashboardScene({ isEditing: true, body: layout });
  const deactivate = activateFullSceneTree(dashboard);
  const sidebar = dashboard.state.sidebar;
  const onReorder = jest.fn();
  const subscription = layout.subscribeToEvent(ObjectsReorderedOnCanvasEvent, onReorder);

  try {
    layout.forceSelectRow(rows[from].state.key!);
    reorderRows(layout, from, to);

    expect(layout.state.rows.map((row) => row.state.title)).toEqual(expected);
    expect(layout.state.rows[to]).toBe(rows[from]);
    expect(sidebar.state.undoStack).toHaveLength(1);

    sidebar.undoAction();
    expect(layout.state.rows.map((row) => row.state.title)).toEqual(['A', 'B', 'C']);
    rows.forEach((row, index) => expect(layout.state.rows[index]).toBe(row));
    expect(sidebar.state.undoStack).toHaveLength(0);
    expect(sidebar.state.redoStack).toHaveLength(1);

    sidebar.redoAction();
    expect(layout.state.rows.map((row) => row.state.title)).toEqual(expected);
    expect(layout.state.rows[to]).toBe(rows[from]);
    expect(sidebar.state.undoStack).toHaveLength(1);
    expect(sidebar.state.redoStack).toHaveLength(0);
    expect(sidebar.getSelectedObject()).toBe(rows[from]);
    expect(onReorder).toHaveBeenCalledTimes(3);
  } finally {
    subscription.unsubscribe();
    deactivate();
  }
});
