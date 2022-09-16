import { PanelModel } from '@grafana/data';

import { alertListPanelMigrationHandler } from './AlertListMigrationHandler';
import { AlertListOptions, ShowOption, SortOrder } from './types';

describe('AlertList Panel Migration', () => {
  it('should migrate from < 7.5', () => {
    const panel: Omit<PanelModel, 'fieldConfig'> & Record<string, any> = {
      id: 7,
      links: [],
      pluginVersion: '7.4.0',
      targets: [],
      title: 'Usage',
      type: 'alertlist',
      nameFilter: 'Customer',
      show: 'current',
      sortOrder: 1,
      stateFilter: ['ok', 'paused'],
      dashboardTags: ['tag_a', 'tag_b'],
      dashboardFilter: '',
      limit: 10,
      onlyAlertsOnDashboard: false,
      options: {},
    };

    const newOptions = alertListPanelMigrationHandler(panel as PanelModel);
    expect(newOptions).toMatchObject({
      showOptions: ShowOption.Current,
      maxItems: 10,
      sortOrder: SortOrder.AlphaAsc,
      dashboardAlerts: false,
      alertName: 'Customer',
      dashboardTitle: '',
      tags: ['tag_a', 'tag_b'],
      stateFilter: {
        ok: true,
        paused: true,
      },
      folderId: undefined,
    });

    expect(panel).not.toHaveProperty('show');
    expect(panel).not.toHaveProperty('limit');
    expect(panel).not.toHaveProperty('sortOrder');
    expect(panel).not.toHaveProperty('onlyAlertsOnDashboard');
    expect(panel).not.toHaveProperty('nameFilter');
    expect(panel).not.toHaveProperty('dashboardFilter');
    expect(panel).not.toHaveProperty('folderId');
    expect(panel).not.toHaveProperty('dashboardTags');
    expect(panel).not.toHaveProperty('stateFilter');
  });

  it('should handle >= 7.5', () => {
    const panel: Omit<PanelModel<AlertListOptions>, 'fieldConfig'> & Record<string, any> = {
      id: 7,
      links: [],
      pluginVersion: '7.5.0',
      targets: [],
      title: 'Usage',
      type: 'alertlist',
      options: {
        showOptions: ShowOption.Current,
        maxItems: 10,
        sortOrder: SortOrder.AlphaAsc,
        dashboardAlerts: false,
        alertName: 'Customer',
        dashboardTitle: '',
        tags: ['tag_a', 'tag_b'],
        stateFilter: {
          ok: true,
          paused: true,
          no_data: false,
          execution_error: false,
          pending: false,
          alerting: false,
        },
        folderId: 1,
      },
    };

    const newOptions = alertListPanelMigrationHandler(panel as PanelModel);
    expect(newOptions).toMatchObject({
      showOptions: 'current',
      maxItems: 10,
      sortOrder: SortOrder.AlphaAsc,
      dashboardAlerts: false,
      alertName: 'Customer',
      dashboardTitle: '',
      tags: ['tag_a', 'tag_b'],
      stateFilter: {
        ok: true,
        paused: true,
        no_data: false,
        execution_error: false,
        pending: false,
        alerting: false,
      },
      folderId: 1,
    });

    expect(panel).not.toHaveProperty('show');
    expect(panel).not.toHaveProperty('limit');
    expect(panel).not.toHaveProperty('sortOrder');
    expect(panel).not.toHaveProperty('onlyAlertsOnDashboard');
    expect(panel).not.toHaveProperty('nameFilter');
    expect(panel).not.toHaveProperty('dashboardFilter');
    expect(panel).not.toHaveProperty('folderId');
    expect(panel).not.toHaveProperty('dashboardTags');
    expect(panel).not.toHaveProperty('stateFilter');
  });

  it('should handle config with no options or stateFilter', () => {
    const panel: Omit<PanelModel, 'fieldConfig'> & Record<string, any> = {
      id: 7,
      links: [],
      pluginVersion: '7.4.0',
      targets: [],
      title: 'Usage',
      type: 'alertlist',
      onlyAlertsOnDashboard: false,
      options: {},
    };

    const newOptions = alertListPanelMigrationHandler(panel as PanelModel);
    expect(newOptions).toMatchObject({
      showOptions: ShowOption.Current,
      maxItems: 10,
      sortOrder: SortOrder.AlphaAsc,
      dashboardAlerts: false,
      alertName: '',
      dashboardTitle: '',
      tags: [],
      stateFilter: {},
      folderId: undefined,
    });
  });
});
