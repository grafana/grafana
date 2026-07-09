import { useLocation } from 'react-router-dom-v5-compat';

import { type NavModelItem } from '@grafana/data';
import { useSelector } from 'app/types/store';

type AlertRulesTabUrl = `/alerting/${string}`;
type AlertRulesTabNav = Pick<NavModelItem, 'id' | 'text' | 'tabSuffix'> & {
  url: AlertRulesTabUrl;
};

const alertRulesTabExtensions: Map<AlertRulesTabUrl, { nav: AlertRulesTabNav }> = new Map();

/**
 * Registers a new tab on the Alert rules page, next to the rule list.
 * Only shown when the alertingNavigationV2 tabbed navigation is active.
 * @param tabNav - The navigation configuration for the tab
 */
export function addAlertRulesTab(tabNav: AlertRulesTabNav) {
  if (alertRulesTabExtensions.has(tabNav.url)) {
    console.warn('Unable to add alert rules tab, tab must have a unique url');
    return;
  }
  alertRulesTabExtensions.set(tabNav.url, { nav: tabNav });
}

/**
 * Returns the navigation configuration for all registered alert rules tab extensions.
 */
export function useAlertRulesExtensionTabs(): NavModelItem[] {
  const location = useLocation();

  const navIndex = useSelector((state) => state.navIndex);
  const alertRulesNav = navIndex['alert-rules'];

  return Array.from(alertRulesTabExtensions.entries()).map(([url, { nav }]) => ({
    ...nav,
    active: location.pathname === url,
    url,
    parentItem: alertRulesNav,
  }));
}

/**
 * ONLY USE FOR TESTING. Clears all alert rules tab extensions.
 */
export function clearAlertRulesTabExtensions() {
  alertRulesTabExtensions.clear();
}
