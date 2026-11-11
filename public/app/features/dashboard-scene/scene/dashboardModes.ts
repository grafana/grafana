import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { isDashboardNewLayoutsEnabled } from 'app/features/dashboard/api/utils';

import { type DashboardSceneState } from './types/dashboard';

/**
 * `agent` is a presentation over the edit session: Assistant edits are unsaved changes with native undo,
 * but manual edit surfaces are hidden. It is entered by Assistant edits from Viewing.
 * `composer` hides manual edit surfaces too, over Viewing or Editing (`composerEditing`): over Viewing it
 * has no edit session and nothing writes; over Editing only the bound Composer session writes.
 */
export type DashboardMode = 'view' | 'edit' | 'agent' | 'composer';

export function dashboardModesEnabled(): boolean {
  return Boolean(
    isDashboardNewLayoutsEnabled() &&
      getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaDashboardPreviewMode, false)
  );
}

export function dashboardComposerEnabled(): boolean {
  return dashboardModesEnabled() && getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaDashboardComposer, false);
}

export function getDashboardMode(state: Pick<DashboardSceneState, 'mode' | 'isEditing'>): DashboardMode {
  return state.mode ?? (state.isEditing ? 'edit' : 'view');
}

export function isComposerMode(state: Pick<DashboardSceneState, 'mode' | 'isEditing'>): boolean {
  return getDashboardMode(state) === 'composer';
}

/** Composer over Editing: the one state in which the Composer session may write. */
export function isComposerEditing(state: Pick<DashboardSceneState, 'mode' | 'isEditing' | 'composerEditing'>): boolean {
  return isComposerMode(state) && state.composerEditing === true;
}

/** Viewing or Editing, as the mode picker shows it: Composer reads as the mode it is over. */
export function getPickerMode(
  state: Pick<DashboardSceneState, 'mode' | 'isEditing' | 'composerEditing'>
): DashboardMode {
  const mode = getDashboardMode(state);
  if (mode === 'composer') {
    return state.composerEditing ? 'edit' : 'view';
  }
  return mode;
}

export function canManuallyEditDashboard(state: Pick<DashboardSceneState, 'mode' | 'isEditing'>): boolean {
  return !isComposerMode(state) && (!dashboardModesEnabled() || getDashboardMode(state) === 'edit');
}

export function isViewingDashboard(state: Pick<DashboardSceneState, 'mode' | 'isEditing'>): boolean {
  const mode = getDashboardMode(state);
  return mode === 'view' || mode === 'agent';
}
