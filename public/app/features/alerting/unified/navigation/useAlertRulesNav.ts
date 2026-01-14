import { useLocation } from 'react-router-dom-v5-compat';

import { NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { useSelector } from 'app/types/store';

export function useAlertRulesNav() {
  const location = useLocation();
  const navIndex = useSelector((state) => state.navIndex);

  // Check if V2 navigation is enabled
  const useV2Nav = config.featureToggles.alertingNavigationV2;

  if (!useV2Nav) {
    // Legacy navigation: return simple navId
    return {
      navId: 'alert-list',
      pageNav: undefined,
    };
  }

  // V2 Navigation: Create tabs structure
  const alertRulesNav = navIndex['alert-rules'];

  if (!alertRulesNav) {
    // Fallback to legacy if nav item doesn't exist
    return {
      navId: 'alert-list',
      pageNav: undefined,
    };
  }

  // All available tabs
  const allTabs = [
    {
      id: 'alert-rules-list',
      text: t('alerting.navigation.alert-rules', 'Alert rules'),
      url: '/alerting/list',
      active: location.pathname === '/alerting/list',
      icon: 'list-ul',
      parentItem: alertRulesNav,
    },
    {
      id: 'alert-rules-recently-deleted',
      text: t('alerting.navigation.recently-deleted', 'Recently deleted'),
      url: '/alerting/recently-deleted',
      active: location.pathname === '/alerting/recently-deleted',
      icon: 'history',
      parentItem: alertRulesNav,
    },
  ].filter((tab) => {
    // Filter based on permissions - if nav item doesn't exist, user doesn't have permission
    const navItem = navIndex[tab.id];
    return navItem !== undefined;
  });

  // Create pageNav that represents the Alert rules page with tabs as children
  const pageNav: NavModelItem = {
    ...alertRulesNav,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    children: allTabs as NavModelItem[],
  };

  return {
    navId: 'alert-rules',
    pageNav,
  };
}
