import { PanelModel } from '@grafana/data';

import { AlertListOptions, ShowOption, SortOrder } from './types';

export const alertListPanelMigrationHandler = (
  panel: PanelModel<AlertListOptions> & Record<string, any>
): Partial<AlertListOptions> => {
  const newOptions: AlertListOptions = {
    showOptions: panel.options.showOptions ?? panel.show ?? ShowOption.Current,
    maxItems: panel.options.maxItems ?? panel.limit ?? 10,
    sortOrder: panel.options.sortOrder ?? panel.sortOrder ?? SortOrder.AlphaAsc,
    dashboardAlerts: panel.options.dashboardAlerts ?? panel.onlyAlertsOnDashboard ?? false,
    alertName: panel.options.alertName ?? panel.nameFilter ?? '',
    dashboardTitle: panel.options.dashboardTitle ?? panel.dashboardFilter ?? '',
    folderId: panel.options.folderId ?? panel.folderId,
    tags: panel.options.tags ?? panel.dashboardTags ?? [],
    stateFilter:
      panel.options.stateFilter ??
      panel.stateFilter?.reduce((filterObj: any, curFilter: any) => ({ ...filterObj, [curFilter]: true }), {}) ??
      {},
  };

  const previousVersion = parseFloat(panel.pluginVersion || '7.4');
  if (previousVersion < 7.5) {
    const oldProps = [
      'show',
      'limit',
      'sortOrder',
      'onlyAlertsOnDashboard',
      'nameFilter',
      'dashboardFilter',
      'folderId',
      'dashboardTags',
      'stateFilter',
    ];
    oldProps.forEach((prop) => delete panel[prop]);
  }

  return newOptions;
};
