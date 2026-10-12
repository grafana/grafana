import { type Unsubscribable } from 'rxjs';

import { getFeatureFlagClient, FlagKeys } from '@grafana/runtime/internal';

import { type DashboardScene } from '../scene/DashboardScene';

import { DashboardInteractions } from './interactions';
import { findVizPanelByPathId } from './pathId';

export type ViewPanelEnterSource = 'menu' | 'hover_popover' | 'keyboard' | 'url';
export type ViewPanelExitMethod =
  | 'hover_popover'
  | 'toolbar_back'
  | 'pane_back'
  | 'escape'
  | 'keyboard'
  | 'edit'
  | 'url';

// A mark only describes the transition that immediately follows it; anything older is unrelated.
const MARK_TTL_MS = 1000;

let pendingEnter: { source: ViewPanelEnterSource; at: number } | undefined;
let pendingExit: { method: ViewPanelExitMethod; at: number } | undefined;

/**
 * Call right before the url/state change that opens view mode, so the transition is attributed to this control.
 * Transitions without a mark (direct links, browser history) are reported as 'url'.
 */
export function markViewPanelEnter(source: ViewPanelEnterSource) {
  pendingEnter = { source, at: Date.now() };
}

/**
 * Call right before the url/state change that leaves view mode, so the transition is attributed to this control.
 * Transitions without a mark are reported as 'edit' when they open panel edit, otherwise 'url'.
 */
export function markViewPanelExit(method: ViewPanelExitMethod) {
  pendingExit = { method, at: Date.now() };
}

function takeEnterSource(): ViewPanelEnterSource {
  const source = pendingEnter && Date.now() - pendingEnter.at < MARK_TTL_MS ? pendingEnter.source : 'url';
  pendingEnter = undefined;
  return source;
}

function takeExitMethod(isEnteringPanelEdit: boolean): ViewPanelExitMethod {
  const fallback = isEnteringPanelEdit ? 'edit' : 'url';
  const method = pendingExit && Date.now() - pendingExit.at < MARK_TTL_MS ? pendingExit.method : fallback;
  pendingExit = undefined;
  return method;
}

function isHoverActionsEnabled() {
  return getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaPanelHoverActions, false);
}

/**
 * Reports every enter/exit of panel view mode with how it happened and how long the panel stayed maximized.
 * Fires with the hover actions flag both off and on, so the flag-off period serves as the experiment baseline.
 */
export function trackViewPanelTransitions(dashboard: DashboardScene): Unsubscribable {
  let enteredAt: number | undefined;
  let panelType: string | undefined;

  const getPanelType = (pathId: string) => findVizPanelByPathId(dashboard, pathId)?.state.pluginId;

  const onEnter = (pathId: string, source: ViewPanelEnterSource) => {
    enteredAt = Date.now();
    panelType = getPanelType(pathId);
    DashboardInteractions.viewPanelEntered({ source, panelType, hoverActions: isHoverActionsEnabled() });
  };

  // Escape is bound outside the dashboard (keybindingSrv), so it's recognised here in the capture phase,
  // which runs before that binding clears viewPanel.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && dashboard.state.viewPanel) {
      markViewPanelExit('escape');
    }
  };
  window.addEventListener('keydown', onKeyDown, true);

  if (dashboard.state.viewPanel) {
    onEnter(dashboard.state.viewPanel, takeEnterSource());
  }

  const sub = dashboard.subscribeToState((state, prev) => {
    if (state.viewPanel === prev.viewPanel) {
      return;
    }

    if (prev.viewPanel) {
      DashboardInteractions.viewPanelExited({
        method: takeExitMethod(Boolean(state.editPanel)),
        durationMs: enteredAt === undefined ? undefined : Date.now() - enteredAt,
        panelType,
        hoverActions: isHoverActionsEnabled(),
      });
      enteredAt = undefined;
    }

    if (state.viewPanel) {
      onEnter(state.viewPanel, takeEnterSource());
    }
  });

  return {
    unsubscribe: () => {
      sub.unsubscribe();
      window.removeEventListener('keydown', onKeyDown, true);
    },
  };
}
