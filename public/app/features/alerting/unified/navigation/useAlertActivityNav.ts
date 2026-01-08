import { useLocation } from 'react-router-dom-v5-compat';

import { NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useSelector } from 'app/types/store';

import { shouldUseAlertingNavigationV2 } from '../featureToggles';

export function useAlertActivityNav() {
  const location = useLocation();
  const navIndex = useSelector((state) => state.navIndex);
  const useV2Nav = shouldUseAlertingNavigationV2();

  // If V2 navigation is not enabled, return legacy navId
  if (!useV2Nav) {
    if (location.pathname === '/alerting/groups') {
      return {
        navId: 'groups',
        pageNav: undefined,
      };
    }
    if (location.pathname === '/alerting/alerts') {
      return {
        navId: 'alert-alerts',
        pageNav: undefined,
      };
    }
    return {
      navId: undefined,
      pageNav: undefined,
    };
  }

  const alertActivityNav = navIndex['alert-activity'];
  if (!alertActivityNav) {
    // Fallback to legacy
    if (location.pathname === '/alerting/groups') {
      return {
        navId: 'groups',
        pageNav: undefined,
      };
    }
    if (location.pathname === '/alerting/alerts') {
      return {
        navId: 'alert-alerts',
        pageNav: undefined,
      };
    }
    return {
      navId: undefined,
      pageNav: undefined,
    };
  }

  // All available tabs
  const allTabs = [
    {
      id: 'alert-activity-alerts',
      text: t('alerting.navigation.alerts', 'Alerts'),
      url: '/alerting/alerts',
      active: location.pathname === '/alerting/alerts',
      icon: 'bell',
      parentItem: alertActivityNav,
    },
    {
      id: 'alert-activity-groups',
      text: t('alerting.navigation.active-notifications', 'Active notifications'),
      url: '/alerting/groups',
      active: location.pathname === '/alerting/groups',
      icon: 'layer-group',
      parentItem: alertActivityNav,
    },
  ].filter((tab) => {
    // Filter based on permissions - if nav item doesn't exist, user doesn't have permission
    const navItem = navIndex[tab.id];
    return navItem !== undefined;
  });

  // Create pageNav structure following the same pattern as useNotificationConfigNav
  // Keep "Alert Activity" as the pageNav (not the active tab) so the title and subtitle stay consistent
  // The tabs are children, and the breadcrumb utility will add the active tab to breadcrumbs
  // (including the first tab, after our fix to the breadcrumb utility)
  const pageNav: NavModelItem = {
    ...alertActivityNav,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    children: allTabs as NavModelItem[],
  };

  return {
    navId: 'alert-activity',
    pageNav,
  };
}
