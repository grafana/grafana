import { useLocation } from 'react-router-dom-v5-compat';

import { type NavIndex, type NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { useSelector } from 'app/types/store';

import { shouldUseGmaOnlyListView } from '../featureToggles';
import { isAdmin } from '../utils/environment';

import { useAlertRulesExtensionTabs } from './extensions';

/**
 * Returns the correct navId for alerting pages based on the alertingNavigationV2 feature toggle.
 * Use this for pages that need to reference the Alert rules navigation.
 */
export function getAlertRulesNavId(): string {
  return shouldUseGmaOnlyListView() || config.featureToggles.alertingNavigationV2 ? 'alert-rules' : 'alert-list';
}

export function useAlertRulesNav() {
  const location = useLocation();
  const navIndex = useSelector((state) => state.navIndex);
  const extensionTabs = useAlertRulesExtensionTabs();

  if (shouldUseGmaOnlyListView()) {
    return buildGmaRulesNav(
      navIndex,
      'alert-rules',
      location.pathname,
      {
        id: 'alert-rules-list',
        text: t('alerting.navigation.alert-rules', 'Alert rules'),
        url: '/alerting/rules/alert',
      },
      extensionTabs
    );
  }

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
    ...extensionTabs,
  ];

  // Add Recently deleted tab if user has permission
  if (isAdmin()) {
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

export function useRecordingRulesNav() {
  const location = useLocation();
  const navIndex = useSelector((state) => state.navIndex);

  return buildGmaRulesNav(navIndex, 'recording-rules', location.pathname, {
    id: 'recording-rules-list',
    text: t('alerting.navigation.recording-rules', 'Recording rules'),
    url: '/alerting/rules/recording',
  });
}

function buildGmaRulesNav(
  navIndex: NavIndex,
  navId: string,
  pathname: string,
  pageTab: NavModelItem,
  extraTabs: NavModelItem[] = []
) {
  const parentItem = navIndex[navId];
  if (!parentItem) {
    return { navId };
  }

  const children = [{ ...pageTab, active: pathname === pageTab.url, parentItem }, ...extraTabs];

  return {
    navId,
    pageNav: { ...parentItem, children: children.length > 1 ? children : undefined },
  };
}
