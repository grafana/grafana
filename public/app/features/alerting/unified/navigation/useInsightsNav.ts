import { useMemo } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { useSelector } from 'app/types/store';

import { insightsIsAvailable } from '../home/Insights';
import { isLocalDevEnv } from '../utils/misc';
import { ALERTING_PATHS, NAV_IDS } from '../utils/navigation';

/**
 * Returns the correct navId for insights pages based on the alertingNavigationV2 feature toggle.
 * Use this for pages that need to reference the Insights navigation.
 */
export function getInsightsNavId(): string {
  return config.featureToggles.alertingNavigationV2 ? NAV_IDS.INSIGHTS : 'alerts-history';
}

/**
 * Check if user has permission to view alert state history
 */
function canViewAlertHistory(): boolean {
  return contextSrv.hasPermission(AccessControlAction.AlertingRuleRead);
}

/**
 * Check if system insights datasources are available
 */
function isSystemInsightsAvailable(): boolean {
  return Boolean(insightsIsAvailable()) || isLocalDevEnv();
}

/**
 * Returns the correct navigation settings for Insights pages.
 *
 * When V2 navigation is enabled, insights pages appear as tabs under
 * "Insights", so we build a tabbed navigation structure.
 *
 * When V2 navigation is disabled, each page is standalone with its own nav item.
 */
export function useInsightsNav() {
  const location = useLocation();
  const navIndex = useSelector((state) => state.navIndex);

  // Check if V2 navigation is enabled
  const useV2Nav = config.featureToggles.alertingNavigationV2;

  // V2 Navigation: Get the insights nav item
  const insightsNav = navIndex[NAV_IDS.INSIGHTS];

  // Build tabs based on permissions and feature flags - memoized to avoid recreating on every render
  const tabs = useMemo(() => {
    if (!useV2Nav || !insightsNav) {
      return [];
    }

    const tabItems: NavModelItem[] = [];

    if (isSystemInsightsAvailable()) {
      tabItems.push({
        id: 'insights-system',
        text: t('alerting.navigation.system-insights', 'System insights'),
        url: ALERTING_PATHS.INSIGHTS,
        active: location.pathname === ALERTING_PATHS.INSIGHTS,
        parentItem: insightsNav,
      });
    }

    if (config.featureToggles.alertingCentralAlertHistory && canViewAlertHistory()) {
      tabItems.push({
        id: 'insights-alert-history',
        text: t('alerting.navigation.alert-state-history', 'Alert state history'),
        url: ALERTING_PATHS.HISTORY,
        active: location.pathname === ALERTING_PATHS.HISTORY,
        parentItem: insightsNav,
      });
    }

    if (config.featureToggles.alertingNotificationHistoryGlobal) {
      tabItems.push({
        id: 'insights-notification-history',
        text: t('alerting.navigation.notification-history', 'Notification history'),
        url: ALERTING_PATHS.NOTIFICATIONS_HISTORY,
        active: location.pathname === ALERTING_PATHS.NOTIFICATIONS_HISTORY,
        parentItem: insightsNav,
      });
    }

    return tabItems;
  }, [location.pathname, insightsNav, useV2Nav]);

  if (!useV2Nav) {
    // Legacy navigation: return simple navId (each page handles its own navId)
    return {
      navId: 'alerts-history',
    };
  }

  if (!insightsNav) {
    // Fallback to legacy if nav item doesn't exist
    return {
      navId: 'alerts-history',
    };
  }

  // Create pageNav that represents the Insights page with tabs as children
  // Don't show tabs bar if only one tab exists (avoids wasting vertical space)
  const pageNav: NavModelItem = {
    ...insightsNav,
    children: tabs.length > 1 ? tabs : undefined,
  };

  return {
    navId: NAV_IDS.INSIGHTS,
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
 * Factory function to create navigation hooks for insights pages.
 * This allows us to have consistent navigation behavior across all insights pages.
 */
function createNavHook(legacyNavId: string) {
  return function useNavHook(): NavHookResult {
    const insightsNav = useInsightsNav();
    const useV2Nav = config.featureToggles.alertingNavigationV2;

    if (useV2Nav) {
      return insightsNav;
    }

    return { navId: legacyNavId };
  };
}

/**
 * Navigation hook for System Insights page
 */
export const useSystemInsightsNav = createNavHook('alerting');

/**
 * Navigation hook for Alert State History page
 */
export const useAlertHistoryNav = createNavHook('alerts-history');

/**
 * Navigation hook for Notification History page
 */
export const useNotificationHistoryNav = createNavHook('alerts-notifications');
