import { config } from '@grafana/runtime';

import { useNotificationConfigNav } from './useNotificationConfigNav';

/**
 * Returns the correct navigation settings for the Notification Policies page.
 *
 * When V2 navigation is enabled, the Notification Policies page appears as a tab under
 * "Notification configuration", so we use the tabbed navigation from useNotificationConfigNav.
 *
 * When V2 navigation is disabled, the Notification Policies page is a standalone page with its own
 * nav item (id: 'am-routes'), so we return that nav ID directly.
 */
export function useNotificationPoliciesNav() {
  const notificationConfigNav = useNotificationConfigNav();
  const useV2Nav = config.featureToggles.alertingNavigationV2;

  if (useV2Nav) {
    // V2 Navigation: Notification Policies appears as a tab under Notification configuration
    return notificationConfigNav;
  }

  // Legacy navigation: Notification Policies is a standalone page
  return {
    navId: 'am-routes',
  };
}
