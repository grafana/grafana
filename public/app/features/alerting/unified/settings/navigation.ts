import { useLocation } from 'react-router-dom-v5-compat';

import { type NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useFlagAlertingMigrationWizardUI } from '@grafana/runtime/internal';
import { useSelector } from 'app/types/store';

import { useSettingsExtensionsNav } from './extensions';

/** Deep-link target for the Alerting settings Alertmanager tab. */
const ALERTING_SETTINGS_URL = '/alerting/admin/alertmanager';

/** Deep-link target for the Alerting settings Import tab, which hosts the import wizard. */
export const ALERTING_IMPORT_SETTINGS_URL = '/alerting/admin/import';

export function useSettingsPageNav() {
  const location = useLocation();

  const navIndex = useSelector((state) => state.navIndex);
  const settingsNav = navIndex['alerting-admin'];

  const extensionTabs = useSettingsExtensionsNav();
  const importWizardEnabled = useFlagAlertingMigrationWizardUI();

  const importTab: NavModelItem = {
    id: 'import',
    text: t('alerting.settings.tabs.import', 'Import'),
    url: ALERTING_IMPORT_SETTINGS_URL,
    active: location.pathname === ALERTING_IMPORT_SETTINGS_URL,
    icon: 'cloud-upload',
    parentItem: settingsNav,
  };

  // All available tabs including the main alertmanager tab
  const allTabs: NavModelItem[] = [
    {
      id: 'alertmanager',
      text: t('alerting.settings.tabs.alert-managers', 'Alertmanagers'),
      url: ALERTING_SETTINGS_URL,
      active: location.pathname === ALERTING_SETTINGS_URL,
      icon: 'cloud',
      parentItem: settingsNav,
    },
    // The wizard imports rules without the Alertmanager import API, so the tab only needs the wizard flag.
    // Without that API the wizard locks its notifications step, which is where the staged copy shows.
    ...(importWizardEnabled ? [importTab] : []),
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
