import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, locationService } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient, useFlagGrafanaMobileEditDeprecation } from '@grafana/runtime/internal';
import { appEvents } from 'app/core/app_events';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';

import { type DashboardScene } from '../scene/DashboardScene';
import { isFullDashboardEditing } from '../scene/types/dashboard';

/**
 * Non-reactive check for use outside React (e.g. DashboardScene class methods,
 * mutation-api permission checks).
 */
export function isMobileEditDeprecated(): boolean {
  return (
    getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaMobileEditDeprecation, false) &&
    window.innerWidth < config.theme2.breakpoints.values.sm
  );
}

/**
 * Reactive hook for use in React components deciding whether to render edit-mode UI.
 */
export function useIsMobileEditDeprecated(): boolean {
  const isEnabled = useFlagGrafanaMobileEditDeprecation();
  const isMobile = !useMediaQueryMinWidth('sm');
  return isEnabled && isMobile;
}

/**
 * Whether *starting* an edit is blocked. A session already in full editing is never blocked. A
 * Viewing or Composer session is still `isEditing` but cannot switch back to Editing here, so it
 * counts as blocked.
 */
export function isEditEntryBlocked(scene: DashboardScene): boolean {
  return isMobileEditDeprecated() && !isFullDashboardEditing(scene.state);
}

export function mobileEditNotAvailableMessage(): string {
  return t(
    'dashboard.edit.mobile-not-available',
    'Dashboard editing is not available on small screens. Switch to a larger screen to continue.'
  );
}

/**
 * Show a warning notification when an edit action is blocked on mobile.
 * Do not use this when removing blocked edit parameters from the URL.
 * onEnterEditMode already shows this warning; its callers should not repeat it.
 */
export function notifyMobileEditNotAvailable(): void {
  appEvents.emit(AppEvents.alertWarning, [mobileEditNotAvailableMessage()]);
}

/**
 * Warns and redirects away from a route that exists only to build or edit a dashboard (e.g.
 * /dashboard/new, the Template route), since landing there on mobile would
 * otherwise show a dead-end page that can never be completed.
 */
export function redirectAwayFromMobileEdit(): void {
  notifyMobileEditNotAvailable();
  locationService.replace('/dashboards');
}
