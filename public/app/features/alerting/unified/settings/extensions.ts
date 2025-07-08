import { NavModelItem } from '@grafana/data';

type SettingsSectionUrl = `/alerting/admin/${string}`;
type SettingsSectionNav = Pick<NavModelItem, 'id' | 'text' | 'icon'> & {
  url: SettingsSectionUrl;
};

export const settingsExtensions: Map<SettingsSectionUrl, { nav: SettingsSectionNav }> = new Map();

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
