import { config } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient, useFlagGrafanaMobileEditDeprecation } from '@grafana/runtime/internal';
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
