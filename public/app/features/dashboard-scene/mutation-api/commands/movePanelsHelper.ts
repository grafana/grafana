/**
 * movePanelsHelper
 *
 * Relocates VizPanels (with their wrapping grid items) from one layout to
 * another without reassigning panel IDs.
 *
 * The standard `layout.addPanel()` path calls `getNextPanelId()` which
 * assigns a brand-new key to every panel. For `moveContentTo` semantics we
 * need to preserve identity so that the caller (and the elements map) can
 * still reference panels by their original keys.
 *
 * Additionally, `RowsLayoutManager.addPanel()` silently drops panels when
 * its rows array is empty, and both container layout managers delegate
 * through `dashboardEditActions` which may not behave correctly outside
 * the interactive editing flow.
 *
 * This helper resolves the target to a leaf grid layout and directly
 * appends children to the grid state, bypassing all of the above.
 */

import { VizPanel } from '@grafana/scenes';

import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { findSpaceForNewPanel } from '../../scene/layout-default/findSpaceForNewPanel';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { DashboardLayoutManager } from '../../scene/types/DashboardLayoutManager';

/**
 * Walk a layout tree downward until we reach a leaf layout that can directly
 * hold grid items (DefaultGridLayoutManager or AutoGridLayoutManager).
 *
 * For container layouts the strategy is:
 * - RowsLayoutManager: use the first row's layout
 * - TabsLayoutManager: use the first tab's layout
 *
 * Throws if no leaf layout can be reached (e.g. empty containers all the
 * way down).
 */
function resolveLeafLayout(layout: DashboardLayoutManager): DefaultGridLayoutManager | AutoGridLayoutManager {
  let current: DashboardLayoutManager = layout;

  for (let depth = 0; depth < 10; depth++) {
    if (current instanceof DefaultGridLayoutManager || current instanceof AutoGridLayoutManager) {
      return current;
    }

    if (current instanceof RowsLayoutManager) {
      const firstRow = current.state.rows[0];
      if (!firstRow) {
        throw new Error('Cannot move panels to an empty RowsLayout (no rows to receive panels)');
      }
      current = firstRow.state.layout;
      continue;
    }

    if (current instanceof TabsLayoutManager) {
      const firstTab = current.state.tabs[0];
      if (!firstTab) {
        throw new Error('Cannot move panels to an empty TabsLayout (no tabs to receive panels)');
      }
      current = firstTab.state.layout;
      continue;
    }

    throw new Error(`Cannot move panels to layout type: ${current.constructor.name}`);
  }

  throw new Error('Layout nesting too deep (max 10 levels)');
}

/**
 * Move panels from one layout to a target layout without changing panel IDs.
 *
 * Panels are cloned (so they can be detached from their current parent) and
 * added directly to the target grid's children, preserving their existing
 * keys and grid positions.
 *
 * @param panels - VizPanels to relocate
 * @param targetLayout - The layout manager at the moveContentTo path
 */
export function movePanelsToLayout(panels: VizPanel[], targetLayout: DashboardLayoutManager): void {
  if (panels.length === 0) {
    return;
  }

  const leaf = resolveLeafLayout(targetLayout);

  if (leaf instanceof DefaultGridLayoutManager) {
    const grid = leaf.state.grid;
    const newChildren = [...grid.state.children];

    for (const panel of panels) {
      const cloned = panel.clone();
      cloned.clearParent();

      const emptySpace = findSpaceForNewPanel(grid);
      const gridItem = new DashboardGridItem({
        ...emptySpace,
        body: cloned,
      });

      newChildren.push(gridItem);
    }

    grid.setState({ children: newChildren });
    return;
  }

  if (leaf instanceof AutoGridLayoutManager) {
    const autoGrid = leaf.state.layout;
    const newChildren = [...autoGrid.state.children];

    for (const panel of panels) {
      const cloned = panel.clone();
      cloned.clearParent();

      newChildren.push(new AutoGridItem({ body: cloned }));
    }

    autoGrid.setState({ children: newChildren });
    return;
  }
}
