import { useLocation } from 'react-router-dom-v5-compat';

import { type NavModelItem } from '@grafana/data';
import { useSelector } from 'app/types/store';

type AlertRulesTabUrl = `/alerting/${string}`;
type AlertRulesTabNav = Pick<NavModelItem, 'id' | 'text' | 'icon' | 'tabSuffix'> & {
  url: AlertRulesTabUrl;
};

const alertRulesNavExtensions: Map<AlertRulesTabUrl, { nav: AlertRulesTabNav }> = new Map();

/**
 * Registers a new tab that will appear on the alert rules list page (V2 navigation only).
 * @param pageNav - The navigation configuration for the tab
 */
export function addAlertRulesTab(pageNav: AlertRulesTabNav) {
  if (alertRulesNavExtensions.has(pageNav.url)) {
    console.warn('Unable to add alert rules tab, PageNav must have an unique url');
    return;
  }
  alertRulesNavExtensions.set(pageNav.url, { nav: pageNav });
}

/**
 * Returns the navigation configuration for all alert rules nav extensions.
 */
export function useAlertRulesNavExtensions(): NavModelItem[] {
  const location = useLocation();

  const navIndex = useSelector((state) => state.navIndex);
  const alertRulesNav = navIndex['alert-rules'];

  // Build extension tabs from alertRulesNavExtensions
  const extensionTabs: NavModelItem[] = Array.from(alertRulesNavExtensions.entries()).map(([url, { nav }]) => ({
    ...nav,
    active: location.pathname === url,
    url: url,
    parentItem: alertRulesNav,
  }));

  return extensionTabs;
}

/**
 * ONLY USE FOR TESTING. Clears all alert rules nav extensions.
 */
export function clearAlertRulesNavExtensions() {
  alertRulesNavExtensions.clear();
}
