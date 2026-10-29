import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';

import { moveRowToRowsLayout } from './moveRowToRowsLayout';

describe('moveRowToRowsLayout', () => {
  let deactivate: () => void;
  afterEach(() => deactivate?.());

  it('inserts the row at the given position, renaming it when the title is taken, and undoes both', () => {
    const row = new RowItem({ title: 'Other' });
    const nested = new RowsLayoutManager({ rows: [new RowItem({ title: 'First' }), new RowItem({ title: 'Other' })] });
    const holder = new RowItem({ title: 'Holder', layout: nested });
    const source = new RowsLayoutManager({ rows: [row, holder] });
    const dashboard = new DashboardScene({ isEditing: true, body: source });
    deactivate = activateFullSceneTree(dashboard);
    const sidebar = dashboard.state.sidebar;

    moveRowToRowsLayout({ row, source, destination: nested, index: 1 });
    expect(titles(nested)).toEqual(['First', 'Other 1', 'Other']);
    expect(row.parent).toBe(nested);
    expect(titles(source)).toEqual(['Holder']);
    expect(sidebar.state.undoStack).toHaveLength(1);

    sidebar.undoAction();
    expect(titles(nested)).toEqual(['First', 'Other']);
    expect(titles(source)).toEqual(['Other', 'Holder']);
    expect(row.parent).toBe(source);

    sidebar.redoAction();
    expect(titles(nested)).toEqual(['First', 'Other 1', 'Other']);
  });

  it('leaves an empty grid where the last row of a nested rows layout was, and puts the rows back on undo', () => {
    const row = new RowItem({ title: 'Moved' });
    const nested = new RowsLayoutManager({ rows: [row] });
    const holder = new RowItem({ title: 'Holder', layout: nested });
    const destination = new RowsLayoutManager({ rows: [holder] });
    const dashboard = new DashboardScene({ isEditing: true, body: destination });
    deactivate = activateFullSceneTree(dashboard);
    const sidebar = dashboard.state.sidebar;

    moveRowToRowsLayout({ row, source: nested, destination, index: 0 });
    expect(titles(destination)).toEqual(['Moved', 'Holder']);
    expect(holder.getLayout()).toBeInstanceOf(AutoGridLayoutManager);

    sidebar.undoAction();
    expect(holder.getLayout()).toBe(nested);
    expect(titles(nested)).toEqual(['Moved']);
    expect(titles(destination)).toEqual(['Holder']);
  });
});

function titles(layout: RowsLayoutManager) {
  return layout.state.rows.map((row) => row.state.title);
}
