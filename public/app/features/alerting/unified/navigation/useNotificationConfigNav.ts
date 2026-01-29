import { useLocation } from 'react-router-dom-v5-compat';

import { NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { useSelector } from 'app/types/store';

/**
 * Returns the correct navId for notification configuration pages based on the alertingNavigationV2 feature toggle.
 * Use this for pages that need to reference the Notification configuration navigation.
 */
export function getNotificationConfigNavId(): string {
  return config.featureToggles.alertingNavigationV2 ? 'notification-config' : 'receivers';
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

  if (!useV2Nav) {
    // Legacy navigation: return simple navId (each page handles its own navId)
    return {
      navId: 'receivers',
    };
  }

  // V2 Navigation: Create tabs structure
  const notificationConfigNav = navIndex['notification-config'];

  if (!notificationConfigNav) {
    // Fallback to legacy if nav item doesn't exist
    return {
      navId: 'receivers',
    };
  }

  // Build tabs based on permissions
  const tabs: NavModelItem[] = [];

  if (canViewContactPoints()) {
    tabs.push({
      id: 'notification-config-contact-points',
      text: t('alerting.navigation.contact-points', 'Contact points'),
      url: '/alerting/notifications',
      active: location.pathname === '/alerting/notifications',
      parentItem: notificationConfigNav,
    });
  }

  if (canViewNotificationPolicies()) {
    tabs.push({
      id: 'notification-config-policies',
      text: t('alerting.navigation.notification-policies', 'Notification policies'),
      url: '/alerting/routes',
      active: location.pathname === '/alerting/routes',
      parentItem: notificationConfigNav,
    });
  }

  if (canViewTemplates()) {
    tabs.push({
      id: 'notification-config-templates',
      text: t('alerting.navigation.templates', 'Templates'),
      url: '/alerting/notifications/templates',
      active: location.pathname.startsWith('/alerting/notifications/templates'),
      parentItem: notificationConfigNav,
    });
  }

  if (canViewTimeIntervals()) {
    tabs.push({
      id: 'notification-config-time-intervals',
      text: t('alerting.navigation.time-intervals', 'Time intervals'),
      url: '/alerting/routes/mute-timing',
      active: location.pathname.startsWith('/alerting/routes/mute-timing'),
      parentItem: notificationConfigNav,
    });
  }

  // Create pageNav that represents the Notification configuration page with tabs as children
  // Don't show tabs bar if only one tab exists (avoids wasting vertical space)
  const pageNav: NavModelItem = {
    ...notificationConfigNav,
    children: tabs.length > 1 ? tabs : undefined,
  };

  return {
    navId: 'notification-config',
    pageNav,
  };
}
