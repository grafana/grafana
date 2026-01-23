import { config } from '@grafana/runtime';

import { useNotificationConfigNav } from './useNotificationConfigNav';

/**
 * Returns the correct navigation settings for the Templates page.
 *
 * When V2 navigation is enabled, the Templates page appears as a tab under
 * "Notification configuration", so we use the tabbed navigation from useNotificationConfigNav.
 *
 * When V2 navigation is disabled, Templates is accessed through the Contact Points page
 * (id: 'receivers'), so we return that nav ID directly.
 */
export function useTemplatesNav() {
  const notificationConfigNav = useNotificationConfigNav();
  const useV2Nav = config.featureToggles.alertingNavigationV2;

  if (useV2Nav) {
    // V2 Navigation: Templates appears as a tab under Notification configuration
    return notificationConfigNav;
  }

  // Legacy navigation: Templates is accessed through Contact Points
  return {
    navId: 'receivers',
  };
}
