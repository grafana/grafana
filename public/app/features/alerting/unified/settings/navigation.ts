import { useMatch } from 'react-router-dom-v5-compat';

import { NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';

import { settingsExtensions } from './extensions';

export function useSettingsPageNav() {
  const match = useMatch('/alerting/admin/:page');
  const isAlertmanagerTab = match?.params.page === 'alertmanager';

  const pageNav: NavModelItem = {
    text: 'Settings',
    icon: 'cog',
    children: [
      ...Array.from(settingsExtensions.entries()).map(([key, { nav }]) => ({
        ...nav,
        text: nav.text,
        url: `/alerting/admin/${key}`,
        active: match?.params.page === key,
        icon: nav.icon,
      })),
      {
        text: t('alerting.settings.tabs.alert-managers', 'Alert managers'),
        url: '/alerting/admin/alertmanager',
        active: isAlertmanagerTab,
      },
    ],
  };

  return pageNav;
}
