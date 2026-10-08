import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { isDashboardNewLayoutsEnabled } from 'app/features/dashboard/api/utils';

import { type DashboardSceneState } from './types/dashboard';

export type DashboardMode = 'view' | 'edit';

export function dashboardModesEnabled(): boolean {
  return Boolean(
    isDashboardNewLayoutsEnabled() &&
      getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaDashboardPreviewMode, false)
  );
}

export function getDashboardMode(
  state: Pick<DashboardSceneState, 'mode' | 'isEditing' | 'editPresentation'>
): DashboardMode {
  return state.mode ?? (state.isEditing && state.editPresentation !== 'preview' ? 'edit' : 'view');
}

export function canManuallyEditDashboard(
  state: Pick<DashboardSceneState, 'mode' | 'isEditing' | 'editPresentation'>
): boolean {
  return !dashboardModesEnabled() || getDashboardMode(state) === 'edit';
}
