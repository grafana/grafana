import { chain, cloneDeep, defaults, find } from 'lodash';
import { locationService } from '@grafana/runtime';
import config from 'app/core/config';
import { LS_PANEL_COPY_KEY } from 'app/core/constants';
import store from 'app/core/store';
import { calculateNewPanelGridPos } from 'app/features/dashboard/utils/panel';
export function onCreateNewPanel(dashboard, datasource) {
    const newPanel = {
        type: 'timeseries',
        title: 'Panel Title',
        gridPos: calculateNewPanelGridPos(dashboard),
        datasource: datasource ? { uid: datasource } : null,
        isNew: true,
    };
    dashboard.addPanel(newPanel);
    return newPanel.id;
}
export function onCreateNewWidgetPanel(dashboard, widgetType) {
    const newPanel = {
        type: widgetType,
        title: 'Widget title',
        gridPos: calculateNewPanelGridPos(dashboard),
        datasource: null,
        isNew: true,
    };
    dashboard.addPanel(newPanel);
    return newPanel.id;
}
export function onCreateNewRow(dashboard) {
    const newRow = {
        type: 'row',
        title: 'Row title',
        gridPos: { x: 0, y: 0 },
    };
    dashboard.addPanel(newRow);
}
export function onImportDashboard() {
    locationService.push('/dashboard/import');
}
export function onAddLibraryPanel(dashboard) {
    const newPanel = {
        type: 'add-library-panel',
        gridPos: calculateNewPanelGridPos(dashboard),
    };
    dashboard.addPanel(newPanel);
}
export function onPasteCopiedPanel(dashboard, panelPluginInfo) {
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
export function getCopiedPanelPlugin() {
    const panels = chain(config.panels)
        .filter({ hideFromList: false })
        .map((item) => item)
        .value();
    const copiedPanelJson = store.get(LS_PANEL_COPY_KEY);
    if (copiedPanelJson) {
        const copiedPanel = JSON.parse(copiedPanelJson);
        const pluginInfo = find(panels, { id: copiedPanel.type });
        if (pluginInfo) {
            const pluginCopy = cloneDeep(pluginInfo);
            pluginCopy.name = copiedPanel.title;
            pluginCopy.sort = -1;
            return Object.assign(Object.assign({}, pluginCopy), { defaults: Object.assign({}, copiedPanel) });
        }
    }
    return undefined;
}
const PANEL_EDIT_LAST_USED_DATASOURCE = 'grafana.dashboards.panelEdit.lastUsedDatasource';
// Function that returns last used datasource from local storage
export function getLastUsedDatasourceFromStorage(dashboardUid) {
    // Check if user has any local storage associated with this dashboard
    if (store.exists(PANEL_EDIT_LAST_USED_DATASOURCE)) {
        const lastUsedDatasource = store.getObject(PANEL_EDIT_LAST_USED_DATASOURCE);
        if ((lastUsedDatasource === null || lastUsedDatasource === void 0 ? void 0 : lastUsedDatasource.dashboardUid) === dashboardUid) {
            return lastUsedDatasource;
        }
    }
    return undefined;
}
// Function that updates local storage with new dashboard uid and keeps existing datasource
export function updateDashboardUidLastUsedDatasource(dashUid) {
    var _a;
    // Check if user has any datasource uid in local storage
    if (!store.exists(PANEL_EDIT_LAST_USED_DATASOURCE)) {
        return;
    }
    const oldRegistryLastUsedDatasource = store.getObject(PANEL_EDIT_LAST_USED_DATASOURCE);
    //keep existing datasource uid
    const datasourceUid = (_a = oldRegistryLastUsedDatasource === null || oldRegistryLastUsedDatasource === void 0 ? void 0 : oldRegistryLastUsedDatasource.datasourceUid) !== null && _a !== void 0 ? _a : '';
    updatePropsLastUsedDatasourceKey(dashUid, datasourceUid);
}
// Function that updates local storage with new dashboard uid and resets datasource to empty
export function initLastUsedDatasourceKeyForDashboard(dashboardUid) {
    store.setObject(PANEL_EDIT_LAST_USED_DATASOURCE, { dashboardUid: dashboardUid, datasourceUid: '' });
}
// Function that updates local storage with new datasource uid and keeps existing dashboard when there is dash uid key in local storage
// or sets new local storage with new dashboard uid and existing datasource
export function setLastUsedDatasourceKeyForDashboard(dashUid, dsUid) {
    var _a;
    // Check if user has any datasource uid in local storage
    const lastUsedDatasource = getLastUsedDatasourceFromStorage(dashUid);
    if (!lastUsedDatasource) {
        updatePropsLastUsedDatasourceKey(dashUid, dsUid);
    }
    else {
        // set new local storage with new dashboard uid and existing datasource
        const dashboardUid = (_a = lastUsedDatasource === null || lastUsedDatasource === void 0 ? void 0 : lastUsedDatasource.dashboardUid) !== null && _a !== void 0 ? _a : '';
        updatePropsLastUsedDatasourceKey(dashboardUid, dsUid);
    }
}
// Function that updates local storage with new dashboard uid and datasource uid
function updatePropsLastUsedDatasourceKey(dashboardUid, datasourceUid) {
    store.setObject(PANEL_EDIT_LAST_USED_DATASOURCE, { dashboardUid: dashboardUid, datasourceUid: datasourceUid });
}
//# sourceMappingURL=dashboard.js.map