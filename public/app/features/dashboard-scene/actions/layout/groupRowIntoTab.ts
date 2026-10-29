import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { type TabItem } from '../../scene/layout-tabs/TabItem';
import { generateUniqueTitle } from '../../scene/layouts-shared/utils';
import { isLayoutParent } from '../../scene/types/LayoutParent';
import { ObjectsReorderedOnCanvasEvent } from '../../sidebar/events';
import { getDashboardSceneFor } from '../../utils/utils';
import { moveElement } from '../element/moveElement';

/**
 * Moves a row into a tab whose content isn't rows: the tab gets a rows layout with its current
 * content in a new first row and the moved row after it.
 *
 * The tab's layout object goes into the new row as is, not converted or cloned, so undo puts the
 * very same object back and nothing inside it is recreated.
 */
export function groupRowIntoTab({ row, source, tab }: { row: RowItem; source: RowsLayoutManager; tab: TabItem }) {
  const sourceParent = source.parent;
  if (!sourceParent || !isLayoutParent(sourceParent)) {
    throw new Error('Parent object is not a LayoutParent');
  }

  const dashboard = getDashboardSceneFor(source);
  const sourceRows = [...source.state.rows];
  const sourceNewRows = sourceRows.filter((item) => item !== row);
  const tabLayout = tab.getLayout();
  const contentRow = new RowItem({});
  const rows = new RowsLayoutManager({ rows: [] });
  const previousTitle = row.state.title;
  const nextTitle = generateUniqueTitle(previousTitle, new Set(contentRow.state.title ? [contentRow.state.title] : []));
  const tabs = tab.getParentLayout();
  const previousSlug = tabs.state.currentTabSlug;

  moveElement({
    meta: { actionId: 'row.move', scope: 'group-into-tab' },
    source: dashboard,
    movedObject: row,
    selectOnMove: false,
    perform: () => {
      source.setState({ rows: sourceNewRows });
      row.clearParent();
      if (sourceNewRows.length === 0) {
        sourceParent.switchLayout(AutoGridLayoutManager.createEmpty(), true);
      }
      row.setState({ title: nextTitle });
      tabLayout.clearParent();
      contentRow.setState({ layout: tabLayout });
      rows.setState({ rows: [contentRow, row] });
      tab.switchLayout(rows, true);
      tabs.setState({ currentTabSlug: tab.getSlug() });
      dashboard.publishEvent(new ObjectsReorderedOnCanvasEvent(dashboard), true);
    },
    undo: () => {
      rows.setState({ rows: [] });
      row.clearParent();
      tabLayout.clearParent();
      // The new row keeps a placeholder so it never holds the tab's layout while the tab does
      contentRow.setState({ layout: AutoGridLayoutManager.createEmpty() });
      rows.clearParent();
      tab.switchLayout(tabLayout, true);
      row.setState({ title: previousTitle });
      source.setState({ rows: sourceRows });
      if (sourceNewRows.length === 0) {
        sourceParent.switchLayout(source, true);
      }
      tabs.setState({ currentTabSlug: previousSlug });
      dashboard.publishEvent(new ObjectsReorderedOnCanvasEvent(dashboard), true);
    },
  });
}
