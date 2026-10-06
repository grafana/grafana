import { store } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { type DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { type PanelModel } from 'app/features/dashboard/state/PanelModel';
import { calculateNewPanelGridPos } from 'app/features/dashboard/utils/panel';

export const NEW_PANEL_TITLE = 'New panel';

export function onCreateNewPanel(dashboard: DashboardModel, datasource?: string): number | undefined {
  const newPanel: Partial<PanelModel> = {
    type: 'timeseries',
    title: NEW_PANEL_TITLE,
    gridPos: calculateNewPanelGridPos(dashboard),
    datasource: datasource ? { uid: datasource } : null,
    isNew: true,
  };

  dashboard.addPanel(newPanel);
  return newPanel.id;
}

export function onImportDashboard() {
  locationService.push('/dashboard/import');
}

export function onAddLibraryPanel(dashboard: DashboardModel) {
  const newPanel = {
    type: 'add-library-panel',
    gridPos: calculateNewPanelGridPos(dashboard),
  };

  dashboard.addPanel(newPanel);
}

type LastUsedDatasource =
  | {
      dashboardUid: string;
      datasourceUid: string;
    }
  | undefined;

export const PANEL_EDIT_LAST_USED_DATASOURCE = 'grafana.dashboards.panelEdit.lastUsedDatasource';

// Function that returns last used datasource from local storage
export function getLastUsedDatasourceFromStorage(dashboardUid: string): LastUsedDatasource {
  // Check if user has any local storage associated with this dashboard
  if (store.exists(PANEL_EDIT_LAST_USED_DATASOURCE)) {
    const lastUsedDatasource: LastUsedDatasource = store.getObject(PANEL_EDIT_LAST_USED_DATASOURCE);
    if (lastUsedDatasource?.dashboardUid === dashboardUid) {
      return lastUsedDatasource;
    }
  }
  return undefined;
}

// Function that updates local storage with new dashboard uid and keeps existing datasource
export function updateDashboardUidLastUsedDatasource(dashUid: string) {
  // Check if user has any datasource uid in local storage
  if (!store.exists(PANEL_EDIT_LAST_USED_DATASOURCE)) {
    return;
  }
  const oldRegistryLastUsedDatasource: LastUsedDatasource = store.getObject(PANEL_EDIT_LAST_USED_DATASOURCE);
  //keep existing datasource uid
  const datasourceUid = oldRegistryLastUsedDatasource?.datasourceUid ?? '';
  updatePropsLastUsedDatasourceKey(dashUid, datasourceUid);
}

// Function that updates local storage with new dashboard uid and resets datasource to empty
export function initLastUsedDatasourceKeyForDashboard(dashboardUid: string | undefined) {
  store.setObject(PANEL_EDIT_LAST_USED_DATASOURCE, { dashboardUid: dashboardUid, datasourceUid: '' });
}

// Function that updates local storage with new datasource uid and keeps existing dashboard when there is dash uid key in local storage
// or sets new local storage with new dashboard uid and existing datasource
export function setLastUsedDatasourceKeyForDashboard(dashUid: string, dsUid: string) {
  // Check if user has any datasource uid in local storage
  const lastUsedDatasource = getLastUsedDatasourceFromStorage(dashUid);
  if (!lastUsedDatasource) {
    updatePropsLastUsedDatasourceKey(dashUid, dsUid);
  } else {
    // set new local storage with new dashboard uid and existing datasource
    const dashboardUid = lastUsedDatasource?.dashboardUid ?? '';
    updatePropsLastUsedDatasourceKey(dashboardUid, dsUid);
  }
}

// Function that updates local storage with new dashboard uid and datasource uid
function updatePropsLastUsedDatasourceKey(dashboardUid: string | undefined, datasourceUid: string) {
  store.setObject(PANEL_EDIT_LAST_USED_DATASOURCE, { dashboardUid: dashboardUid, datasourceUid: datasourceUid });
}
