import { type DashboardScene } from '../../scene/DashboardScene';
import { type RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { type TabItem } from '../../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';

/**
 * Ensure every row/tab referenced by a rule's LayoutItemReference has a stable
 * `name` on its scene state.
 *
 * Backend conversion from v2 to v3alpha0 emits LayoutItemReference.name values
 * derived from row/tab titles, but the row/tab spec itself may lack a `name`.
 * Without this backfill, renaming the row after load would break the link.
 * After backfill the row's `name` persists on save and the link stays stable.
 *
 * Idempotent: rows/tabs with an existing `name` are left alone.
 */
export function backfillLayoutItemNames(scene: DashboardScene): void {
  const rules = scene.state.dashboardRules?.state.rules;
  if (!rules?.length) {
    return;
  }

  const referencedNames = new Set<string>();
  for (const rule of rules) {
    for (const target of rule.state.targets) {
      if (target.kind === 'LayoutItemReference') {
        referencedNames.add(target.name);
      }
    }
  }

  if (referencedNames.size === 0) {
    return;
  }

  walkLayout(scene.state.body, (item, candidateName) => {
    if (item.state.name) {
      return;
    }
    if (referencedNames.has(candidateName)) {
      item.setState({ name: candidateName });
    }
  });
}

type LayoutItemVisitor = (item: RowItem | TabItem, candidateName: string) => void;

function walkLayout(layout: unknown, visit: LayoutItemVisitor): void {
  if (layout instanceof RowsLayoutManager) {
    for (const row of layout.state.rows) {
      visit(row, row.state.title ?? '');
      walkLayout(row.state.layout, visit);
    }
    return;
  }
  if (layout instanceof TabsLayoutManager) {
    for (const tab of layout.state.tabs) {
      visit(tab, tab.state.title ?? '');
      walkLayout(tab.getLayout(), visit);
    }
  }
}
