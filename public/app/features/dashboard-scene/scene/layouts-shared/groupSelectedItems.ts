import { t } from '@grafana/i18n';
import { type SceneObject, VizPanel } from '@grafana/scenes';

import { dashboardEditActions } from '../../edit-pane/shared';
import { getDashboardSceneFor, getLayoutManagerFor } from '../../utils/utils';
import { AutoGridItem } from '../layout-auto-grid/AutoGridItem';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { TabItem } from '../layout-tabs/TabItem';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';
import { type DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { isLayoutParent, type LayoutParent } from '../types/LayoutParent';

import { getNestingRestrictions } from './CanvasGridAddActions';
import { generateUniqueTitle } from './utils';

export type GroupTarget = 'row' | 'tab';
type SelectionKind = 'rows' | 'tabs' | 'panels';

interface SelectionInfo {
  kind: SelectionKind;
  container: DashboardLayoutManager;
  parent: LayoutParent;
  siblingCount: number;
}

export interface GroupingResult {
  enabled: boolean;
  reason?: string;
}

export function getSelectionKind(items: SceneObject[]): SelectionKind | undefined {
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

/**
 * Whether the current selection can be grouped into a new row or tab.
 *
 * Grouping inserts one new layout manager (the row/tab group) above the selection, so the
 * nesting limits are evaluated against the deepest grids in the selection — exactly the rules
 * the canvas "Group" actions use (max 3 levels, one level of tabs, `unlimitedLayoutsNesting`
 * bypass) via the shared `getNestingRestrictions`.
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
      reason: t('dashboard.edit-pane.group.tab-nesting', 'Tabs cannot be nested inside other tabs'),
    };
  }

  // Fall back to the container when the selection has no panels yet (e.g. empty rows/tabs).
  const grids = getLeafGrids(items, info.kind);
  const nodes = grids.length > 0 ? grids : [info.container];
  const restrictions = nodes.map(getNestingRestrictions);
  const disableGrouping = restrictions.some((r) => r.disableGrouping);

  if (disableGrouping) {
    return {
      enabled: false,
      reason: t('dashboard.edit-pane.group.limit-reached', 'Grouping is limited to 3 levels'),
    };
  }

  if (target === 'tab' && restrictions.some((r) => r.disableTabs)) {
    return {
      enabled: false,
      reason: t('dashboard.edit-pane.group.tab-nesting', 'Tabs cannot be nested inside other tabs'),
    };
  }

  return { enabled: true };
}

function cloneGridWithPanels(
  grid: DashboardLayoutManager,
  selectedKeys: Set<string | undefined>,
  keepSelected: boolean
): DashboardLayoutManager {
  const clone = grid.clone();

  if (clone instanceof DefaultGridLayoutManager) {
    clone.state.grid.setState({
      children: clone.state.grid.state.children.filter((child) => {
        const isSelected =
          child instanceof DashboardGridItem &&
          child.state.body instanceof VizPanel &&
          selectedKeys.has(child.state.body.state.key);

        return keepSelected ? isSelected : !isSelected;
      }),
    });
  } else if (clone instanceof AutoGridLayoutManager) {
    clone.state.layout.setState({
      children: clone.state.layout.state.children.filter((child) => {
        const isSelected =
          child instanceof AutoGridItem &&
          child.state.body instanceof VizPanel &&
          selectedKeys.has(child.state.body.state.key);

        return keepSelected ? isSelected : !isSelected;
      }),
    });
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
  selectedGroup: RowItem | TabItem;
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

    return { newLayout: new TabsLayoutManager({ tabs }), selectedGroup: tabs[0] };
  }

  const rows = [new RowItem({ title: nextTitle(), layout: selectedLayout })];

  if (restLayout) {
    rows.push(new RowItem({ title: nextTitle(), layout: restLayout }));
  }

  return { newLayout: new RowsLayoutManager({ rows }), selectedGroup: rows[0] };
}

/**
 * rows -> row: wrap only the selected rows in a new parent row; unselected rows stay as siblings.
 */
function buildRowsIntoRow(rows: RowsLayoutManager, selectedKeys: Set<string | undefined>): BuiltLayout {
  const clone = rows.clone();
  const cloneRows = clone.state.rows;

  const selectedClones = cloneRows.filter((row) => selectedKeys.has(row.state.key));
  selectedClones.forEach((row) => row.clearParent());

  const existingTitles = new Set(
    cloneRows
      .filter((row) => !selectedKeys.has(row.state.key))
      .map((row) => row.state.title)
      .filter((title): title is string => title !== undefined)
  );

  const newParentRow = new RowItem({
    title: generateUniqueTitle(t('dashboard.rows-layout.row.new', 'New row'), existingTitles),
    layout: new RowsLayoutManager({ rows: selectedClones }),
  });

  const finalRows: RowItem[] = [];
  let inserted = false;

  for (const row of cloneRows) {
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

  return { newLayout: new RowsLayoutManager({ rows: finalRows }), selectedGroup: newParentRow };
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

/**
 * Groups the selected rows/tabs/panels into a new row or tab. The container the selection
 * lives in is replaced with the new grouping; the selection's siblings are partitioned into a
 * second group when the container type has to change (see the design doc), otherwise they are
 * left untouched. The whole operation is a single undo/redo entry.
 */
export function groupSelectedInto(items: SceneObject[], target: GroupTarget): void {
  const info = getSelectionInfo(items);

  if (!info || !canGroupSelection(items, target).enabled) {
    return;
  }

  const scene = getDashboardSceneFor(info.container);
  // Snapshot the container before building: grouping moves the selection's children out of it,
  // so undo restores this pristine copy rather than the (now mutated) original container.
  const previousLayout = info.container.clone();
  const built = buildGroupedLayout(items, info, target);

  if (!built) {
    return;
  }

  dashboardEditActions.edit({
    description:
      target === 'row'
        ? t('dashboard.edit-actions.group-into-row', 'Group into row')
        : t('dashboard.edit-actions.group-into-tab', 'Group into tab'),
    source: scene,
    addedObject: built.selectedGroup,
    perform: () => info.parent.switchLayout(built.newLayout, true),
    undo: () => info.parent.switchLayout(previousLayout, true),
  });
}
