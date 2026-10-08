import { config } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';

import { type DashboardSceneState } from './types/dashboard';

export type DashboardMode = 'view' | 'edit' | 'code';

export function dashboardModesEnabled(): boolean {
  return Boolean(
    // This existing dynamic-layout flag is only generated for the legacy frontend API.
    // eslint-disable-next-line @grafana/no-config-feature-toggles
    config.featureToggles.dashboardNewLayouts &&
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
