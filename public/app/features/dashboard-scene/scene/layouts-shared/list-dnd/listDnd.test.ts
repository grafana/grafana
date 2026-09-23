import { DashboardScene } from '../../DashboardScene';
import { AutoGridLayoutManager } from '../../layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../../layout-rows/RowItem';
import { RowsLayoutManager } from '../../layout-rows/RowsLayoutManager';
import { TabItem } from '../../layout-tabs/TabItem';
import { TabsLayoutManager } from '../../layout-tabs/TabsLayoutManager';

import { canDropInto, canGroupIntoTab, getInsertIndex } from './listDnd';
import { getListDragPreview } from './useListDragPreview';

describe('getInsertIndex', () => {
  const items = [
    { start: 0, end: 100 },
    { start: 110, end: 210 },
  ];

  it('inserts before the first item whose midpoint is past the pointer', () => {
    expect(getInsertIndex(items, 10)).toBe(0);
    expect(getInsertIndex(items, 60)).toBe(1);
    expect(getInsertIndex(items, 170)).toBe(2);
  });

  it('appends to an empty list', () => {
    expect(getInsertIndex([], 50)).toBe(0);
  });
});

describe('canDropInto', () => {
  function nestedScene() {
    const innerRows = new RowsLayoutManager({ rows: [new RowItem({ title: 'Inner' })] });
    const outerRow = new RowItem({ title: 'Outer', layout: innerRows });
    const topRows = new RowsLayoutManager({ rows: [outerRow, new RowItem({ title: 'Other' })] });
    const tabs = new TabsLayoutManager({ tabs: [new TabItem({ title: 'Tab' })] });
    new DashboardScene({ body: topRows });
    return { innerRows, outerRow, topRows, tabs };
  }

  it('only accepts rows into rows and tabs into tabs', () => {
    const { topRows, tabs } = nestedScene();
    expect(canDropInto(new TabItem({ title: 'T' }), topRows)).toBe(false);
    expect(canDropInto(new RowItem({ title: 'R' }), tabs)).toBe(false);
  });

  it('does not accept a row into rows nested inside it', () => {
    const { innerRows, outerRow } = nestedScene();
    expect(canDropInto(outerRow, innerRows)).toBe(false);
  });

  it('accepts a row into nested rows when it stays within the nesting limit', () => {
    const { innerRows, topRows } = nestedScene();
    expect(canDropInto(topRows.state.rows[1], innerRows)).toBe(true);
  });

  it('rejects moves that would go past the maximum nesting depth', () => {
    // A row holding three more levels of groups can't go one level deeper than the top level
    const deepRow = new RowItem({
      title: 'Deep',
      layout: new TabsLayoutManager({
        tabs: [
          new TabItem({
            title: 'T',
            layout: new RowsLayoutManager({
              rows: [
                new RowItem({ title: 'R', layout: new TabsLayoutManager({ tabs: [new TabItem({ title: 'T2' })] }) }),
              ],
            }),
          }),
        ],
      }),
    });
    const { innerRows, topRows } = nestedScene();
    topRows.setState({ rows: [...topRows.state.rows, deepRow] });

    expect(canDropInto(deepRow, innerRows)).toBe(false);
    expect(canDropInto(deepRow, topRows)).toBe(true);
  });

  it('accepts a row into a rows layout inside a tab', () => {
    const rows = new RowsLayoutManager({ rows: [new RowItem({ title: 'In tab' })] });
    new DashboardScene({ body: new TabsLayoutManager({ tabs: [new TabItem({ title: 'Tab', layout: rows })] }) });
    const row = new RowItem({ title: 'Moved', layout: AutoGridLayoutManager.createEmpty() });
    new DashboardScene({ body: new RowsLayoutManager({ rows: [row] }) });

    expect(canDropInto(row, rows)).toBe(true);
  });
});

describe('canGroupIntoTab', () => {
  it('accepts a row on a tab whose content is a grid', () => {
    const tab = new TabItem({ title: 'Grid tab', layout: AutoGridLayoutManager.createEmpty() });
    const row = new RowItem({ title: 'Row' });
    new DashboardScene({
      body: new RowsLayoutManager({
        rows: [row, new RowItem({ title: 'Tabs', layout: new TabsLayoutManager({ tabs: [tab] }) })],
      }),
    });

    expect(canGroupIntoTab(row, tab)).toBe(true);
  });

  it('does not group a tab that already has rows, those are a list drop instead', () => {
    const tab = new TabItem({ title: 'Rows tab', layout: new RowsLayoutManager({ rows: [new RowItem({})] }) });
    new DashboardScene({ body: new TabsLayoutManager({ tabs: [tab] }) });

    expect(canGroupIntoTab(new RowItem({ title: 'Row' }), tab)).toBe(false);
  });

  it('does not group a tab inside the dragged row', () => {
    const tab = new TabItem({ title: 'Inner', layout: AutoGridLayoutManager.createEmpty() });
    const row = new RowItem({ title: 'Row', layout: new TabsLayoutManager({ tabs: [tab] }) });
    new DashboardScene({ body: new RowsLayoutManager({ rows: [row] }) });

    expect(canGroupIntoTab(row, tab)).toBe(false);
  });
});

describe('getListDragPreview', () => {
  const items = ['a', 'b', 'c'].map((key) => ({ state: { key } }));
  const list = new RowsLayoutManager({ key: 'list', rows: [] });
  const other = new RowsLayoutManager({ key: 'other', rows: [] });
  const size = { width: 100, height: 40 };

  it('renders the items as they are when nothing is dragged', () => {
    expect(getListDragPreview(null, 'list', items).items).toBe(items);
  });

  it('moves the dragged item to its drop position within its own list', () => {
    const preview = getListDragPreview(
      { itemKey: 'a', sourceListKey: 'list', target: { kind: 'list', list, index: 2 }, placeholderSize: size },
      'list',
      items
    );
    expect(preview.items.map((i) => i.state.key)).toEqual(['b', 'c', 'a']);
    expect(preview.draggingKey).toBe('a');
    expect(preview.placeholderIndex).toBeNull();
  });

  it('keeps the source list in its original order while the item is over another list', () => {
    const preview = getListDragPreview(
      { itemKey: 'a', sourceListKey: 'list', target: { kind: 'list', list: other, index: 0 }, placeholderSize: size },
      'list',
      items
    );
    expect(preview.items).toBe(items);
    expect(preview.draggingKey).toBe('a');
  });

  it('shows a placeholder in the list the item is dragged into', () => {
    const preview = getListDragPreview(
      { itemKey: 'z', sourceListKey: 'other', target: { kind: 'list', list, index: 1 }, placeholderSize: size },
      'list',
      items
    );
    expect(preview.placeholderIndex).toBe(1);
    expect(preview.placeholderSize).toBe(size);
    expect(preview.draggingKey).toBeNull();
  });
});
