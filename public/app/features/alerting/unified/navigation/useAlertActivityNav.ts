import { useMemo } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { type NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { useSelector } from 'app/types/store';

import { isGranted } from '../hooks/abilities/abilityUtils';
import { useGlobalAlertGroupAbility } from '../hooks/abilities/alertmanager/useAlertGroupAbility';
import { useExternalGlobalRuleAbility, useGlobalRuleAbility } from '../hooks/abilities/rules/ruleAbilities';
import { AlertGroupAction, ExternalRuleAction, RuleAction } from '../hooks/abilities/types';
import { ALERTING_PATHS, NAV_IDS } from '../utils/navigation';

/**
 * Returns the correct navId for alert activity pages based on the alertingNavigationV2 feature toggle.
 * Use this for pages that need to reference the Alert activity navigation.
 */
export function getAlertActivityNavId(): string {
  return config.featureToggles.alertingNavigationV2 ? NAV_IDS.ALERT_ACTIVITY : 'alert-alerts';
}

/**
 * Returns the correct navigation settings for Alert activity pages.
 *
 * When V2 navigation is enabled, alert activity pages appear as tabs under
 * "Alert activity", so we build a tabbed navigation structure.
 *
 * When V2 navigation is disabled, each page is standalone with its own nav item.
 */
export function useAlertActivityNav() {
  const location = useLocation();
  const navIndex = useSelector((state) => state.navIndex);

  // Check if V2 navigation is enabled
  const useV2Nav = config.featureToggles.alertingNavigationV2;

  // V2 Navigation: Get the alert activity nav item
  const alertActivityNav = navIndex[NAV_IDS.ALERT_ACTIVITY];

  // Permission checks via ability hooks — no direct contextSrv calls here.
  // A user can view alerts if they have read access to Grafana-managed OR external rules.
  const canViewGrafanaRules = isGranted(useGlobalRuleAbility(RuleAction.View));
  const canViewExternalRules = isGranted(useExternalGlobalRuleAbility(ExternalRuleAction.ViewAlertRule));
  const canViewAlerts = canViewGrafanaRules || canViewExternalRules;

  // A user can view active notifications if they have read access to instances from any source.
  // useGlobalAlertGroupAbility(AlertGroupAction.View) checks both grafana and external instance read.
  const canViewActiveNotifications = isGranted(useGlobalAlertGroupAbility(AlertGroupAction.View));

  // Build tabs based on permissions - memoized to avoid recreating on every render
  const tabs = useMemo(() => {
    if (!useV2Nav || !alertActivityNav) {
      return [];
    }

    const tabItems: NavModelItem[] = [];

    if (canViewAlerts) {
      tabItems.push({
        id: 'alert-activity-alerts',
        text: t('alerting.navigation.alerts', 'Alerts'),
        url: ALERTING_PATHS.ALERTS,
        active: location.pathname === ALERTING_PATHS.ALERTS,
        parentItem: alertActivityNav,
      });
    }

    if (canViewActiveNotifications) {
      tabItems.push({
        id: 'alert-activity-notifications',
        text: t('alerting.navigation.active-notifications', 'Active notifications'),
        url: ALERTING_PATHS.ALERT_GROUPS,
        active: location.pathname === ALERTING_PATHS.ALERT_GROUPS,
        parentItem: alertActivityNav,
      });
    }

    return tabItems;
  }, [location.pathname, alertActivityNav, useV2Nav, canViewAlerts, canViewActiveNotifications]);

  if (!useV2Nav) {
    // Legacy navigation: return simple navId (each page handles its own navId)
    return {
      navId: 'alert-alerts',
    };
  }

  if (!alertActivityNav) {
    // Fallback to legacy if nav item doesn't exist
    return {
      navId: 'alert-alerts',
    };
  }

  // Create pageNav that represents the Alert activity page with tabs as children
  // Don't show tabs bar if only one tab exists (avoids wasting vertical space)
  const pageNav: NavModelItem = {
    ...alertActivityNav,
    children: tabs.length > 1 ? tabs : undefined,
  };

  return {
    navId: NAV_IDS.ALERT_ACTIVITY,
    pageNav,
  };
}

/**
 * Return type for navigation hooks
 */
interface NavHookResult {
  navId: string;
  pageNav?: NavModelItem;
}

/**
 * Factory function to create navigation hooks for alert activity pages.
 * This allows us to have consistent navigation behavior across all alert activity pages.
 */
function createNavHook(legacyNavId: string) {
  return function useNavHook(): NavHookResult {
    const alertActivityNav = useAlertActivityNav();
    const useV2Nav = config.featureToggles.alertingNavigationV2;

    if (useV2Nav) {
      return alertActivityNav;
    }

    return { navId: legacyNavId };
  };
}

/**
 * Navigation hook for Alerts page (Triage)
 */
export const useAlertsNav = createNavHook('alert-alerts');

/**
 * Navigation hook for Active Notifications page (Alert Groups)
 */
export const useAlertGroupsNav = createNavHook('groups');
