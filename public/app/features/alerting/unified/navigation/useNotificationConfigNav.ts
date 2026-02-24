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
 * Returns the correct navId for notification configuration pages based on the alertingNavigationV2 feature toggle.
 * Use this for pages that need to reference the Notification configuration navigation.
 */
export function getNotificationConfigNavId(): string {
  return config.featureToggles.alertingNavigationV2 ? NAV_IDS.NOTIFICATION_CONFIG : NAV_IDS.RECEIVERS;
}

/**
 * Check if user has permission to view contact points
 */
function canViewContactPoints(): boolean {
  return contextSrv.hasPermission(AccessControlAction.AlertingReceiversRead);
}

/**
 * Check if user has permission to view notification policies
 */
function canViewNotificationPolicies(): boolean {
  return contextSrv.hasPermission(AccessControlAction.AlertingRoutesRead);
}

/**
 * Check if user has permission to view templates
 */
function canViewTemplates(): boolean {
  return contextSrv.hasPermission(AccessControlAction.AlertingTemplatesRead);
}

/**
 * Check if user has permission to view time intervals (mute timings)
 */
function canViewTimeIntervals(): boolean {
  return contextSrv.hasPermission(AccessControlAction.AlertingTimeIntervalsRead);
}

/**
 * Returns the correct navigation settings for Notification configuration pages.
 *
 * When V2 navigation is enabled, notification config pages appear as tabs under
 * "Notification configuration", so we build a tabbed navigation structure.
 *
 * When V2 navigation is disabled, each page is standalone with its own nav item.
 */
export function useNotificationConfigNav() {
  const location = useLocation();
  const navIndex = useSelector((state) => state.navIndex);

  // Check if V2 navigation is enabled
  const useV2Nav = config.featureToggles.alertingNavigationV2;

  // V2 Navigation: Get the notification config nav item
  const notificationConfigNav = navIndex[NAV_IDS.NOTIFICATION_CONFIG];

  // Build tabs based on permissions - memoized to avoid recreating on every render
  const tabs = useMemo(() => {
    if (!useV2Nav || !notificationConfigNav) {
      return [];
    }

    const tabItems: NavModelItem[] = [];

    if (canViewContactPoints()) {
      tabItems.push({
        id: 'notification-config-contact-points',
        text: t('alerting.navigation.contact-points', 'Contact points'),
        url: ALERTING_PATHS.NOTIFICATIONS,
        active: location.pathname === ALERTING_PATHS.NOTIFICATIONS,
        parentItem: notificationConfigNav,
      });
    }

    if (canViewNotificationPolicies()) {
      tabItems.push({
        id: 'notification-config-policies',
        text: t('alerting.navigation.notification-policies', 'Notification policies'),
        url: ALERTING_PATHS.ROUTES,
        active: location.pathname.startsWith(ALERTING_PATHS.ROUTES),
        parentItem: notificationConfigNav,
      });
    }

    if (canViewTemplates()) {
      tabItems.push({
        id: 'notification-config-templates',
        text: t('alerting.navigation.templates', 'Templates'),
        url: ALERTING_PATHS.TEMPLATES,
        active: location.pathname.startsWith(ALERTING_PATHS.TEMPLATES),
        parentItem: notificationConfigNav,
      });
    }

    if (canViewTimeIntervals()) {
      tabItems.push({
        id: 'notification-config-time-intervals',
        text: t('alerting.navigation.time-intervals', 'Time intervals'),
        url: ALERTING_PATHS.TIME_INTERVALS,
        active: location.pathname.startsWith(ALERTING_PATHS.TIME_INTERVALS),
        parentItem: notificationConfigNav,
      });
    }

    return tabItems;
  }, [location.pathname, notificationConfigNav, useV2Nav]);

  if (!useV2Nav) {
    // Legacy navigation: return simple navId (each page handles its own navId)
    return {
      navId: NAV_IDS.RECEIVERS,
    };
  }

  if (!notificationConfigNav) {
    // Fallback to legacy if nav item doesn't exist
    return {
      navId: NAV_IDS.RECEIVERS,
    };
  }

  // Create pageNav that represents the Notification configuration page with tabs as children
  // Don't show tabs bar if only one tab exists (avoids wasting vertical space)
  const pageNav: NavModelItem = {
    ...notificationConfigNav,
    children: tabs.length > 1 ? tabs : undefined,
  };

  return {
    navId: NAV_IDS.NOTIFICATION_CONFIG,
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
 * Factory function to create navigation hooks for notification configuration pages.
 * This allows us to have consistent navigation behavior across all notification config pages.
 */
function createNavHook(legacyNavId: string) {
  return function useNavHook(): NavHookResult {
    const notificationConfigNav = useNotificationConfigNav();
    const useV2Nav = config.featureToggles.alertingNavigationV2;

    if (useV2Nav) {
      return notificationConfigNav;
    }

    return { navId: legacyNavId };
  };
}

/**
 * Navigation hook for Contact Points page
 */
export const useContactPointsNav = createNavHook(NAV_IDS.RECEIVERS);

/**
 * Navigation hook for Notification Policies page
 */
export const useNotificationPoliciesNav = createNavHook(NAV_IDS.ROUTES);

/**
 * Navigation hook for Templates page
 */
export const useTemplatesNav = createNavHook(NAV_IDS.RECEIVERS);

/**
 * Navigation hook for Time Intervals page
 */
export const useTimeIntervalsNav = createNavHook(NAV_IDS.ROUTES);
