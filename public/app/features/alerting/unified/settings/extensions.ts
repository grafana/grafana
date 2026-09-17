import { createTabExtensionRegistry } from '../extensions/tabExtensionRegistry';

const settingsSections = createTabExtensionRegistry<`/alerting/admin/${string}`>('alerting-admin');

/**
 * Registers a new settings section that will appear as a tab in the alerting settings page.
 * @param pageNav - The navigation configuration for the settings section
 */
export const addSettingsSection = settingsSections.addTab;

/**
 * Returns the navigation configuration for all settings extensions.
 */
export const useSettingsExtensionsNav = settingsSections.useExtensionTabs;
