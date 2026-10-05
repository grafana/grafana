import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { type RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { type TabItem } from '../../scene/layout-tabs/TabItem';
import { generateUniqueTitle } from '../../scene/layouts-shared/utils';
import { isLayoutParent } from '../../scene/types/LayoutParent';
import { ObjectsReorderedOnCanvasEvent } from '../../sidebar/events';
import { getDashboardSceneFor } from '../../utils/utils';
import { moveElement } from '../element/moveElement';

export function moveRowToTab({
  row,
  source,
  destination,
}: {
  row: RowItem;
  source: RowsLayoutManager;
  destination: TabItem;
}) {
  const destinationLayout = destination.getLayout();
  // The row is still in its source when a drag returns to the original tab.
  if (destinationLayout === source) {
    return;
  }
  const sourceParent = source.parent;
  if (!sourceParent || !isLayoutParent(sourceParent)) {
    throw new Error('Parent object is not a LayoutParent');
  }

  const dashboard = getDashboardSceneFor(source);
  const sourceRows = [...source.state.rows];
  const sourceNewRows = sourceRows.filter((item) => item !== row);
  const previousTitle = row.state.title;
  let nextTitle = previousTitle;
  let destinationRowsManager: RowsLayoutManager;

  if (destinationLayout instanceof RowsLayoutManager) {
    destinationRowsManager = destinationLayout;
    const existingTitles = new Set(
      destinationLayout.state.rows.map((item) => item.state.title).filter((title) => title !== undefined)
    );
    nextTitle = generateUniqueTitle(previousTitle, existingTitles);
  } else if (destinationLayout.getVizPanels().length === 0) {
    destinationRowsManager = new RowsLayoutManager({ rows: [] });
  } else {
    // Preserve the original layout for undo; reuse the converted layout on redo.
    destinationRowsManager = RowsLayoutManager.createFromLayout(destinationLayout.clone());
  }

  const previousRowItems = [...destinationRowsManager.state.rows];
  const tabs = destination.getParentLayout();
  const previousSlug = tabs.state.currentTabSlug;

  moveElement({
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
      destinationRowsManager.setState({ rows: [...previousRowItems, row] });
      if (destinationRowsManager !== destinationLayout) {
        destinationLayout.clearParent();
        destination.switchLayout(destinationRowsManager, true);
      }
      tabs.setState({ currentTabSlug: destination.getSlug() });
      dashboard.publishEvent(new ObjectsReorderedOnCanvasEvent(dashboard), true);
    },
    undo: () => {
      destinationRowsManager.setState({ rows: previousRowItems });
      row.clearParent();
      if (destinationRowsManager !== destinationLayout) {
        destinationRowsManager.clearParent();
        destination.switchLayout(destinationLayout, true);
      }
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
