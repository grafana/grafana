import { useLocation } from 'react-router-dom-v5-compat';

import { NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { useSelector } from 'app/types/store';

import { shouldAllowRecoveringDeletedRules } from '../featureToggles';

/**
 * Returns the correct navId for alerting pages based on the alertingNavigationV2 feature toggle.
 * Use this for pages that need to reference the Alert rules navigation.
 */
export function getAlertRulesNavId(): string {
  return config.featureToggles.alertingNavigationV2 ? 'alert-rules' : 'alert-list';
}

export function useAlertRulesNav() {
  const location = useLocation();
  const navIndex = useSelector((state) => state.navIndex);

  // Check if V2 navigation is enabled
  const useV2Nav = config.featureToggles.alertingNavigationV2;

  if (!useV2Nav) {
    // Legacy navigation: return simple navId
    return {
      navId: 'alert-list',
    };
  }

  // V2 Navigation: Create tabs structure
  const alertRulesNav = navIndex['alert-rules'];

  if (!alertRulesNav) {
    // Fallback to legacy if nav item doesn't exist
    return {
      navId: 'alert-list',
    };
  }

  // Build tabs based on permissions
  const tabs: NavModelItem[] = [
    {
      id: 'alert-rules-list',
      text: t('alerting.navigation.alert-rules', 'Alert rules'),
      url: '/alerting/list',
      active: location.pathname === '/alerting/list',
      parentItem: alertRulesNav,
    },
  ];

  // Add Recently deleted tab if user has permission
  if (shouldAllowRecoveringDeletedRules()) {
    tabs.push({
      id: 'alert-rules-recently-deleted',
      text: t('alerting.navigation.recently-deleted', 'Recently deleted'),
      url: '/alerting/recently-deleted',
      active: location.pathname === '/alerting/recently-deleted',
      parentItem: alertRulesNav,
    });
  }

  // Create pageNav that represents the Alert rules page with tabs as children
  // Don't show tabs bar if only one tab exists (avoids wasting vertical space for non-admin users)
  const pageNav: NavModelItem = {
    ...alertRulesNav,
    children: tabs.length > 1 ? tabs : undefined,
  };

  return {
    navId: 'alert-rules',
    pageNav,
  };
}
