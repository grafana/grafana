import { useMatch } from 'react-router-dom-v5-compat';

import { NavModelItem } from '@grafana/data';

import { settingsExtensions } from './extensions';

export function useSettingsPageNav() {
  const match = useMatch('/alerting/admin/:page');
  const isEnterpriseTab = match?.params.page === 'enterprise';
  const isAlertmanagerTab = match?.params.page === 'alertmanager';

  const pageNav: NavModelItem = {
    text: 'Settings',
    icon: 'cog',
    children: [
      {
        text: 'Alertmanager',
        url: '/alerting/admin/alertmanager',
        active: isAlertmanagerTab,
      },
      {
        text: 'Enterprise Features',
        url: '/alerting/admin/enterprise',
        active: isEnterpriseTab,
      },
      ...Array.from(settingsExtensions.entries()).map(([key, { nav }]) => ({
        ...nav,
        text: nav.text,
        url: `/alerting/admin/${key}`,
        active: match?.params.page === key,
        icon: nav.icon,
      })),
    ],
  };

  return pageNav;
}
