import { sceneGraph, type SceneVariable, type VizPanel } from '@grafana/scenes';
import { appEvents } from 'app/core/app_events';

import type { DashboardScene } from './DashboardScene';
import { RowItem } from './layout-rows/RowItem';
import { RowsLayoutManager } from './layout-rows/RowsLayoutManager';
import { TabItem } from './layout-tabs/TabItem';
import { TabsLayoutManager } from './layout-tabs/TabsLayoutManager';
import { DashboardPlanningEvent } from './planningEvents';

interface PlanningSession {
  sections: Set<RowItem | TabItem>;
  panels: Set<VizPanel>;
  variables: Set<SceneVariable>;
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
  sessions.set(scene, { sections: new Set(), panels: new Set(), variables: new Set() });
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

export function trackPlanningPanel(scene: DashboardScene, panel: VizPanel) {
  sessions.get(scene)?.panels.add(panel);
}

export function trackPlanningVariable(scene: DashboardScene, name: string) {
  if (!sessions.has(scene)) {
    return;
  }
  const variable = sceneGraph.getVariables(scene).state.variables.find((v) => v.state.name === name);
  if (variable) {
    sessions.get(scene)?.variables.add(variable);
  }
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
    const variables = sceneGraph.getVariables(scene);
    variables.setState({ variables: variables.state.variables.filter((v) => !session.variables.has(v)) });
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
