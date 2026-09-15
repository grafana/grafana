import { type SceneVariable, type VizPanel } from '@grafana/scenes';
import { appEvents } from 'app/core/app_events';

import type { DashboardScene } from './DashboardScene';
import { PlanPlaceholderBadge } from './PlanPlaceholderBadge';
import { RowItem } from './layout-rows/RowItem';
import { RowsLayoutManager } from './layout-rows/RowsLayoutManager';
import { TabItem } from './layout-tabs/TabItem';
import { TabsLayoutManager } from './layout-tabs/TabsLayoutManager';
import { DashboardPlanningEvent } from './planningEvents';

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
  if (scene.isPlanning()) {
    throw new Error('A dashboard plan is already being previewed. End it before starting another.');
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

export function trackPlanningSection(scene: DashboardScene, section: RowItem | TabItem) {
  sessions.get(scene)?.sections.add(section);
}

export function trackPlanningPanel(scene: DashboardScene | undefined, panel: VizPanel) {
  // Layout insertion also handles moved real panels; only planning placeholders belong to cleanup.
  if (scene && panel.state.titleItems?.some((item) => item instanceof PlanPlaceholderBadge)) {
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

export function endPlanningSession(scene: DashboardScene, planId: string, discard: boolean) {
  if (scene.state.planning?.planId !== planId) {
    throw new Error('The preview dashboard is no longer open.');
  }
  const session = sessions.get(scene);
  if (discard && session) {
    for (const section of session.sections) {
      if (section.getRoot() !== scene) {
        continue;
      }
      const parent = section.parent;
      if (section instanceof RowItem && parent instanceof RowsLayoutManager) {
        parent.setState({ rows: parent.state.rows.filter((row) => row !== section) });
      } else if (section instanceof TabItem && parent instanceof TabsLayoutManager) {
        parent.setState({ tabs: parent.state.tabs.filter((tab) => tab !== section) });
      }
    }
    for (const panel of session.panels) {
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
  }
  sessions.delete(scene);
  scene.setState({ planning: undefined });
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
