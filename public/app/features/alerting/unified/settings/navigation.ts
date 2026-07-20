import { useLocation } from 'react-router-dom-v5-compat';

import { type NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useSelector } from 'app/types/store';

import { useSettingsExtensionsNav } from './extensions';

/** Deep-link target for the Alerting settings Alertmanager tab (auto-sync configuration lives here). */
export const ALERTING_SETTINGS_URL = '/alerting/admin/alertmanager';

export function useSettingsPageNav() {
  const location = useLocation();

  const navIndex = useSelector((state) => state.navIndex);
  const settingsNav = navIndex['alerting-admin'];

  const extensionTabs = useSettingsExtensionsNav();

  // All available tabs including the main alertmanager tab
  const allTabs: NavModelItem[] = [
    {
      id: 'alertmanager',
      text: t('alerting.settings.tabs.alert-managers', 'Alert managers'),
      url: ALERTING_SETTINGS_URL,
      active: location.pathname === ALERTING_SETTINGS_URL,
      icon: 'cloud',
      parentItem: settingsNav,
    },
    ...extensionTabs,
  ];

  // Create pageNav that represents the Settings page with tabs as children
  const pageNav: NavModelItem = {
    ...settingsNav,
    children: allTabs,
  };

  return {
    navId: 'alerting-admin',
    pageNav,
  };
}
