import { useMemo } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { useSelector } from 'app/types/store';

import { ALERTING_PATHS, NAV_IDS } from '../utils/navigation';

/**
 * Returns the correct navId for alert activity pages based on the alertingNavigationV2 feature toggle.
 * Use this for pages that need to reference the Alert activity navigation.
 */
export function getAlertActivityNavId(): string {
  return config.featureToggles.alertingNavigationV2 ? NAV_IDS.ALERT_ACTIVITY : 'alert-alerts';
}

/**
 * Check if user has permission to view alerts
 */
function canViewAlerts(): boolean {
  return contextSrv.hasPermission(AccessControlAction.AlertingRuleRead);
}

/**
 * Check if user has permission to view active notifications (alert groups)
 */
function canViewActiveNotifications(): boolean {
  return contextSrv.hasPermission(AccessControlAction.AlertingInstanceRead);
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

  // Build tabs based on permissions - memoized to avoid recreating on every render
  const tabs = useMemo(() => {
    if (!useV2Nav || !alertActivityNav) {
      return [];
    }

    const tabItems: NavModelItem[] = [];

    if (canViewAlerts()) {
      tabItems.push({
        id: 'alert-activity-alerts',
        text: t('alerting.navigation.alerts', 'Alerts'),
        url: ALERTING_PATHS.ALERTS,
        active: location.pathname === ALERTING_PATHS.ALERTS,
        parentItem: alertActivityNav,
      });
    }

    if (canViewActiveNotifications()) {
      tabItems.push({
        id: 'alert-activity-notifications',
        text: t('alerting.navigation.active-notifications', 'Active notifications'),
        url: ALERTING_PATHS.ALERT_GROUPS,
        active: location.pathname === ALERTING_PATHS.ALERT_GROUPS,
        parentItem: alertActivityNav,
      });
    }

    return tabItems;
  }, [location.pathname, alertActivityNav, useV2Nav]);

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
