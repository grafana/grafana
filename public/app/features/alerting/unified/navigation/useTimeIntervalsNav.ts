import { config } from '@grafana/runtime';

import { useNotificationConfigNav } from './useNotificationConfigNav';

/**
 * Returns the correct navigation settings for the Time Intervals (Mute Timings) page.
 *
 * When V2 navigation is enabled, the Time Intervals page appears as a tab under
 * "Notification configuration", so we use the tabbed navigation from useNotificationConfigNav.
 *
 * When V2 navigation is disabled, Time Intervals is accessed through the Notification Policies page
 * (id: 'am-routes'), so we return that nav ID directly.
 */
export function useTimeIntervalsNav() {
  const notificationConfigNav = useNotificationConfigNav();
  const useV2Nav = config.featureToggles.alertingNavigationV2;

  if (useV2Nav) {
    // V2 Navigation: Time Intervals appears as a tab under Notification configuration
    return notificationConfigNav;
  }

  // Legacy navigation: Time Intervals is accessed through Notification Policies
  return {
    navId: 'am-routes',
  };
}
