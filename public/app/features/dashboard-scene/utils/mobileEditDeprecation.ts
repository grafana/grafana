import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, locationService } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient, useFlagGrafanaMobileEditDeprecation } from '@grafana/runtime/internal';
import { appEvents } from 'app/core/app_events';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';

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
 * Warns the user that an edit-mode action was blocked on mobile. Call this at every
 * no-op/redirect site gated by `isMobileEditDeprecated()`, so a silent block (e.g. visiting
 * /dashboard/new directly) doesn't look like the app just did nothing.
 */
export function notifyMobileEditNotAvailable(): void {
  appEvents.emit(AppEvents.alertWarning, [
    t(
      'dashboard.edit.mobile-not-available',
      'Dashboard editing is not available on small screens. Switch to a larger screen to continue.'
    ),
  ]);
}

/**
 * Warns and redirects away from a route that exists only to build or edit a dashboard (e.g.
 * /dashboard/new, /dashboard/import, the Template route), since landing there on mobile would
 * otherwise show a dead-end page that can never be completed.
 */
export function redirectAwayFromMobileEdit(): void {
  notifyMobileEditNotAvailable();
  locationService.replace('/dashboards');
}
