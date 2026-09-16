import { locationService } from '@grafana/runtime';
import { type SceneObject, type SceneVariable, type VizPanel } from '@grafana/scenes';
import { appEvents } from 'app/core/app_events';

import type { DashboardScene } from './DashboardScene';
import { PlanPlaceholderBadge } from './PlanPlaceholderBadge';
import { RowItem } from './layout-rows/RowItem';
import { RowsLayoutManager } from './layout-rows/RowsLayoutManager';
import { TabItem } from './layout-tabs/TabItem';
import { TabsLayoutManager } from './layout-tabs/TabsLayoutManager';
import { DashboardPlanningEvent } from './planningEvents';
import { type DashboardLayoutManager } from './types/DashboardLayoutManager';

interface PlanningSession {
  sections: Set<RowItem | TabItem>;
  panels: Set<VizPanel>;
  variables: Map<DashboardScene | RowItem | TabItem, Set<SceneVariable>>;
}

// Ephemeral ownership follows each scene without retaining deactivated dashboards.
const sessions = new WeakMap<DashboardScene, PlanningSession>();
// Keep the ID until deactivation so navigation can invalidate an in-flight END_PLANNING response.
const lastPlanIds = new WeakMap<DashboardScene, string>();

export function startPlanningSession(
  scene: DashboardScene,
  plan: { planId: string; planTitle: string; panelCount: number }
) {
  // A scene that deactivated before START_PLANNING reached it (e.g. the user navigated away
  // while the call was in flight) must not get a session: deactivatePlanningSession only
  // publishes 'closed' for a scene that already has a planId, so a session created here would
  // never be reported as ended, leaving the caller believing it owns a live preview on a
  // dashboard nothing is showing.
  if (!scene.isActive) {
    throw new Error('The preview dashboard is no longer open.');
  }
  if (scene.isPlanning()) {
    throw new Error('A dashboard plan is already being previewed. End it before starting another.');
  }

  // dashboard-settings is denied while planning (see planningPolicy.ts), which blocks navigating
  // *into* a settings view, but a view already open when START_PLANNING fires stays mounted and
  // fully interactive — including surfaces T7/T11's guards do not reach, like the legacy
  // settings page's own variables editor. Close whatever settings view is open, generically,
  // rather than guarding each thing on it. Clears the URL too (matching the same
  // locationService.partial({ editview: null }) used elsewhere to close this view), or a reload
  // would re-parse the stale editview= param and reopen it.
  if (scene.state.editview) {
    scene.setState({ editview: undefined });
    locationService.partial({ editview: null });
  }

  lastPlanIds.set(scene, plan.planId);
  sessions.set(scene, { sections: new Set(), panels: new Set(), variables: new Map() });
  const notify = (action: 'build' | 'dismiss') => {
    if (scene.state.planning?.planId === plan.planId) {
      appEvents.publish(new DashboardPlanningEvent({ planId: plan.planId, action }));
    }
  };
  scene.setState({ planning: { ...plan, onBuild: () => notify('build'), onDismiss: () => notify('dismiss') } });
}

/**
 * Record a row/tab created while planning, so `endPlanningSession` can consider removing it on
 * Dismiss.
 *
 * Planning does not require an empty dashboard: `ADD_ROW`/`ADD_TAB` (see `addRow.ts`/`addTab.ts`)
 * wrap a non-empty target layout inside the new section instead of replacing it, so a plan can
 * scaffold a row/tab around pre-existing panels on a real dashboard. Without tracking which
 * sections the plan itself created, Dismiss would have no way to tell "a section the plan added
 * and left empty after removing its own panels" (safe to remove — otherwise it is stray
 * scaffolding on the user's dashboard) from "a section that happened to wrap real content" (must
 * stay). `endPlanningSession` only ever removes a *tracked* section, and only once it is empty, so
 * pre-existing content that a tracked section wraps is never touched.
 */
export function trackPlanningSection(scene: DashboardScene, section: RowItem | TabItem) {
  sessions.get(scene)?.sections.add(section);
}

export function trackPlanningPanel(scene: DashboardScene | undefined, panel: VizPanel) {
  // Badges survive Build and query replacement. Only the creating plan may claim a panel.
  const planId = scene?.state.planning?.planId;
  if (
    scene &&
    planId &&
    panel.state.titleItems?.some((item) => item instanceof PlanPlaceholderBadge && item.state.planId === planId)
  ) {
    sessions.get(scene)?.panels.add(panel);
  }
}

export function trackPlanningVariable(
  scene: DashboardScene,
  scopeOwner: DashboardScene | RowItem | TabItem,
  variable: SceneVariable
) {
  const session = sessions.get(scene);
  if (!session) {
    return;
  }
  let variables = session.variables.get(scopeOwner);
  if (!variables) {
    variables = new Set();
    session.variables.set(scopeOwner, variables);
  }
  variables.add(variable);
}

/**
 * A layout with nothing genuine left in it: no panels anywhere in its own tree, recursively.
 * Used to tell "this tracked section still wraps real content" (correct to keep) from "this
 * tracked section is only non-empty because of a hollow, untracked child" (see the warning in
 * the section-removal loop below) apart — both look identical to a plain non-empty check.
 */
function isHollow(layout: DashboardLayoutManager): boolean {
  if (layout.getVizPanels().length > 0) {
    return false;
  }
  if (layout instanceof RowsLayoutManager) {
    return layout.state.rows.every((row) => isHollow(row.state.layout));
  }
  if (layout instanceof TabsLayoutManager) {
    return layout.state.tabs.every((tab) => isHollow(tab.state.layout));
  }
  return true;
}

/** Returns any non-fatal warnings about scaffolding discard could not clean up. */
export function endPlanningSession(scene: DashboardScene, planId: string, discard: boolean): string[] {
  if (scene.state.planning?.planId !== planId) {
    throw new Error('The preview dashboard is no longer open.');
  }
  const warnings: string[] = [];
  const session = sessions.get(scene);
  if (discard && session) {
    // Tracked references (session.panels) handle the common case, but a layout-type conversion,
    // a panel dragged into a new row, or multi-select grouping all clone the panel rather than
    // reuse the tracked instance, which invalidates that reference. PlanPlaceholderBadge.planId
    // is documented to survive cloning (see the badge's own doc comment), and trackPlanningPanel
    // already runs this exact check at tracking time — this reuses it at cleanup time too, so a
    // cloned placeholder is still found and removed even though its object identity changed.
    const panelsToRemove = new Set(session.panels);
    for (const panel of scene.state.body.getVizPanels()) {
      if (
        panel.state.titleItems?.some((item) => item instanceof PlanPlaceholderBadge && item.state.planId === planId)
      ) {
        panelsToRemove.add(panel);
      }
    }

    for (const panel of panelsToRemove) {
      if (panel.getRoot() === scene) {
        scene.removePanel(panel);
      }
    }
    for (const [scopeOwner, trackedVariables] of session.variables) {
      if (scopeOwner.getRoot() !== scene) {
        continue;
      }
      // Variable commands replace the set, so read the owner's current set and match by identity.
      const variables = scopeOwner.state.$variables;
      if (!variables) {
        continue;
      }
      const remaining = variables.state.variables.filter((variable) => !trackedVariables.has(variable));
      if (remaining.length === 0 && (scopeOwner instanceof RowItem || scopeOwner instanceof TabItem)) {
        scopeOwner.setState({ $variables: undefined });
      } else {
        variables.setState({ variables: remaining });
      }
    }
    for (const section of [...session.sections].sort((a, b) => sceneDepth(b) - sceneDepth(a))) {
      if (section.getRoot() !== scene) {
        continue;
      }
      // A new section may wrap existing content or receive it during preview edits.
      // Remove only empty sections after the plan's own panels and variables are gone.
      const layout = section.state.layout;
      if (layout.getVizPanels().length > 0) {
        continue;
      }
      if (layout instanceof RowsLayoutManager && layout.state.rows.length > 0) {
        // Real content survives here (correct, expected — see the wrap-preserving tests for
        // this section) and looks identical, from this check alone, to a hollow, untracked
        // child blocking removal for no good reason (e.g. an untracked "Group into tab" wrapper
        // T15 has already emptied of panels). Distinguish the two with isHollow rather than
        // staying silent on the second.
        if (layout.state.rows.every((row) => isHollow(row.state.layout))) {
          warnings.push(
            `Could not remove "${section.state.title ?? section.state.key}": it still contains an empty, untracked row.`
          );
        }
        continue;
      }
      if (layout instanceof TabsLayoutManager && layout.state.tabs.length > 0) {
        if (layout.state.tabs.every((tab) => isHollow(tab.state.layout))) {
          warnings.push(
            `Could not remove "${section.state.title ?? section.state.key}": it still contains an empty, untracked tab.`
          );
        }
        continue;
      }
      const parent = section.parent;
      if (section instanceof RowItem && parent instanceof RowsLayoutManager) {
        parent.setState({ rows: parent.state.rows.filter((row) => row !== section) });
      } else if (section instanceof TabItem && parent instanceof TabsLayoutManager) {
        parent.setState({ tabs: parent.state.tabs.filter((tab) => tab !== section) });
      }
    }
  }
  sessions.delete(scene);
  scene.setState({ planning: undefined });
  return warnings;
}

export function deactivatePlanningSession(scene: DashboardScene) {
  const planId = lastPlanIds.get(scene) ?? scene.state.planning?.planId;
  lastPlanIds.delete(scene);
  sessions.delete(scene);
  if (planId) {
    scene.setState({ planning: undefined });
    appEvents.publish(new DashboardPlanningEvent({ planId, action: 'closed' }));
  }
}

/** Remove children before wrappers, including wrappers created after their children. */
function sceneDepth(object: SceneObject): number {
  let depth = 0;
  for (let parent = object.parent; parent; parent = parent.parent) {
    depth++;
  }
  return depth;
}
