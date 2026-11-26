import { createTabExtensionRegistry } from '../extensions/tabExtensionRegistry';

const alertRulesTabs = createTabExtensionRegistry<`/alerting/${string}`>('alert-rules');

/**
 * Registers a new tab on the Alert rules page, next to the rule list.
 * Shown with the alertingNavigationV2 tabs or the GMA-only list view.
 * @param tabNav - The navigation configuration for the tab
 */
export const addAlertRulesTab = alertRulesTabs.addTab;

/**
 * Returns the navigation configuration for all registered alert rules tab extensions.
 */
export const useAlertRulesExtensionTabs = alertRulesTabs.useExtensionTabs;
