import { t } from '@grafana/i18n';
import { type SceneObject, VizPanel } from '@grafana/scenes';

import { getLayoutManagerFor } from '../../utils/getLayoutManagerFor';
import { AutoGridItem } from '../layout-auto-grid/AutoGridItem';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { TabItem } from '../layout-tabs/TabItem';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';
import {
  type DashboardLayoutManager,
  type GroupTarget,
  type GroupingResult,
  isDashboardLayoutManager,
} from '../types/DashboardLayoutManager';
import { isLayoutParent, type LayoutParent } from '../types/LayoutParent';

import {
  getDisableTabsMessage,
  getGroupDepth,
  getNestingRestrictionMessage,
  getNestingRestrictions,
  MAX_NESTING_DEPTH,
} from './nestingRestrictions';
import { generateUniqueTitle } from './utils';

type SelectionKind = 'rows' | 'tabs' | 'panels';

interface SelectionInfo {
  kind: SelectionKind;
  container: DashboardLayoutManager;
  parent: LayoutParent;
  siblingCount: number;
}

function getSelectionKind(items: SceneObject[]): SelectionKind | undefined {
  const first = items[0];

  if (first instanceof RowItem) {
    return 'rows';
  }

  if (first instanceof TabItem) {
    return 'tabs';
  }

  if (first instanceof VizPanel) {
    return 'panels';
  }

  return undefined;
}

/**
 * Resolves the common container and layout parent for a homogeneous selection.
 * Returns undefined when the selection is empty, mixed, or spread across more than one container.
 */
function getSelectionInfo(items: SceneObject[]): SelectionInfo | undefined {
  const kind = getSelectionKind(items);

  if (!kind || items.length === 0) {
    return undefined;
  }

  let container: DashboardLayoutManager | undefined;
  let siblingCount = 0;

  if (kind === 'rows') {
    const rows = items.filter((sceneObject): sceneObject is RowItem => sceneObject instanceof RowItem);

    if (rows.length !== items.length) {
      return undefined;
    }

    const firstParent = rows[0].parent;

    if (!(firstParent instanceof RowsLayoutManager) || !rows.every((row) => row.parent === firstParent)) {
      return undefined;
    }

    container = firstParent;
    siblingCount = firstParent.state.rows.length;
  } else if (kind === 'tabs') {
    const tabs = items.filter((sceneObject): sceneObject is TabItem => sceneObject instanceof TabItem);

    if (tabs.length !== items.length) {
      return undefined;
    }

    const firstParent = tabs[0].parent;

    if (!(firstParent instanceof TabsLayoutManager) || !tabs.every((tab) => tab.parent === firstParent)) {
      return undefined;
    }

    container = firstParent;
    siblingCount = firstParent.state.tabs.length;
  } else {
    const panels = items.filter((sceneObject): sceneObject is VizPanel => sceneObject instanceof VizPanel);

    if (panels.length !== items.length) {
      return undefined;
    }

    let firstLayoutManager: DashboardLayoutManager;

    try {
      firstLayoutManager = getLayoutManagerFor(panels[0]);
    } catch {
      return undefined;
    }

    const sameContainer = panels.every((panel) => {
      try {
        return getLayoutManagerFor(panel) === firstLayoutManager;
      } catch {
        return false;
      }
    });

    if (!sameContainer) {
      return undefined;
    }

    container = firstLayoutManager;
    siblingCount = firstLayoutManager.getVizPanels().length;
  }

  const parent = container.parent;

  if (!parent || !isLayoutParent(parent)) {
    return undefined;
  }

  return { kind, container, parent, siblingCount };
}

function getLeafGrids(items: SceneObject[], kind: SelectionKind): DashboardLayoutManager[] {
  const grids = new Set<DashboardLayoutManager>();

  const collect = (panel: VizPanel) => {
    try {
      grids.add(getLayoutManagerFor(panel));
    } catch {
      // panel detached from any layout manager — ignore
    }
  };

  if (kind === 'panels') {
    items.forEach((item) => item instanceof VizPanel && collect(item));
  } else {
    items.forEach((item) => {
      if (item instanceof RowItem || item instanceof TabItem) {
        item.getLayout().getVizPanels().forEach(collect);
      }
    });
  }

  return Array.from(grids);
}

function exceedsRowsIntoRowDepth(items: SceneObject[], container: RowsLayoutManager): boolean {
  let ancestorGroups = 0;
  let parent = container.parent;

  while (parent) {
    if (isDashboardLayoutManager(parent)) {
      ancestorGroups++;
    }
    parent = parent.parent;
  }

  const selectedRowsDepth = Math.max(
    0,
    ...items.map((item) => (item instanceof RowItem ? getGroupDepth(item.getLayout()) : 0))
  );

  // The existing rows container remains and buildRowsIntoRow inserts another rows layer beneath it.
  return ancestorGroups + 2 + selectedRowsDepth > MAX_NESTING_DEPTH;
}

/**
 * Whether the current selection can be grouped into a new row or tab.
 *
 * Grouping inserts one new layout manager (the row/tab group) above the selection, following the
 * rules the canvas "Group" actions use (max nesting depth, no tabs inside tabs) via the shared
 * `getNestingRestrictions`: the depth limit is evaluated against the deepest grids in the
 * selection, while the tab restrictions are evaluated at the container the new group replaces.
 */
export function canGroupSelection(items: SceneObject[], target: GroupTarget): GroupingResult {
  const info = getSelectionInfo(items);

  // No common container — e.g. the selection spans different rows/tabs/grids.
  if (!info) {
    return {
      enabled: false,
      reason: t(
        'dashboard.edit-pane.group.different-parents',
        'Select items within the same row, tab, or grid to group them'
      ),
    };
  }

  // A tabs selection can never be grouped into a tab (tabs cannot nest in tabs).
  if (target === 'tab' && info.kind === 'tabs') {
    return {
      enabled: false,
      reason: getDisableTabsMessage('nested-tabs'),
    };
  }

  if (
    target === 'row' &&
    info.kind === 'rows' &&
    info.container instanceof RowsLayoutManager &&
    exceedsRowsIntoRowDepth(items, info.container)
  ) {
    return {
      enabled: false,
      reason: getNestingRestrictionMessage(),
    };
  }

  // Fall back to the container when the selection has no panels yet (e.g. empty rows/tabs).
  const grids = getLeafGrids(items, info.kind);
  const nodes = grids.length > 0 ? grids : [info.container];
  const disableGrouping = nodes.some((node) => getNestingRestrictions(node).disableGrouping);

  if (disableGrouping) {
    return {
      enabled: false,
      reason: getNestingRestrictionMessage(),
    };
  }

  if (target === 'tab') {
    // Grouping replaces the container with the new tabs layout (see buildGroupEdit), so the tab
    // restrictions (no tabs directly inside tabs, max depth) apply at the container's position —
    // the leaf grids' nearest group is the container itself, which would mask a tab above it.
    const { disableTabsReason } = getNestingRestrictions(info.container);

    if (disableTabsReason !== undefined) {
      return {
        enabled: false,
        reason: getDisableTabsMessage(disableTabsReason),
      };
    }
  }

  return { enabled: true };
}

function cloneGridWithPanels(
  grid: DashboardLayoutManager,
  selectedKeys: Set<string | undefined>,
  keepSelected: boolean
): DashboardLayoutManager {
  // Clone only for the grid options; the children are the real (moved) grid items. The edit
  // pane and selection hold references to the original panels, so the live layout must keep
  // those exact instances — clones would leave the selection pointing at orphaned objects.
  // `buildGroupEdit` snapshots the original container for undo before this runs, so detaching
  // the real items here is safe.
  const clone = grid.clone();

  if (grid instanceof DefaultGridLayoutManager && clone instanceof DefaultGridLayoutManager) {
    const children = grid.state.grid.state.children.filter((child) => {
      const isSelected =
        child instanceof DashboardGridItem &&
        child.state.body instanceof VizPanel &&
        selectedKeys.has(child.state.body.state.key);

      return keepSelected ? isSelected : !isSelected;
    });

    children.forEach((child) => child.clearParent());
    clone.state.grid.setState({ children });
  } else if (grid instanceof AutoGridLayoutManager && clone instanceof AutoGridLayoutManager) {
    const children = grid.state.layout.state.children.filter((child) => {
      const isSelected =
        child instanceof AutoGridItem &&
        child.state.body instanceof VizPanel &&
        selectedKeys.has(child.state.body.state.key);

      return keepSelected ? isSelected : !isSelected;
    });

    children.forEach((child) => child.clearParent());
    clone.state.layout.setState({ children });
  }

  return clone;
}

function cloneRowsSubset(
  layoutManager: RowsLayoutManager,
  selectedKeys: Set<string | undefined>,
  keepSelected: boolean
): RowsLayoutManager {
  const rows = layoutManager.state.rows.filter((row) =>
    keepSelected ? selectedKeys.has(row.state.key) : !selectedKeys.has(row.state.key)
  );

  // Move the rows into the new layout. `groupSelectedInto` snapshots the original container
  // for undo before this runs, so detaching the real rows here is safe.
  rows.forEach((row) => row.clearParent());

  return new RowsLayoutManager({ rows });
}

function cloneTabsSubset(
  layoutManager: TabsLayoutManager,
  selectedKeys: Set<string | undefined>,
  keepSelected: boolean
): TabsLayoutManager {
  const tabs = layoutManager.state.tabs.filter((tab) =>
    keepSelected ? selectedKeys.has(tab.state.key) : !selectedKeys.has(tab.state.key)
  );

  // Move the tabs into the new layout (see cloneRowsSubset). currentTabSlug is left unset so
  // the new layout defaults to its first tab.
  tabs.forEach((tab) => tab.clearParent());

  return new TabsLayoutManager({ tabs });
}

interface BuiltLayout {
  newLayout: DashboardLayoutManager;
  /** The new row/tab wrapping the selection — reported as `addedObject` so the sidebar selects it. */
  groupItem: RowItem | TabItem;
}

function wrapLayouts(
  selectedLayout: DashboardLayoutManager,
  restLayout: DashboardLayoutManager | undefined,
  target: GroupTarget
): BuiltLayout {
  const usedTitles = new Set<string>();
  const baseTitle =
    target === 'tab' ? t('dashboard.tabs-layout.tab.new', 'New tab') : t('dashboard.rows-layout.row.new', 'New row');

  const nextTitle = () => {
    const title = generateUniqueTitle(baseTitle, usedTitles);

    usedTitles.add(title);

    return title;
  };

  if (target === 'tab') {
    const tabs = [new TabItem({ title: nextTitle(), layout: selectedLayout })];

    if (restLayout) {
      tabs.push(new TabItem({ title: nextTitle(), layout: restLayout }));
    }

    return { newLayout: new TabsLayoutManager({ tabs }), groupItem: tabs[0] };
  }

  const rows = [new RowItem({ title: nextTitle(), layout: selectedLayout })];

  if (restLayout) {
    rows.push(new RowItem({ title: nextTitle(), layout: restLayout }));
  }

  return { newLayout: new RowsLayoutManager({ rows }), groupItem: rows[0] };
}

/**
 * rows -> row: wrap only the selected rows in a new parent row; unselected rows stay as siblings.
 */
function buildRowsIntoRow(rows: RowsLayoutManager, selectedKeys: Set<string | undefined>): BuiltLayout {
  // Move the real rows into the new layout. The edit pane and selection hold references to the
  // original rows, so the live layout must keep those exact instances. `buildGroupEdit`
  // snapshots the original container for undo before this runs, so detaching them here is safe.
  const allRows = rows.state.rows;

  const selectedRows = allRows.filter((row) => selectedKeys.has(row.state.key));
  selectedRows.forEach((row) => row.clearParent());

  const existingTitles = new Set(
    allRows
      .filter((row) => !selectedKeys.has(row.state.key))
      .map((row) => row.state.title)
      .filter((title): title is string => title !== undefined)
  );

  const newParentRow = new RowItem({
    title: generateUniqueTitle(t('dashboard.rows-layout.row.new', 'New row'), existingTitles),
    layout: new RowsLayoutManager({ rows: selectedRows }),
  });

  const finalRows: RowItem[] = [];
  let inserted = false;

  for (const row of allRows) {
    if (selectedKeys.has(row.state.key)) {
      if (!inserted) {
        finalRows.push(newParentRow);
        inserted = true;
      }

      continue;
    }

    row.clearParent();
    finalRows.push(row);
  }

  return { newLayout: new RowsLayoutManager({ rows: finalRows }), groupItem: newParentRow };
}

function buildGroupedLayout(items: SceneObject[], info: SelectionInfo, target: GroupTarget): BuiltLayout | undefined {
  const { kind, container, siblingCount } = info;
  const selectedKeys = new Set(items.map((item) => item.state.key));
  const hasRest = siblingCount > items.length;

  if (kind === 'panels') {
    return wrapLayouts(
      cloneGridWithPanels(container, selectedKeys, true),
      hasRest ? cloneGridWithPanels(container, selectedKeys, false) : undefined,
      target
    );
  }

  if (kind === 'rows' && container instanceof RowsLayoutManager) {
    if (target === 'row') {
      return buildRowsIntoRow(container, selectedKeys);
    }

    return wrapLayouts(
      cloneRowsSubset(container, selectedKeys, true),
      hasRest ? cloneRowsSubset(container, selectedKeys, false) : undefined,
      'tab'
    );
  }

  // kind === 'tabs' (only the row target is offered)
  if (kind === 'tabs' && container instanceof TabsLayoutManager) {
    return wrapLayouts(
      cloneTabsSubset(container, selectedKeys, true),
      hasRest ? cloneTabsSubset(container, selectedKeys, false) : undefined,
      'row'
    );
  }

  return undefined;
}

export interface GroupEdit {
  description: string;
  /** The new row/tab wrapping the selection. The sidebar selects it after perform (offering the
   * rename affordance, like the canvas group actions) and clears the selection on undo. */
  addedObject: SceneObject;
  perform: () => void;
  undo: () => void;
}

/**
 * Builds an undoable "group into row/tab" edit for the current selection, or returns undefined
 * when the selection cannot be grouped. The container the selection lives in is replaced with the
 * new grouping; the selection's siblings are partitioned into a second group when the container
 * type has to change, otherwise they are left untouched.
 *
 * The edit is returned declaratively (description + perform/undo closures) so the caller — a
 * layout manager that is already wired to the edit history and scene utilities — dispatches it.
 * That keeps this module free of the `sidebar/shared` and `utils/utils` hubs, so the only
 * cycles it adds to the layout-manager graph are the unavoidable ones from constructing concrete
 * layouts.
 */
export function buildGroupEdit(items: SceneObject[], target: GroupTarget): GroupEdit | undefined {
  const info = getSelectionInfo(items);

  if (!info || !canGroupSelection(items, target).enabled) {
    return undefined;
  }

  // Snapshot the container before building: grouping moves the selection's children out of it,
  // so undo restores this pristine copy rather than the (now mutated) original container.
  const previousLayout = info.container.clone();
  const built = buildGroupedLayout(items, info, target);

  if (!built) {
    return undefined;
  }

  return {
    description:
      target === 'row'
        ? t('dashboard.edit-actions.group-into-row', 'Group into row')
        : t('dashboard.edit-actions.group-into-tab', 'Group into tab'),
    addedObject: built.groupItem,
    perform: () => info.parent.switchLayout(built.newLayout, true),
    undo: () => info.parent.switchLayout(previousLayout, true),
  };
}
