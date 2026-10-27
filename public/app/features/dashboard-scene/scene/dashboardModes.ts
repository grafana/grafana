import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { isDashboardNewLayoutsEnabled } from 'app/features/dashboard/api/utils';

import { type DashboardSceneState } from './types/dashboard';

export type DashboardMode = 'view' | 'edit' | 'agent';

export function dashboardModesEnabled(): boolean {
  return Boolean(
    isDashboardNewLayoutsEnabled() &&
      getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaDashboardPreviewMode, false)
  );
}

export function getDashboardMode(state: Pick<DashboardSceneState, 'mode' | 'isEditing'>): DashboardMode {
  return state.mode ?? (state.isEditing ? 'edit' : 'view');
}

export function canManuallyEditDashboard(state: Pick<DashboardSceneState, 'mode' | 'isEditing'>): boolean {
  return !dashboardModesEnabled() || getDashboardMode(state) === 'edit';
}

export function isViewingDashboard(state: Pick<DashboardSceneState, 'mode' | 'isEditing'>): boolean {
  const mode = getDashboardMode(state);
  return mode === 'view' || mode === 'agent';
}
