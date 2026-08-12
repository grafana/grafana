import { createTabExtensionRegistry } from '../extensions/tabExtensionRegistry';

const alertRulesTabs = createTabExtensionRegistry<`/alerting/${string}`>('alert-rules');

/**
 * Registers a new tab on the Alert rules page, next to the rule list.
 * Only shown when the alertingNavigationV2 tabbed navigation is active.
 * @param tabNav - The navigation configuration for the tab
 */
export const addAlertRulesTab = alertRulesTabs.addTab;

/**
 * Returns the navigation configuration for all registered alert rules tab extensions.
 */
export const useAlertRulesExtensionTabs = alertRulesTabs.useExtensionTabs;
