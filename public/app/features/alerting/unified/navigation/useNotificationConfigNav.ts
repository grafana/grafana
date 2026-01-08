import { useLocation } from 'react-router-dom-v5-compat';

import { NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useSelector } from 'app/types/store';

import { shouldUseAlertingNavigationV2 } from '../featureToggles';

export function useNotificationConfigNav() {
  const location = useLocation();
  const navIndex = useSelector((state) => state.navIndex);
  const useV2Nav = shouldUseAlertingNavigationV2();

  // If V2 navigation is not enabled, return legacy navId based on current path
  if (!useV2Nav) {
    if (location.pathname.includes('/alerting/notifications/templates')) {
      return {
        navId: 'receivers',
        pageNav: undefined,
      };
    }
    if (location.pathname === '/alerting/routes') {
      return {
        navId: 'am-routes',
        pageNav: undefined,
      };
    }
    return {
      navId: 'receivers',
      pageNav: undefined,
    };
  }

  const notificationConfigNav = navIndex['notification-config'];
  if (!notificationConfigNav) {
    // Fallback to legacy navIds
    if (location.pathname.includes('/alerting/notifications/templates')) {
      return {
        navId: 'receivers',
        pageNav: undefined,
      };
    }
    if (location.pathname === '/alerting/routes') {
      return {
        navId: 'am-routes',
        pageNav: undefined,
      };
    }
    return {
      navId: 'receivers',
      pageNav: undefined,
    };
  }

  // Check if we're on the time intervals page
  // In V2 mode, check for dedicated route; in legacy mode, check for query param
  const isTimeIntervalsTab = useV2Nav
    ? location.pathname === '/alerting/time-intervals'
    : location.pathname === '/alerting/routes' && location.search.includes('tab=time_intervals');

  // All available tabs
  const allTabs = [
    {
      id: 'notification-config-contact-points',
      text: t('alerting.navigation.contact-points', 'Contact points'),
      url: '/alerting/notifications',
      active: location.pathname === '/alerting/notifications' && !location.pathname.includes('/templates'),
      icon: 'comment-alt-share',
      parentItem: notificationConfigNav,
    },
    {
      id: 'notification-config-policies',
      text: t('alerting.navigation.notification-policies', 'Notification policies'),
      url: '/alerting/routes',
      active: location.pathname === '/alerting/routes' && !isTimeIntervalsTab,
      icon: 'sitemap',
      parentItem: notificationConfigNav,
    },
    {
      id: 'notification-config-templates',
      text: t('alerting.navigation.notification-templates', 'Notification templates'),
      url: '/alerting/notifications/templates',
      active: location.pathname.includes('/alerting/notifications/templates'),
      icon: 'file-alt',
      parentItem: notificationConfigNav,
    },
    {
      id: 'notification-config-time-intervals',
      text: t('alerting.navigation.time-intervals', 'Time intervals'),
      url: useV2Nav ? '/alerting/time-intervals' : '/alerting/routes?tab=time_intervals',
      active: isTimeIntervalsTab,
      icon: 'clock-nine',
      parentItem: notificationConfigNav,
    },
  ].filter((tab) => {
    // Filter based on permissions - if nav item doesn't exist, user doesn't have permission
    const navItem = navIndex[tab.id];
    return navItem !== undefined;
  });

  // Create pageNav that represents the Notification configuration page with tabs as children
  const pageNav: NavModelItem = {
    ...notificationConfigNav,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    children: allTabs as NavModelItem[],
  };

  return {
    navId: 'notification-config',
    pageNav,
  };
}
