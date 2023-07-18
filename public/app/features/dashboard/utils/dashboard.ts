import { chain, cloneDeep, defaults, find } from 'lodash';

import { PanelPluginMeta } from '@grafana/data';
import config from 'app/core/config';
import { LS_PANEL_COPY_KEY } from 'app/core/constants';
import store from 'app/core/store';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { calculateNewPanelGridPos } from 'app/features/dashboard/utils/panel';

export function onCreateNewPanel(dashboard: DashboardModel, datasource?: string): number | undefined {
  const newPanel: Partial<PanelModel> = {
    type: 'timeseries',
    title: 'Panel Title',
    gridPos: calculateNewPanelGridPos(dashboard),
    datasource: datasource ? { uid: datasource } : null,
    isNew: true,
  };

  dashboard.addPanel(newPanel);
  return newPanel.id;
}

export function onCreateNewRow(dashboard: DashboardModel) {
  const newRow = {
    type: 'row',
    title: 'Row title',
    gridPos: { x: 0, y: 0 },
  };

  dashboard.addPanel(newRow);
}

export function onAddLibraryPanel(dashboard: DashboardModel) {
  const newPanel = {
    type: 'add-library-panel',
    gridPos: calculateNewPanelGridPos(dashboard),
  };

  dashboard.addPanel(newPanel);
}

type PanelPluginInfo = { defaults: { gridPos: { w: number; h: number }; title: string } };

export function onPasteCopiedPanel(dashboard: DashboardModel, panelPluginInfo?: PanelPluginMeta & PanelPluginInfo) {
  if (!panelPluginInfo) {
    return;
  }

  const gridPos = calculateNewPanelGridPos(dashboard);

  const newPanel = {
    type: panelPluginInfo.id,
    title: 'Panel Title',
    gridPos: {
      x: gridPos.x,
      y: gridPos.y,
      w: panelPluginInfo.defaults.gridPos.w,
      h: panelPluginInfo.defaults.gridPos.h,
    },
  };

  // apply panel template / defaults
  if (panelPluginInfo.defaults) {
    defaults(newPanel, panelPluginInfo.defaults);
    newPanel.title = panelPluginInfo.defaults.title;
    store.delete(LS_PANEL_COPY_KEY);
  }

  dashboard.addPanel(newPanel);
}

export function getCopiedPanelPlugin(): (PanelPluginMeta & PanelPluginInfo) | undefined {
  const panels = chain(config.panels)
    .filter({ hideFromList: false })
    .map((item) => item)
    .value();

  const copiedPanelJson = store.get(LS_PANEL_COPY_KEY);
  if (copiedPanelJson) {
    const copiedPanel = JSON.parse(copiedPanelJson);

    const pluginInfo = find(panels, { id: copiedPanel.type });
    if (pluginInfo) {
      const pluginCopy: PanelPluginMeta = cloneDeep(pluginInfo);
      pluginCopy.name = copiedPanel.title;
      pluginCopy.sort = -1;

      return { ...pluginCopy, defaults: { ...copiedPanel } };
    }
  }

  return undefined;
}

export function initLocalStorageDashboard(uid: string | undefined) {
  // set local storage for panel edit page
  initLocalStoragePanelEdit(uid);
}

function initLocalStoragePanelEdit(dashUid: string | undefined) {
  // Implement logic to handle last used datasource in panel edit page
  initLastUsedDatasourceLocalStorage(dashUid);
}

type LastUsedDatasource =
  | {
      dashboardUid: string;
      datasourceUid: string;
    }
  | undefined;

const PANEL_EDIT_LAST_USED_DATASOURCE = 'grafana.dashboards.panelEdit.lastUsedDatasource';

function initLastUsedDatasourceLocalStorage(dashUid: string | undefined) {
  // Check if user has any local storage associated with this dashboard
  if (store.exists(PANEL_EDIT_LAST_USED_DATASOURCE)) {
    const lastUsedDatasource: LastUsedDatasource = store.getObject(PANEL_EDIT_LAST_USED_DATASOURCE);

    // is the dashboard the different as the one in local storage?
    if (lastUsedDatasource?.dashboardUid !== dashUid) {
      // set new local storage with current dashboard and empty datasource
      store.setObject(PANEL_EDIT_LAST_USED_DATASOURCE, { dashboardUid: dashUid, datasourceUid: '' });
    }
  } else {
    // set new local storage with current dashboard
    store.setObject(PANEL_EDIT_LAST_USED_DATASOURCE, { dashboardUid: dashUid, datasourceUid: '' });
  }
}

// Function that updates local storage with new dashboard uid and keeps existing datasource
export function updateDashboardUidLastUsedDatasource(dashUid: string) {
  // Check if user has any datasource uid in local storage
  const lastUsedDatasource = getLastUsedDatasourceFromStorage();
  // set new local storage with new dashboard uid and existing datasource
  const datasourceUid = lastUsedDatasource?.datasourceUid ?? '';
  store.setObject(PANEL_EDIT_LAST_USED_DATASOURCE, { dashboardUid: dashUid, datasourceUid: datasourceUid });
}

export function getLastUsedDatasourceFromStorage(): LastUsedDatasource {
  // Check if user has any local storage associated with this dashboard
  if (store.exists(PANEL_EDIT_LAST_USED_DATASOURCE)) {
    const lastUsedDatasource: LastUsedDatasource = store.getObject(PANEL_EDIT_LAST_USED_DATASOURCE);
    return lastUsedDatasource;
  }
  return undefined;
}

// Function that updates local storage with new datasource uid and keeps existing dashboard
export function updateDatasourceUidLastUsedDatasource(dsUid: string) {
  // Check if user has any datasource uid in local storage
  const lastUsedDatasource = getLastUsedDatasourceFromStorage();
  // set new local storage with new dashboard uid and existing datasource
  const dashboardUid = lastUsedDatasource?.dashboardUid ?? '';
  store.setObject(PANEL_EDIT_LAST_USED_DATASOURCE, { dashboardUid: dashboardUid, datasourceUid: dsUid });
}
