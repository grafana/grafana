import { useLocation } from 'react-router-dom-v5-compat';

import { NavModelItem } from '@grafana/data';
import { useSelector } from 'app/types/store';

type SettingsSectionUrl = `/alerting/admin/${string}`;
type SettingsSectionNav = Pick<NavModelItem, 'id' | 'text' | 'icon'> & {
  url: SettingsSectionUrl;
};

const settingsExtensions: Map<SettingsSectionUrl, { nav: SettingsSectionNav }> = new Map();

/**
 * Registers a new settings section that will appear as a tab in the alerting settings page.
 * @param pageNav - The navigation configuration for the settings section
 */
export function addSettingsSection(pageNav: SettingsSectionNav) {
  if (settingsExtensions.has(pageNav.url)) {
    console.warn('Unable to add settings page, PageNav must have an unique url');
    return;
  }
  settingsExtensions.set(pageNav.url, { nav: pageNav });
}

/**
 * Returns the navigation configuration for all settings extensions.
 */
export function useSettingsExtensionsNav(): NavModelItem[] {
  const location = useLocation();

  const navIndex = useSelector((state) => state.navIndex);
  const settingsNav = navIndex['alerting-admin'];

  // Build extension tabs from settingsExtensions
  const extensionTabs: NavModelItem[] = Array.from(settingsExtensions.entries()).map(([url, { nav }]) => ({
    ...nav,
    active: location.pathname === url,
    url: url,
    parentItem: settingsNav,
  }));

  return extensionTabs;
}

/**
 * ONLY USE FOR TESTING. Clears all settings extensions.
 */
export function clearSettingsExtensions() {
  settingsExtensions.clear();
}
