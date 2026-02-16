import { NavModelItem } from '@grafana/data';

import { getDataSourceNav } from './navModel';

describe('getDataSourceNav', () => {
  it('marks a custom config page as active with exact id matching', () => {
    const settingsTab: NavModelItem = {
      id: 'datasource-settings-uid-1',
      text: 'Settings',
      active: false,
    };
    const customTab: NavModelItem = {
      id: 'datasource-page-custom-settings',
      text: 'Custom settings',
      active: false,
    };

    const main: NavModelItem = {
      text: 'Datasource',
      children: [settingsTab, customTab],
    };

    const nav = getDataSourceNav(main, 'custom-settings');

    expect(nav.node.id).toBe('datasource-page-custom-settings');
    expect(settingsTab.active).toBe(false);
    expect(customTab.active).toBe(true);
  });

  it('marks built-in settings tab as active', () => {
    const settingsTab: NavModelItem = {
      id: 'datasource-settings-uid-1',
      text: 'Settings',
      active: false,
    };
    const dashboardsTab: NavModelItem = {
      id: 'datasource-dashboards-uid-1',
      text: 'Dashboards',
      active: false,
    };

    const main: NavModelItem = {
      text: 'Datasource',
      children: [settingsTab, dashboardsTab],
    };

    const nav = getDataSourceNav(main, 'settings');

    expect(nav.node.id).toBe('datasource-settings-uid-1');
    expect(settingsTab.active).toBe(true);
    expect(dashboardsTab.active).toBe(false);
  });
});
