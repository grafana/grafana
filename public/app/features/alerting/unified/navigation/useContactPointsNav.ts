import { config } from '@grafana/runtime';

import { useNotificationConfigNav } from './useNotificationConfigNav';

/**
 * Returns the correct navigation settings for the Contact Points page.
 *
 * When V2 navigation is enabled, the Contact Points page appears as a tab under
 * "Notification configuration", so we use the tabbed navigation from useNotificationConfigNav.
 *
 * When V2 navigation is disabled, the Contact Points page is a standalone page with its own
 * nav item (id: 'receivers'), so we return that nav ID directly.
 */
export function useContactPointsNav() {
  const notificationConfigNav = useNotificationConfigNav();
  const useV2Nav = config.featureToggles.alertingNavigationV2;

  if (useV2Nav) {
    // V2 Navigation: Contact Points appears as a tab under Notification configuration
    return notificationConfigNav;
  }

  // Legacy navigation: Contact Points is a standalone page
  return {
    navId: 'receivers',
  };
}
