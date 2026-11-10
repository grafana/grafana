import { omit } from 'lodash';

import { getPanelIdForVizPanel } from '../utils/utils-panels';

import { DashboardGridItem } from './layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';
import { type RowItem } from './layout-rows/RowItem';
import { RowsLayoutManager } from './layout-rows/RowsLayoutManager';
import { type TabItem } from './layout-tabs/TabItem';
import { TabsLayoutManager } from './layout-tabs/TabsLayoutManager';
import { type AnyDashboardLayoutManager, type DashboardLayoutManager } from './types/DashboardLayoutManager';

interface DashboardPlanGridPos {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardPlanPanel {
  /** Unique in the plan, and the panel's key in the preview and the built dashboard: `panel-<id>`. */
  id: number;
  title: string;
  vizType: string;
  gridPos?: DashboardPlanGridPos;
  intent?: string;
  visualization?: string;
  repeatFor?: string;
}

export interface DashboardPlanRow {
  id: string;
  title: string;
  repeatFor?: string;
  panels: DashboardPlanPanel[];
}

interface DashboardPlanSection extends DashboardPlanRow {
  /** Rows nested in a tab. */
  sections?: DashboardPlanRow[];
}

/**
 * A plan as an editable preview owns it: every panel and section has an id, so a layout read back
 * from the scene, and the build, can name each one the same way.
 */
export interface DashboardPlan {
  title: string;
  description?: string;
  layout: 'rows' | 'tabs';
  sections: DashboardPlanSection[];
  variables?: string[];
}

/** The plan an editable preview owns, and how many times it has changed since it was rendered. */
export interface EditablePlan {
  plan: DashboardPlan;
  revision: number;
}

type WithOptionalId<T extends { id: unknown }> = Omit<T, 'id'> & { id?: T['id'] };

type PlanRowInput = Omit<WithOptionalId<DashboardPlanRow>, 'panels'> & {
  panels: Array<WithOptionalId<DashboardPlanPanel>>;
};

export type DashboardPlanInput = Omit<DashboardPlan, 'sections'> & {
  sections: Array<PlanRowInput & { sections?: PlanRowInput[] }>;
};

const SECTION_KEY_PREFIX = 'plan-section-';

/** The scene key of a plan section's row or tab, so a layout read can tell which section it is. */
export function getSectionKeyForPlanSection(sectionId: string): string {
  return `${SECTION_KEY_PREFIX}${sectionId}`;
}

function getPlanSectionIdForKey(key: string | undefined): string | undefined {
  return key?.startsWith(SECTION_KEY_PREFIX) ? key.slice(SECTION_KEY_PREFIX.length) : undefined;
}

function createSectionIdAllocator(used: Iterable<string>): () => string {
  const taken = new Set(used);
  let next = 1;
  return () => {
    while (taken.has(`section-${next}`)) {
      next++;
    }
    const id = `section-${next}`;
    taken.add(id);
    return id;
  };
}

function planRows(plan: DashboardPlanInput): PlanRowInput[] {
  return plan.sections.flatMap((section) => [section, ...(section.sections ?? [])]);
}

/**
 * Gives every panel and section without an id the next free one, in plan order, so a plan proposed
 * without ids numbers its panels 1, 2, 3... as it always has.
 */
export function assignPlanIds(input: DashboardPlanInput): DashboardPlan {
  const rows = planRows(input);
  const usedPanelIds = new Set(rows.flatMap((row) => row.panels.flatMap((panel) => panel.id ?? [])));
  let nextPanelId = 1;
  const allocatePanelId = () => {
    while (usedPanelIds.has(nextPanelId)) {
      nextPanelId++;
    }
    usedPanelIds.add(nextPanelId);
    return nextPanelId;
  };
  const allocateSectionId = createSectionIdAllocator(rows.flatMap((row) => row.id ?? []));

  const withIds = (row: PlanRowInput): DashboardPlanRow => ({
    ...row,
    id: row.id ?? allocateSectionId(),
    panels: row.panels.map((panel) => ({ ...panel, id: panel.id ?? allocatePanelId() })),
  });

  return {
    ...input,
    sections: input.sections.map(({ sections, ...section }) => ({
      ...withIds(section),
      ...(sections ? { sections: sections.map(withIds) } : {}),
    })),
  };
}

/**
 * Gives every tab left without a layout a plan can hold an empty grid instead, as the preview renders
 * an empty section. Moving a tab's last row out leaves it an empty auto grid, and a panel dropped there
 * would land in a layout the plan cannot describe, so `readPlanLayout` would stop following the preview.
 */
export function giveEmptyPlanTabsAGrid(body: AnyDashboardLayoutManager) {
  if (!(body instanceof TabsLayoutManager)) {
    return;
  }
  for (const tab of body.state.tabs) {
    const layout = tab.getLayout();
    if (
      layout instanceof DefaultGridLayoutManager ||
      layout instanceof RowsLayoutManager ||
      layout.getVizPanels().length > 0
    ) {
      continue;
    }
    const grid = DefaultGridLayoutManager.createEmpty();
    tab.switchLayout(grid, true);
    // The preview stays arrangeable, and a new grid is fixed until told otherwise.
    grid.editModeChanged(true);
  }
}

/**
 * The plan with its layout taken from the scene: section order, which section each panel is in,
 * and each panel's position, all matched by id. Content (titles, visualizations, intents) always
 * comes from the plan, never from the scene. A section the scene has but the plan does not, for
 * example one a layout conversion created, keeps the title the scene gives it.
 *
 * Returns the plan unchanged when the scene holds a layout a plan cannot describe.
 */
export function readPlanLayout(body: AnyDashboardLayoutManager, plan: DashboardPlan): DashboardPlan {
  const rows: DashboardPlanSection[] = plan.sections.flatMap((section) => [section, ...(section.sections ?? [])]);
  const panels = new Map(rows.flatMap((row) => row.panels).map((panel) => [panel.id, panel]));
  const sections = new Map(rows.map((row) => [row.id, row]));
  const allocateSectionId = createSectionIdAllocator(sections.keys());

  const readPanels = (layout: DashboardLayoutManager): DashboardPlanPanel[] | undefined => {
    if (!(layout instanceof DefaultGridLayoutManager)) {
      return undefined;
    }
    return layout.state.grid.state.children
      .flatMap((item) => {
        if (!(item instanceof DashboardGridItem)) {
          return [];
        }
        const panel = panels.get(getPanelIdForVizPanel(item.state.body));
        const { x = 0, y = 0, width: w = 0, height: h = 0 } = item.state;
        return panel ? [{ ...panel, gridPos: { x, y, w, h } }] : [];
      })
      .sort((a, b) => a.gridPos.y - b.gridPos.y || a.gridPos.x - b.gridPos.x);
  };

  const readSection = (item: RowItem | TabItem): Omit<DashboardPlanRow, 'panels'> => {
    const known = sections.get(getPlanSectionIdForKey(item.state.key) ?? '');
    return known ? omit(known, 'panels', 'sections') : { id: allocateSectionId(), title: item.state.title ?? '' };
  };

  const readRows = (layout: RowsLayoutManager): DashboardPlanRow[] | undefined => {
    const result: DashboardPlanRow[] = [];
    for (const row of layout.state.rows) {
      const rowPanels = readPanels(row.getLayout());
      if (!rowPanels) {
        return undefined;
      }
      result.push({ ...readSection(row), panels: rowPanels });
    }
    return result;
  };

  if (body instanceof RowsLayoutManager) {
    const sectionsFromScene = readRows(body);
    return sectionsFromScene ? { ...plan, layout: 'rows', sections: sectionsFromScene } : plan;
  }

  if (body instanceof TabsLayoutManager) {
    const tabs: DashboardPlanSection[] = [];
    for (const tab of body.state.tabs) {
      const layout = tab.getLayout();
      if (layout instanceof RowsLayoutManager) {
        const nested = readRows(layout);
        if (!nested) {
          return plan;
        }
        tabs.push({ ...readSection(tab), panels: [], sections: nested });
        continue;
      }
      const tabPanels = readPanels(layout);
      if (!tabPanels) {
        return plan;
      }
      tabs.push({ ...readSection(tab), panels: tabPanels });
    }
    return { ...plan, layout: 'tabs', sections: tabs };
  }

  return plan;
}
