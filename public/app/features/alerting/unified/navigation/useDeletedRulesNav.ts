import { config } from '@grafana/runtime';

import { useAlertRulesNav } from './useAlertRulesNav';

/**
 * Returns the correct navigation settings for the Deleted Rules page.
 *
 * When V2 navigation is enabled, the deleted rules page appears as a tab under Alert rules,
 * so we use the tabbed navigation from useAlertRulesNav.
 *
 * When V2 navigation is disabled, the deleted rules page is a standalone page with its own
 * nav item (id: 'alerts/recently-deleted'), so we return that nav ID directly.
 */
export function useDeletedRulesNav() {
  const alertRulesNav = useAlertRulesNav();
  const useV2Nav = config.featureToggles.alertingNavigationV2;

  if (useV2Nav) {
    // V2 Navigation: deleted rules appears as a tab under Alert rules
    return alertRulesNav;
  }

  // Legacy navigation: deleted rules is a standalone page
  return {
    navId: 'alerts/recently-deleted',
  };
}
