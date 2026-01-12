import { useLocation } from 'react-router-dom-v5-compat';

import { NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useSelector } from 'app/types/store';

export function useInsightsNav() {
  const location = useLocation();
  const navIndex = useSelector((state) => state.navIndex);

  const insightsNav = navIndex.insights;
  if (!insightsNav) {
    return {
      navId: undefined,
      pageNav: undefined,
    };
  }

  // All available tabs
  const allTabs = [
    {
      id: 'insights-system',
      text: t('alerting.navigation.system-insights', 'System Insights'),
      url: '/alerting/insights',
      active: location.pathname === '/alerting/insights',
      icon: 'chart-line',
      parentItem: insightsNav,
    },
    {
      id: 'insights-history',
      text: t('alerting.navigation.alert-state-history', 'Alert state history'),
      url: '/alerting/history',
      active: location.pathname === '/alerting/history',
      icon: 'history',
      parentItem: insightsNav,
    },
  ].filter((tab) => {
    // Filter based on permissions - if nav item doesn't exist, user doesn't have permission
    const navItem = navIndex[tab.id];
    return navItem !== undefined;
  });

  // Create pageNav that represents the Insights page with tabs as children
  const pageNav: NavModelItem = {
    ...insightsNav,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    children: allTabs as NavModelItem[],
  };

  return {
    navId: 'insights',
    pageNav,
  };
}
