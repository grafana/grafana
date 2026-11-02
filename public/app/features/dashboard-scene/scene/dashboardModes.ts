import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { isDashboardNewLayoutsEnabled } from 'app/features/dashboard/api/utils';

import { type DashboardSceneState } from './types/dashboard';

/**
 * `agent` and `composer` are presentations over the edit session: Assistant edits are unsaved changes
 * with native undo, but manual edit surfaces are hidden. `agent` is entered by Assistant edits from
 * Viewing while Composer is off; in `composer` only the bound Composer session writes.
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

export function canManuallyEditDashboard(state: Pick<DashboardSceneState, 'mode' | 'isEditing'>): boolean {
  return !isComposerMode(state) && (!dashboardModesEnabled() || getDashboardMode(state) === 'edit');
}

export function isViewingDashboard(state: Pick<DashboardSceneState, 'mode' | 'isEditing'>): boolean {
  const mode = getDashboardMode(state);
  return mode === 'view' || mode === 'agent';
}
