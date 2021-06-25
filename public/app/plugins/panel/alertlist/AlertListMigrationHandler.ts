import { PanelModel } from '@grafana/data';
import { AlertListOptions } from './types';

export const alertListPanelMigrationHandler = (
  panel: PanelModel<AlertListOptions> & Record<string, any>
): Partial<AlertListOptions> => {
  const newOptions: AlertListOptions = {
    showOptions: panel.options.showOptions ?? panel.show,
    maxItems: panel.options.maxItems ?? panel.limit,
    sortOrder: panel.options.sortOrder ?? panel.sortOrder,
    dashboardAlerts: panel.options.dashboardAlerts ?? panel.onlyAlertsOnDashboard,
    alertName: panel.options.alertName ?? panel.nameFilter,
    dashboardTitle: panel.options.dashboardTitle ?? panel.dashboardFilter,
    folderId: panel.options.folderId ?? panel.folderId,
    tags: panel.options.tags ?? panel.dashboardTags,
    stateFilter:
      panel.options.stateFilter ??
      panel.stateFilter.reduce((filterObj: any, curFilter: any) => ({ ...filterObj, [curFilter]: true }), {}),
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
